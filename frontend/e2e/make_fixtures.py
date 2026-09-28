"""Write the phase-A browser-test MIDI fixtures with mido (an independent MIDI writer).

Usage: .venv/bin/python frontend/e2e/make_fixtures.py data/phase_a/fixtures
"""

import sys
from pathlib import Path

import mido

PPQ = 480


def on(ch, note, vel, t=0):
    return mido.Message("note_on", channel=ch, note=note, velocity=vel, time=t)


def off(ch, note, t=0):
    return mido.Message("note_off", channel=ch, note=note, velocity=0, time=t)


def block_chords(track, ch, chords, beats):
    """Consecutive block chords, `beats` quarter notes each."""
    for pitches in chords:
        for p in pitches:
            track.append(on(ch, p, 80))
        for i, p in enumerate(pitches):
            track.append(off(ch, p, beats * PPQ if i == 0 else 0))


def save(tracks, path, tempo=500000, ts=(4, 4), ppq=PPQ):
    mid = mido.MidiFile(type=1, ticks_per_beat=ppq)
    mid.tracks.append(mido.MidiTrack([mido.MetaMessage("set_tempo", tempo=tempo),
                                      mido.MetaMessage("time_signature", numerator=ts[0], denominator=ts[1])]))
    mid.tracks.extend(tracks)
    mid.save(path)


def named(name, ch, program):
    t = mido.MidiTrack([mido.MetaMessage("track_name", name=name)])
    if ch != 9:
        t.append(mido.Message("program_change", channel=ch, program=program))
    return t


def main(out):
    out.mkdir(parents=True, exist_ok=True)

    # CH-02: a block C chord, then C–D–E one after another, plus drums that must not be analysed.
    piano = named("Piano", 0, 0)
    block_chords(piano, 0, [(60, 64, 67)], 2)
    for p in (60, 62, 64):
        piano.extend([on(0, p, 80), off(0, p, PPQ)])
    drums = named("Drums", 9, 0)
    for _ in range(4):
        drums.extend([on(9, 36, 100), off(9, 36, PPQ // 4), on(9, 38, 90, PPQ // 4 * 3), off(9, 38, PPQ // 4)])
    save([piano, drums], out / "ch02_block_and_line.mid")

    # CH-05: C–G–Am–F block chords, one bar each (4/4).
    prog = named("Chords", 0, 0)
    block_chords(prog, 0, [(48, 64, 67, 72), (43, 62, 67, 71), (45, 60, 64, 69), (41, 60, 65, 69)], 4)
    save([prog], out / "ch05_c_g_am_f.mid", tempo=600000)

    # A-02: two program-0 tracks with overlapping middle C, two drum tracks on channel 10.
    a = named("Piano A", 0, 0)
    a.extend([on(0, 60, 100), off(0, 60, PPQ * 2)])
    b = named("Piano B", 1, 0)
    b.extend([on(1, 60, 100, PPQ // 2), off(1, 60, PPQ * 7 // 2)])
    k1 = named("Kick", 9, 0)
    for _ in range(8):
        k1.extend([on(9, 36, 110), off(9, 36, PPQ // 2)])
    k2 = named("Hats", 9, 0)
    for _ in range(8):
        k2.extend([on(9, 42, 90), off(9, 42, PPQ // 2)])
    save([a, b, k1, k2], out / "a02_same_program.mid")

    # A-06: things phase A cannot keep (tempo change, CC64, pitch bend, program change, odd PPQ).
    t = named("Complex", 0, 5)
    t.extend([on(0, 60, 90), mido.Message("control_change", channel=0, control=64, value=127, time=10),
              mido.Message("pitchwheel", channel=0, pitch=500, time=1), off(0, 60, 373),
              mido.Message("program_change", channel=0, program=9), on(0, 62, 90), off(0, 62, 1)])
    mid = mido.MidiFile(type=1, ticks_per_beat=384)
    mid.tracks.append(mido.MidiTrack([mido.MetaMessage("set_tempo", tempo=500000),
                                      mido.MetaMessage("set_tempo", tempo=400000, time=768)]))
    mid.tracks.append(t)
    mid.save(out / "a06_complex.mid")

    # A-09: 8 tracks, 2-bar loop material with dense parts and drums.
    tracks = []
    programs = [0, 4, 24, 33, 48, 89, 73]
    for i, program in enumerate(programs):
        tr = named(f"Loop {i + 1}", i, program)
        step = PPQ // 4 if i in (0, 2) else PPQ
        base = [60, 64, 67, 72, 36, 55, 76][i]
        for n in range(8 * PPQ // step):
            p = base + (n % 4) * 2
            tr.extend([on(i, p, 80, 10 if n else 0), off(i, p, step - 10)])
        tracks.append(tr)
    drum = named("Loop drums", 9, 0)
    for n in range(16):
        drum.extend([on(9, 42 if n % 2 else 36, 100), off(9, 42 if n % 2 else 36, PPQ // 2)])
    tracks.append(drum)
    save(tracks, out / "a09_eight_tracks.mid")

    # Chord-analysis timing: 4 and 8 bars of block chords under an eighth-note melody (one part).
    for bars in (4, 8):
        t = named(f"Piano {bars} bars", 0, 0)
        events = []  # (tick, order, message)
        prog = [(48, 64, 67), (43, 59, 62), (45, 60, 64), (41, 57, 60)]  # C, G, Am, F triads
        for b in range(bars):
            chord = prog[b % 4]
            for p in chord:
                events.append((b * 4 * PPQ, 1, on(0, p, 70)))
                events.append(((b + 1) * 4 * PPQ, 0, off(0, p)))
            for e in range(8):
                p = chord[e % 3] + 24  # arpeggiated chord tones above the block chord
                events.append((b * 4 * PPQ + e * PPQ // 2, 1, on(0, p, 85)))
                events.append((b * 4 * PPQ + (e + 1) * PPQ // 2, 0, off(0, p)))
        last = 0
        for tick, _, msg in sorted(events, key=lambda x: (x[0], x[1])):
            msg.time = tick - last
            last = tick
            t.append(msg)
        save([t], out / f"perf_{bars}_bars.mid")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "data/phase_a/fixtures"))
