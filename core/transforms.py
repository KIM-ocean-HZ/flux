"""Deterministic motivic-development transforms — the v3 transform layer (Task A).

Pure, exactly computed symbolic transformations: no model, no I/O, no
randomness. Onsets and durations are `fractions.Fraction` in quarter-note
beats, so grid alignment is exact by construction; floats are rejected at the
boundary because they drift off the grid.

Conventions:
  - A motif's times are relative to the start of its first bar (time 0 is a
    barline). Transform results are normalized the same way; `place_in_bars`
    shifts a result onto a target bar.
  - `sequence` strides are the motif span rounded up to whole bars, so every
    repetition starts on a barline; `fragmentation` strides round up to whole
    beats.
  - Diatonic modes measure intervals in scale degrees. This is what lets
    inversion be simultaneously an exact mirror and in-key (FLUX_v3 §4.1):
    a semitone-exact mirror of a C-major motif generally leaves the key,
    a degree-exact mirror never does. Out-of-scale input pitches snap to the
    nearest scale tone (ties resolve downward) before degree arithmetic.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from fractions import Fraction


def _as_fraction(value: int | Fraction, what: str) -> Fraction:
    if isinstance(value, float):
        raise TypeError(f"{what} must be int or Fraction, not float ({value!r}): "
                        "floats drift off the beat grid")
    return Fraction(value)


@dataclass(frozen=True, order=True)
class Note:
    time: Fraction      # onset in quarter-note beats from the motif's first barline
    pitch: int          # MIDI pitch
    duration: Fraction  # length in quarter-note beats, > 0
    velocity: int = 80

    def __post_init__(self):
        object.__setattr__(self, "time", _as_fraction(self.time, "time"))
        object.__setattr__(self, "duration", _as_fraction(self.duration, "duration"))
        if self.duration <= 0:
            raise ValueError(f"duration must be positive, got {self.duration}")


@dataclass(frozen=True)
class TimeSignature:
    numerator: int = 4
    denominator: int = 4

    @property
    def beats_per_bar(self) -> Fraction:
        """Bar length in quarter-note beats (4/4 -> 4, 6/8 -> 3)."""
        return Fraction(4 * self.numerator, self.denominator)


_MODE_STEPS = {"major": (0, 2, 4, 5, 7, 9, 11), "minor": (0, 2, 3, 5, 7, 8, 10)}


@dataclass(frozen=True)
class Key:
    tonic: int          # pitch class, 0=C .. 11=B
    mode: str = "major"

    def __post_init__(self):
        if self.mode not in _MODE_STEPS:
            raise ValueError(f"mode must be one of {sorted(_MODE_STEPS)}, got {self.mode!r}")
        if not 0 <= self.tonic < 12:
            raise ValueError(f"tonic must be a pitch class 0-11, got {self.tonic}")

    @property
    def pitch_classes(self) -> tuple[int, ...]:
        """Scale pitch classes, sorted ascending in [0, 12)."""
        return tuple(sorted((self.tonic + step) % 12 for step in _MODE_STEPS[self.mode]))

    def contains(self, pitch: int) -> bool:
        return pitch % 12 in self.pitch_classes

    def snap(self, pitch: int) -> int:
        """Nearest scale pitch; ties resolve downward."""
        for delta in (0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6):
            if (pitch + delta) % 12 in self.pitch_classes:
                return pitch + delta
        raise AssertionError("unreachable: every scale has a tone within 6 semitones")

    def degree_number(self, pitch: int) -> int:
        """Absolute scale-degree number of a pitch (snapped first), spanning octaves."""
        pitch = self.snap(pitch)
        octave, pc = divmod(pitch, 12)
        return octave * 7 + self.pitch_classes.index(pc)

    def pitch_at_degree(self, degree: int) -> int:
        octave, index = divmod(degree, 7)
        return octave * 12 + self.pitch_classes[index]

    def transpose_degrees(self, pitch: int, steps: int) -> int:
        """Move a pitch along the scale by `steps` degrees."""
        return self.pitch_at_degree(self.degree_number(pitch) + steps)


def motif_span(notes: list[Note]) -> Fraction:
    """End of the last-sounding note, in beats from the motif's start-of-bar."""
    _require_motif(notes)
    return max(n.time + n.duration for n in notes)


def _require_motif(notes: list[Note]) -> None:
    if not notes:
        raise ValueError("motif must contain at least one note")


def _ceil_to(span: Fraction, step: Fraction) -> Fraction:
    """Round `span` up to a whole multiple of `step`."""
    return -((-span) // step) * step


def sequence(motif: list[Note], repeats: int, interval: int, *,
             direction: str = "up", mode: str = "chromatic", key: Key | None = None,
             time_signature: TimeSignature = TimeSignature()) -> list[Note]:
    """Repeat the motif `repeats` times, each shifted one further `interval` step.

    chromatic: `interval` is in semitones; diatonic: in scale degrees of `key`.
    Repetition k (1-based) is shifted by k*interval and starts (k-1) strides
    into the result, where the stride is the motif span rounded up to whole
    bars — every repetition starts on a barline. The output is the
    continuation only (the motif itself is repetition 0), normalized to start
    at time 0.
    """
    _require_motif(motif)
    if repeats < 1:
        raise ValueError(f"repeats must be >= 1, got {repeats}")
    if direction not in ("up", "down"):
        raise ValueError(f"direction must be 'up' or 'down', got {direction!r}")
    if mode == "diatonic":
        if key is None:
            raise ValueError("diatonic sequence requires a key")
    elif mode != "chromatic":
        raise ValueError(f"mode must be 'chromatic' or 'diatonic', got {mode!r}")

    sign = 1 if direction == "up" else -1
    stride = _ceil_to(motif_span(motif), time_signature.beats_per_bar)
    out = []
    for k in range(1, repeats + 1):
        offset = (k - 1) * stride
        for n in motif:
            if mode == "chromatic":
                pitch = n.pitch + sign * interval * k
            else:
                pitch = key.transpose_degrees(n.pitch, sign * interval * k)
            out.append(replace(n, time=n.time + offset, pitch=pitch))
    return sorted(out)


def inversion(motif: list[Note], axis: int | None = None, *,
              mode: str = "chromatic", key: Key | None = None) -> list[Note]:
    """Mirror pitches around `axis` (default: the motif's first note).

    chromatic: exact semitone mirror — the interval sequence of the result is
    the negation of the original's. diatonic: exact scale-degree mirror — the
    degree-interval sequence is negated and every pitch stays in `key`
    (the FLUX_v3 §4.1 acceptance combination). Rhythm is untouched.
    """
    _require_motif(motif)
    if axis is None:
        axis = min(motif).pitch
    if mode == "chromatic":
        return sorted(replace(n, pitch=2 * axis - n.pitch) for n in motif)
    if mode == "diatonic":
        if key is None:
            raise ValueError("diatonic inversion requires a key")
        axis_degree = key.degree_number(axis)
        return sorted(replace(n, pitch=key.pitch_at_degree(2 * axis_degree - key.degree_number(n.pitch)))
                      for n in motif)
    raise ValueError(f"mode must be 'chromatic' or 'diatonic', got {mode!r}")


def retrograde(motif: list[Note],
               time_signature: TimeSignature = TimeSignature()) -> list[Note]:
    """Reverse the motif in time within its whole-bar frame.

    A note that ended t beats before the frame's end starts t beats after its
    beginning; pitches and durations are untouched. Involutive: applying it
    twice returns the original motif.
    """
    frame = _ceil_to(motif_span(motif), time_signature.beats_per_bar)
    return sorted(replace(n, time=frame - (n.time + n.duration)) for n in motif)


def augmentation(motif: list[Note], factor: int | Fraction) -> list[Note]:
    """Stretch onsets and durations by `factor` (> 1), e.g. Fraction(3, 2) or 2."""
    factor = _as_fraction(factor, "factor")
    if factor <= 1:
        raise ValueError(f"augmentation factor must be > 1, got {factor}")
    return _scale_time(motif, factor)


def diminution(motif: list[Note], factor: int | Fraction) -> list[Note]:
    """Compress onsets and durations by `factor` (between 0 and 1), e.g. Fraction(1, 2)."""
    factor = _as_fraction(factor, "factor")
    if not 0 < factor < 1:
        raise ValueError(f"diminution factor must be between 0 and 1, got {factor}")
    return _scale_time(motif, factor)


def _scale_time(motif: list[Note], factor: Fraction) -> list[Note]:
    _require_motif(motif)
    return sorted(replace(n, time=n.time * factor, duration=n.duration * factor) for n in motif)


def fragmentation(motif: list[Note], start: int, end: int, repeats: int) -> list[Note]:
    """Slice notes [start:end) in time order and chain `repeats` occurrences.

    The stride between occurrences is the fragment span rounded up to whole
    beats, so every occurrence starts on the beat grid. The output is
    normalized to start at time 0.
    """
    _require_motif(motif)
    ordered = sorted(motif)
    if not 0 <= start < end <= len(ordered):
        raise ValueError(f"fragment [{start}:{end}) out of range for {len(ordered)} notes")
    if repeats < 1:
        raise ValueError(f"repeats must be >= 1, got {repeats}")
    first_onset = ordered[start].time
    fragment = [replace(n, time=n.time - first_onset) for n in ordered[start:end]]
    stride = _ceil_to(motif_span(fragment), Fraction(1))
    return sorted(replace(n, time=n.time + k * stride)
                  for k in range(repeats) for n in fragment)


def place_in_bars(notes: list[Note], start_bar: int,
                  time_signature: TimeSignature = TimeSignature()) -> list[Note]:
    """Shift a normalized result so it begins at `start_bar` (0-based)."""
    offset = start_bar * time_signature.beats_per_bar
    return [replace(n, time=n.time + offset) for n in notes]


# --- verification helpers: make the exactness guarantees checkable ---------

def interval_sequence(notes: list[Note]) -> list[int]:
    """Semitone intervals between consecutive notes in time order."""
    ordered = sorted(notes)
    return [b.pitch - a.pitch for a, b in zip(ordered, ordered[1:])]


def degree_interval_sequence(notes: list[Note], key: Key) -> list[int]:
    """Scale-degree intervals between consecutive notes in time order."""
    ordered = sorted(notes)
    degrees = [key.degree_number(n.pitch) for n in ordered]
    return [b - a for a, b in zip(degrees, degrees[1:])]


def in_key(notes: list[Note], key: Key) -> bool:
    return all(key.contains(n.pitch) for n in notes)


def on_grid(notes: list[Note], resolution: int = 48) -> bool:
    """True if every onset and duration is exact at `resolution` ticks per beat."""
    return all((n.time * resolution).denominator == 1
               and (n.duration * resolution).denominator == 1 for n in notes)


def _demo() -> None:
    """Apply every transform to the bundled Twinkle motif and write one MIDI."""
    from pathlib import Path

    import muspy

    ts = TimeSignature(4, 4)
    key = Key(0, "major")
    pitches = [60, 60, 67, 67, 69, 69, 67]  # first two bars of the sample melody
    motif = [Note(time=Fraction(i), pitch=p,
                  duration=Fraction(2) if i == len(pitches) - 1 else Fraction(1))
             for i, p in enumerate(pitches)]

    segments = [
        ("original motif", motif),
        ("sequence: diatonic, down a step, x2",
         sequence(motif, repeats=2, interval=1, direction="down", mode="diatonic",
                  key=key, time_signature=ts)),
        ("inversion: diatonic around C4", inversion(motif, mode="diatonic", key=key)),
        ("retrograde", retrograde(motif, ts)),
        ("augmentation: x2", augmentation(motif, 2)),
        ("diminution: x1/2", diminution(motif, Fraction(1, 2))),
        ("fragmentation: notes 4-6 (A A G), x3", fragmentation(motif, 4, 7, 3)),
    ]

    all_notes: list[Note] = []
    bar = 0
    for label, seg in segments:
        print(f"bar {bar + 1:2d}: {label}")
        all_notes.extend(place_in_bars(seg, bar, ts))
        seg_bars = int(_ceil_to(motif_span(seg), ts.beats_per_bar) / ts.beats_per_bar)
        bar += seg_bars + 1  # one empty bar between segments

    resolution = 48
    assert on_grid(all_notes, resolution)
    music = muspy.Music(
        resolution=resolution,
        tempos=[muspy.Tempo(time=0, qpm=110)],
        tracks=[muspy.Track(program=0, name="transforms demo", notes=[
            muspy.Note(time=int(n.time * resolution), pitch=n.pitch,
                       duration=int(n.duration * resolution), velocity=n.velocity)
            for n in sorted(all_notes)])])
    out = Path("data/generated/transforms_demo.mid")
    out.parent.mkdir(parents=True, exist_ok=True)
    music.write_midi(str(out))
    print(f"Wrote {out}")


if __name__ == "__main__":
    _demo()
