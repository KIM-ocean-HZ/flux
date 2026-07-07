"""X1 — end-to-end pipeline: input melody -> AMT accompaniment -> MIDI -> metrics.

One command proves the whole research loop: a melody goes in as an AMT *control*
(the anticipation mechanism behind accompaniment), the model generates the other
parts, the mix is written to MIDI, and muspy metrics for both input and output are
printed and appended to a CSV. This is the seed of the E1 baseline.
"""

from __future__ import annotations

import csv
import sys
import time
from contextlib import contextmanager
from pathlib import Path

import muspy
from anticipation import ops, sample
from anticipation.config import MAX_DUR, MAX_INSTR, MAX_NOTE, MAX_PITCH, MAX_TIME
from anticipation.convert import midi_to_events
from anticipation.tokenize import extract_instruments
from anticipation.vocab import DUR_OFFSET, NOTE_OFFSET, TIME_OFFSET

from research.generate import DEFAULT_MODEL, load_amt, generate_events, save_midi, save_visual
from research.metrics import compute_metrics, print_metrics
from research.sample_data import write_sample_melody

RESULTS_CSV = Path("data/results/pipeline_metrics.csv")


@contextmanager
def instrument_constraint(allowed: set[int] | None):
    """Constrain decoding so generated notes only land on `allowed` instruments.

    Hooks anticipation's per-token instrument mask (`sample.instr_logits`), which
    runs on every note token. This is the minimal form of track-targeted
    generation; Phase 1 grows it into proper per-track control. No-op if None.
    """
    if allowed is None:
        yield
        return

    original = sample.instr_logits

    def masked(logits, full_history):
        for instr in range(MAX_INSTR):
            if instr not in allowed:
                logits[NOTE_OFFSET + instr * MAX_PITCH:NOTE_OFFSET + (instr + 1) * MAX_PITCH] = -float("inf")
        return logits

    sample.instr_logits = masked
    try:
        yield
    finally:
        sample.instr_logits = original


def melody_to_controls(midi_path: str | Path):
    """Read a melody MIDI and re-tag all its events as AMT control tokens.

    Returns (controls, end_seconds). The melody track is program 0 (piano), so
    extracting instrument 0 turns the entire input into controls.
    """
    events = midi_to_events(str(midi_path))
    remaining, controls = extract_instruments(events, [0])
    assert not remaining, "input melody should be single-instrument (program 0)"
    end_seconds = ops.max_time(controls, seconds=True)
    return controls, end_seconds


def sanitize_events(events: list[int]) -> list[int]:
    """Drop malformed (time, dur, note) triples from a generated event stream.

    Sampling very occasionally emits an out-of-range token, which would crash
    events_to_midi's assertions. Dropping the odd bad triple (with a warning) is
    the right trade for a pipeline that must survive batch runs.
    """
    clean = []
    dropped = 0
    for t, d, n in zip(events[0::3], events[1::3], events[2::3]):
        if (TIME_OFFSET <= t < TIME_OFFSET + MAX_TIME
                and DUR_OFFSET <= d < DUR_OFFSET + MAX_DUR
                and NOTE_OFFSET <= n < NOTE_OFFSET + MAX_NOTE):
            clean.extend([t, d, n])
        else:
            dropped += 1
    if dropped:
        print(f"WARNING: dropped {dropped} malformed event(s) before MIDI conversion")
    return clean


def append_csv(row: dict) -> None:
    RESULTS_CSV.parent.mkdir(parents=True, exist_ok=True)
    write_header = not RESULTS_CSV.exists()
    with RESULTS_CSV.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(row.keys()))
        if write_header:
            writer.writeheader()
        writer.writerow(row)


def run(midi_path: str | Path | None = None, top_p: float = 0.98,
        model_name: str = DEFAULT_MODEL, allowed_instruments: set[int] | None = None,
        tag: str = "e2e_accompaniment", model=None, device: str | None = None) -> None:
    # 1. Input melody (bundled sample if no path given).
    midi_path = Path(midi_path) if midi_path else write_sample_melody()
    print(f"Input melody: {midi_path}")

    # 2. Melody -> AMT controls.
    controls, end_seconds = melody_to_controls(midi_path)
    print(f"{len(controls) // 3} control events over {end_seconds:.1f}s")

    # 3. Generate accompaniment conditioned on the melody.
    if model is None:
        model, device = load_amt(model_name)
    t0 = time.perf_counter()
    with instrument_constraint(allowed_instruments):
        accompaniment = generate_events(model, start_time=0.0, end_time=end_seconds,
                                        inputs=None, controls=controls, top_p=top_p)
    gen_seconds = time.perf_counter() - t0
    print(f"Generated {len(accompaniment) // 3} events in {gen_seconds:.1f}s on {device}")

    # 4. Mix = generated events + the original melody (controls folded back in).
    mix = ops.combine(sanitize_events(accompaniment), controls)
    out_midi = save_midi(mix, f"data/generated/{tag}.mid")
    out_png = save_visual(mix, f"data/generated/{tag}.png")
    print(f"Wrote {out_midi} and {out_png}")

    # 5. Objective metrics for input (reference) and output, appended to CSV.
    instruments = "all" if allowed_instruments is None else "+".join(map(str, sorted(allowed_instruments)))
    for label, path, elapsed in [("input_melody", midi_path, ""),
                                 (tag, out_midi, f"{gen_seconds:.2f}")]:
        metrics = print_metrics(muspy.read_midi(str(path)), title=f"{label} ({path})")
        append_csv({"label": label, "midi": str(path), "model": model_name,
                    "device": device, "top_p": top_p, "instruments": instruments,
                    "gen_seconds": elapsed,
                    **{k: f"{v:.4f}" for k, v in metrics.items()}})
    print(f"Metrics appended to {RESULTS_CSV}")


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else None)
