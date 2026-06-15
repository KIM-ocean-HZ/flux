"""Objective metrics for symbolic music, computed with muspy.

Evaluation is the anchor of the project's methodology, so this module is the one
place that turns a piece of music into a reproducible set of numbers. Everything
downstream (baseline, end-to-end pipeline) reuses `compute_metrics`.
"""

from __future__ import annotations

import sys

import muspy


def compute_metrics(music: muspy.Music) -> dict[str, float]:
    """Compute a small, musically-informed metric set for one Music object.

    These are muspy's "absolute" metrics: each describes a single piece. Relative
    comparisons (reference vs generated) are built by computing these on each set
    and comparing distributions later.
    """
    # groove_consistency needs ticks-per-measure; assume 4/4 (4 beats per measure).
    measure_resolution = music.resolution * 4

    return {
        "n_pitches_used": muspy.n_pitches_used(music),
        "n_pitch_classes_used": muspy.n_pitch_classes_used(music),
        "pitch_range": muspy.pitch_range(music),
        "pitch_class_entropy": muspy.pitch_class_entropy(music),
        "scale_consistency": muspy.scale_consistency(music),
        "polyphony": muspy.polyphony(music),
        "empty_beat_rate": muspy.empty_beat_rate(music),
        "groove_consistency": muspy.groove_consistency(music, measure_resolution),
    }


def print_metrics(music: muspy.Music, title: str = "metrics") -> dict[str, float]:
    """Compute and pretty-print metrics; return the dict for reuse."""
    metrics = compute_metrics(music)
    print(f"--- {title} ---")
    for key, value in metrics.items():
        print(f"{key:24s} {value:.4f}")
    return metrics


if __name__ == "__main__":
    # V1: read a MIDI file and print its objective metrics.
    # Usage: uv run python -m research.metrics [path.mid]
    # With no path, it generates the bundled sample first.
    if len(sys.argv) > 1:
        midi_path = sys.argv[1]
    else:
        from research.sample_data import write_sample_melody

        midi_path = str(write_sample_melody())
        print(f"No path given; using generated sample at {midi_path}\n")

    music = muspy.read_midi(midi_path)
    print_metrics(music, title=midi_path)
