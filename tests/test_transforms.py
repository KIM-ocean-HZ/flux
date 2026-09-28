"""Property tests for the deterministic transform layer (FLUX_v3 Task A).

Each test pins one of the spec's hard guarantees: exact, verifiable transform
relations; bar/beat-grid alignment; in-key pitches in diatonic mode; purity
(inputs never mutated); and float rejection at the boundary.
"""

from fractions import Fraction

import pytest

from core.transforms import (
    Key, Note, TimeSignature, augmentation, degree_interval_sequence, diminution,
    fragmentation, in_key, interval_sequence, inversion, motif_span, on_grid,
    place_in_bars, retrograde, sequence,
)

TS = TimeSignature(4, 4)
C_MAJOR = Key(0, "major")


def twinkle() -> list[Note]:
    """First two bars of the sample melody: C C G G A A G(half). Spans 8 beats."""
    pitches = [60, 60, 67, 67, 69, 69, 67]
    return [Note(time=Fraction(i), pitch=p,
                 duration=Fraction(2) if i == 6 else Fraction(1))
            for i, p in enumerate(pitches)]


def sixteenth_motif() -> list[Note]:
    """One 4/4 bar with sixteenth-level rhythm, to exercise the fine grid."""
    data = [(Fraction(0), 62, Fraction(3, 4)), (Fraction(3, 4), 64, Fraction(1, 4)),
            (Fraction(1), 65, Fraction(1, 2)), (Fraction(3, 2), 67, Fraction(1, 2)),
            (Fraction(2), 69, Fraction(2))]
    return [Note(time=t, pitch=p, duration=d) for t, p, d in data]


# --- boundary: floats are rejected, they drift off the grid -----------------

def test_floats_rejected():
    with pytest.raises(TypeError):
        Note(time=0.5, pitch=60, duration=Fraction(1))
    with pytest.raises(TypeError):
        Note(time=Fraction(0), pitch=60, duration=1.0)
    with pytest.raises(TypeError):
        augmentation(twinkle(), 1.5)


# --- sequence ---------------------------------------------------------------

def test_sequence_chromatic_exact_shifts_and_barlines():
    motif = twinkle()
    seq = sequence(motif, repeats=2, interval=2, direction="down", time_signature=TS)
    rep1, rep2 = seq[:7], seq[7:]
    assert [n.pitch for n in rep1] == [p - 2 for p in (60, 60, 67, 67, 69, 69, 67)]
    assert [n.pitch for n in rep2] == [p - 4 for p in (60, 60, 67, 67, 69, 69, 67)]
    # motif spans exactly 2 bars, so repetition 2 starts on the bar-3 barline
    assert rep1[0].time == 0 and rep2[0].time == Fraction(8)
    assert all(n.time % TS.beats_per_bar == 0 for n in (rep1[0], rep2[0]))


def test_sequence_stride_rounds_up_to_whole_bars():
    # 5-beat motif in 4/4 -> stride must round up to 8 beats, not 5
    motif = [Note(Fraction(0), 60, Fraction(1)), Note(Fraction(4), 62, Fraction(1))]
    seq = sequence(motif, repeats=2, interval=1, time_signature=TS)
    assert seq[2].time == Fraction(8)
    # 2-beat motif in 6/8 (bar = 3 quarter-note beats) -> stride 3
    seq68 = sequence(motif[:1] + [Note(Fraction(1), 62, Fraction(1))], repeats=2,
                     interval=1, time_signature=TimeSignature(6, 8))
    assert seq68[2].time == Fraction(3)


def test_sequence_diatonic_stays_in_key_with_exact_degrees():
    motif = twinkle()
    seq = sequence(motif, repeats=2, interval=1, direction="up", mode="diatonic",
                   key=C_MAJOR, time_signature=TS)
    assert in_key(seq, C_MAJOR)
    rep1, rep2 = seq[:7], seq[7:]
    assert [n.pitch for n in rep1] == [62, 62, 69, 69, 71, 71, 69]  # C->D, G->A, A->B
    assert [n.pitch for n in rep2] == [64, 64, 71, 71, 72, 72, 71]  # C->E, G->B, A->C


def test_sequence_diatonic_snaps_out_of_scale_input():
    motif = [Note(Fraction(0), 66, Fraction(1))]  # F# is not in C major
    seq = sequence(motif, repeats=1, interval=1, mode="diatonic", key=C_MAJOR)
    assert seq[0].pitch == 67  # F# snaps down to F, then up one degree -> G
    assert in_key(seq, C_MAJOR)


def test_sequence_rejects_bad_arguments():
    with pytest.raises(ValueError):
        sequence(twinkle(), repeats=0, interval=1)
    with pytest.raises(ValueError):
        sequence(twinkle(), repeats=1, interval=1, mode="diatonic")  # no key
    with pytest.raises(ValueError):
        sequence(twinkle(), repeats=1, interval=1, direction="sideways")
    with pytest.raises(ValueError):
        sequence([], repeats=1, interval=1)


# --- inversion --------------------------------------------------------------

def test_inversion_chromatic_negates_intervals():
    motif = twinkle()
    inv = inversion(motif)
    assert interval_sequence(inv) == [-i for i in interval_sequence(motif)]
    assert inv[0].pitch == motif[0].pitch  # default axis = first note
    assert [n.time for n in inv] == [n.time for n in motif]  # rhythm untouched


def test_inversion_custom_axis():
    inv = inversion(twinkle(), axis=67)
    assert [n.pitch for n in inv] == [74, 74, 67, 67, 65, 65, 67]


def test_inversion_diatonic_negates_degrees_and_stays_in_key():
    motif = twinkle()
    inv = inversion(motif, mode="diatonic", key=C_MAJOR)
    assert degree_interval_sequence(inv, C_MAJOR) == \
        [-i for i in degree_interval_sequence(motif, C_MAJOR)]
    assert in_key(inv, C_MAJOR)
    assert [n.pitch for n in inv] == [60, 60, 53, 53, 52, 52, 53]  # C C F F E E F


# --- retrograde -------------------------------------------------------------

def test_retrograde_mirrors_time_and_is_involutive():
    motif = twinkle()
    retro = retrograde(motif, TS)
    assert [n.pitch for n in retro] == [67, 69, 69, 67, 67, 60, 60]
    assert retro[0].time == 0  # the half note ends the frame, so it opens the mirror
    assert motif_span(retro) == Fraction(8)
    assert retrograde(retro, TS) == sorted(motif)


def test_retrograde_pads_to_whole_bars():
    # 2-beat motif in 6/8: frame is one 3-beat bar -> mirrored note starts at beat 2
    motif = [Note(Fraction(0), 60, Fraction(1))]
    retro = retrograde(motif + [Note(Fraction(1), 62, Fraction(1))],
                       TimeSignature(6, 8))
    assert [n.time for n in retro] == [Fraction(1), Fraction(2)]


# --- augmentation / diminution ---------------------------------------------

def test_augmentation_scales_exactly():
    motif = sixteenth_motif()
    aug = augmentation(motif, Fraction(3, 2))
    for original, stretched in zip(sorted(motif), aug):
        assert stretched.time == original.time * Fraction(3, 2)
        assert stretched.duration == original.duration * Fraction(3, 2)
    assert on_grid(aug)


def test_diminution_scales_exactly():
    motif = sixteenth_motif()
    dim = diminution(motif, Fraction(3, 4))
    for original, compressed in zip(sorted(motif), dim):
        assert compressed.time == original.time * Fraction(3, 4)
        assert compressed.duration == original.duration * Fraction(3, 4)
    assert on_grid(dim)


def test_scaling_factor_ranges_enforced():
    with pytest.raises(ValueError):
        augmentation(twinkle(), 1)
    with pytest.raises(ValueError):
        diminution(twinkle(), Fraction(3, 2))
    with pytest.raises(ValueError):
        diminution(twinkle(), 0)


# --- fragmentation ----------------------------------------------------------

def test_fragmentation_repeats_fragment_on_beat_grid():
    frag = fragmentation(twinkle(), 0, 2, 3)  # the two C's, three times
    assert [n.pitch for n in frag] == [60] * 6
    assert [n.time for n in frag] == [Fraction(i) for i in range(6)]


def test_fragmentation_normalizes_and_preserves_content():
    frag = fragmentation(twinkle(), 4, 7, 2)  # A A G(half), spans 4 beats
    assert frag[0].time == 0
    occurrence = [(n.pitch, n.duration) for n in frag[:3]]
    assert occurrence == [(69, Fraction(1)), (69, Fraction(1)), (67, Fraction(2))]
    assert [(n.pitch, n.duration) for n in frag[3:]] == occurrence
    assert frag[3].time == Fraction(4)


def test_fragmentation_rejects_bad_slices():
    with pytest.raises(ValueError):
        fragmentation(twinkle(), 3, 3, 1)
    with pytest.raises(ValueError):
        fragmentation(twinkle(), 0, 8, 1)
    with pytest.raises(ValueError):
        fragmentation(twinkle(), 0, 2, 0)


# --- placement, grid, purity ------------------------------------------------

def test_place_in_bars_lands_on_barlines():
    placed = place_in_bars(inversion(twinkle()), 4, TS)
    assert min(n.time for n in placed) == Fraction(16)
    placed68 = place_in_bars([Note(Fraction(0), 60, Fraction(1))], 2, TimeSignature(6, 8))
    assert placed68[0].time == Fraction(6)


def test_all_transforms_stay_on_grid_and_never_mutate_input():
    motif = sixteenth_motif()
    snapshot = list(motif)
    results = [
        sequence(motif, repeats=3, interval=2, mode="diatonic", key=C_MAJOR,
                 time_signature=TS),
        inversion(motif, mode="diatonic", key=C_MAJOR),
        retrograde(motif, TS),
        augmentation(motif, Fraction(3, 2)),
        diminution(motif, Fraction(3, 4)),
        fragmentation(motif, 1, 4, 2),
    ]
    for result in results:
        assert on_grid(result)
    assert motif == snapshot


# --- FLUX_v3 §4.1 acceptance ------------------------------------------------

def test_acceptance_two_bar_motif_inversion():
    """2-bar motif + Inversion must be (a) bar-aligned, (b) an exact mirror,
    (c) in the current key. ((d) target-track precision is Task B's job.)"""
    motif = twinkle()
    ghost = place_in_bars(inversion(motif, mode="diatonic", key=C_MAJOR), 2, TS)
    assert min(n.time for n in ghost) % TS.beats_per_bar == 0            # (a)
    assert degree_interval_sequence(ghost, C_MAJOR) == \
        [-i for i in degree_interval_sequence(motif, C_MAJOR)]           # (b)
    assert in_key(ghost, C_MAJOR)                                        # (c)
