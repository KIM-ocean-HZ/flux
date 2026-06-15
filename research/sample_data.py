"""Build small, self-contained symbolic-music samples.

These samples let the rest of the pipeline (metrics, end-to-end, demo backend)
run without depending on any external dataset download. The melody is a plain
C-major nursery tune so the output is easy to sanity-check by ear and by metric.
"""

from __future__ import annotations

from pathlib import Path

import muspy

# muspy's default resolution is ticks-per-quarter-note.
RESOLUTION = muspy.DEFAULT_RESOLUTION
QUARTER = RESOLUTION
HALF = RESOLUTION * 2

# "Twinkle, Twinkle, Little Star" in C major. (pitch, duration_in_ticks).
_TWINKLE = [
    (60, QUARTER), (60, QUARTER), (67, QUARTER), (67, QUARTER),
    (69, QUARTER), (69, QUARTER), (67, HALF),
    (65, QUARTER), (65, QUARTER), (64, QUARTER), (64, QUARTER),
    (62, QUARTER), (62, QUARTER), (60, HALF),
]


def build_sample_melody() -> muspy.Music:
    """Return a single-track C-major melody as a muspy.Music object."""
    notes = []
    time = 0
    for pitch, duration in _TWINKLE:
        notes.append(muspy.Note(time=time, pitch=pitch, duration=duration, velocity=80))
        time += duration

    track = muspy.Track(program=0, is_drum=False, name="melody", notes=notes)
    return muspy.Music(resolution=RESOLUTION, tracks=[track], tempos=[muspy.Tempo(time=0, qpm=120)])


def write_sample_melody(path: str | Path = "data/sample/sample_melody.mid") -> Path:
    """Write the sample melody to a MIDI file and return its path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    build_sample_melody().write_midi(str(path))
    return path


if __name__ == "__main__":
    out = write_sample_melody()
    print(f"Wrote sample melody to {out}")
