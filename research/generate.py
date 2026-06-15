"""Load the Anticipatory Music Transformer (AMT) and generate symbolic music.

This is the shared "brain": the same load/generate path is used by the research
experiments and (later) by the demo backend. We start with the small checkpoint so
it runs locally on an Apple M-series machine; quality is secondary to getting the
whole loop working end-to-end.
"""

from __future__ import annotations

import os
from pathlib import Path

# Force a non-interactive matplotlib backend before anticipation.visuals imports pyplot,
# so visualization works on a headless run.
os.environ.setdefault("MPLBACKEND", "Agg")

import torch
from transformers import AutoModelForCausalLM

from anticipation import convert, visuals
from anticipation.sample import generate

DEFAULT_MODEL = "stanford-crfm/music-small-800k"


def pick_device(prefer: str | None = None) -> str:
    """Return the torch device string. Prefer MPS on Apple Silicon, else CPU."""
    if prefer:
        return prefer
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_amt(model_name: str = DEFAULT_MODEL, device: str | None = None):
    """Load the AMT checkpoint and move it to the chosen device (eval mode)."""
    device = pick_device(device)
    model = AutoModelForCausalLM.from_pretrained(model_name).to(device)
    model.eval()
    print(f"Loaded {model_name} on {device}")
    return model, device


def generate_events(model, start_time: float = 0.0, end_time: float = 5.0,
                    inputs=None, controls=None, top_p: float = 0.98):
    """Generate AMT event tokens for [start_time, end_time] seconds.

    Falls back to CPU once if MPS raises (some sampling ops can be flaky on MPS).
    """
    try:
        return generate(model, start_time, end_time, inputs=inputs, controls=controls, top_p=top_p)
    except (RuntimeError, NotImplementedError) as err:
        if model.device.type == "cpu":
            raise
        print(f"MPS generation failed ({err}); retrying on CPU.")
        model.to("cpu")
        return generate(model, start_time, end_time, inputs=inputs, controls=controls, top_p=top_p)


def save_midi(events, path: str | Path) -> Path:
    """Convert AMT events to a MIDI file on disk."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    convert.events_to_midi(events).save(str(path))
    return path


def save_visual(events, path: str | Path) -> Path:
    """Save a piano-roll-style visualization of the events."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    visuals.visualize(events, str(path))
    return path


if __name__ == "__main__":
    # M2 + M3: load the model, generate a short clip from scratch,
    # then write it out as MIDI and a visualization.
    model, device = load_amt()
    events = generate_events(model, start_time=0.0, end_time=5.0, top_p=0.98)
    print(f"Generated {len(events)} tokens ({len(events) // 3} events)")

    midi_path = save_midi(events, "data/generated/amt_from_scratch.mid")
    png_path = save_visual(events, "data/generated/amt_from_scratch.png")
    print(f"Wrote MIDI -> {midi_path}")
    print(f"Wrote visualization -> {png_path}")
