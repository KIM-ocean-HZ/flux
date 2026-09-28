"""Phase A MIDI exchange, cross-checked with an independent parser (mido).

The browser's exporter/importer (frontend/src/music/midi.js) is run through
frontend/scripts/midi_cli.mjs; mido reads what it writes and writes what it reads.
"""

import json
import shutil
import subprocess
from pathlib import Path

import mido
import pytest

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "frontend" / "scripts" / "midi_cli.mjs"
NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(
    NODE is None or not (ROOT / "frontend" / "node_modules" / "midi-file").exists(),
    reason="needs node and `npm --prefix frontend ci`",
)


def run_cli(*args):
    return subprocess.run([NODE, str(CLI), *map(str, args)], capture_output=True, text=True, check=True)


def note(nid, pitch, start, dur, vel=80):
    return {"id": nid, "pitch": pitch, "startTick": start, "durationTick": dur, "velocity": vel}


def track(tid, name, program, notes, is_drum=False, volume=100):
    return {
        "id": tid, "name": name, "role": "drums" if is_drum else "melody", "program": program,
        "isDrum": is_drum, "soundbankId": None, "volume": volume, "pan": 0, "mute": False, "solo": False,
        "clips": [{"id": f"{tid}-clip", "startTick": 0, "lengthTick": 0, "status": "committed",
                   "origin": "user", "notes": notes}],
    }


def project():
    return {
        "id": "prj-test", "schemaVersion": 1, "revision": 3, "name": "双钢琴 · test", "ppq": 960,
        "quarterBpm": 87, "timeSignature": {"numerator": 6, "denominator": 8},
        "loopRange": {"startTick": 0, "endTick": 11520, "enabled": False},
        "keyContext": {"tonicPc": 0, "tonicSpelling": "C", "mode": "major", "source": "user", "status": "confirmed"},
        "chordTrack": [{
            "id": "c1", "startTick": 0, "durationTick": 2880, "kind": "chord", "source": "manual",
            "status": "confirmed",
            "chord": {"rootPc": 0, "rootSpelling": "C", "quality": "maj", "additions": ["add9"],
                      "bassPc": None, "bassSpelling": None},
        }],
        "tracks": [
            track("t1", "旋律 1", 0, [note("a", 60, 0, 1920, 90), note("b", 64, 1920, 7, 1)]),
            # Same program, same pitch, overlapping: must stay a separate track and channel.
            track("t2", "钢琴建议", 0, [note("c", 60, 480, 1920, 55)], volume=64),
            track("t3", "贝斯", 33, [note("d", 36, 0, 960, 100)]),
            track("t4", "鼓", 0, [note("e", 36, 0, 60, 110), note("f", 42, 480, 60, 70)], is_drum=True),
        ],
        "generations": [], "soundbanks": [],
    }


def read_notes(mid_track):
    """Pair note on/off per (channel, pitch) FIFO with absolute ticks."""
    tick, open_, out, programs, channels = 0, {}, [], [], set()
    name = None
    for msg in mid_track:
        tick += msg.time
        if msg.type == "track_name":
            name = msg.name.encode("latin-1").decode("utf-8")
        elif msg.type == "program_change":
            programs.append(msg.program)
            channels.add(msg.channel)
        elif msg.type == "note_on" and msg.velocity > 0:
            open_.setdefault((msg.channel, msg.note), []).append((tick, msg.velocity))
            channels.add(msg.channel)
        elif msg.type in ("note_off", "note_on"):
            start, vel = open_[(msg.channel, msg.note)].pop(0)
            out.append((msg.note, start, tick - start, vel))
    return name, programs, channels, sorted(out, key=lambda n: (n[1], n[0]))


def test_export_is_read_back_by_mido(tmp_path):
    src = tmp_path / "project.json"
    src.write_text(json.dumps(project(), ensure_ascii=False), encoding="utf-8")
    out = tmp_path / "out.mid"
    run_cli("export", src, out)

    mid = mido.MidiFile(out)
    assert mid.type == 1
    assert mid.ticks_per_beat == 960
    assert len(mid.tracks) == 1 + 4  # conductor + one per project track; no chord track
    meta = {m.type: m for m in mid.tracks[0] if m.is_meta}
    assert meta["set_tempo"].tempo == round(60e6 / 87)
    assert (meta["time_signature"].numerator, meta["time_signature"].denominator) == (6, 8)

    tracks = [read_notes(t) for t in mid.tracks[1:]]
    expected = project()["tracks"]
    for (name, programs, channels, notes), exp in zip(tracks, expected):
        assert name == exp["name"]
        assert programs == [exp["program"]]
        assert len(channels) == 1
        want = sorted((n["pitch"], n["startTick"], n["durationTick"], n["velocity"]) for n in exp["clips"][0]["notes"])
        assert notes == sorted(want, key=lambda n: (n[1], n[0]))
    chans = [next(iter(t[2])) for t in tracks]
    assert chans[0] != chans[1], "two program-0 tracks must not share a channel"
    assert chans[3] == 9 and 9 not in chans[:3]
    # The Cadd9 chord control is not rendered as extra notes.
    assert sum(len(t[3]) for t in tracks) == 6


def test_mido_file_is_imported_with_ppq_conversion_and_limits(tmp_path):
    mid = mido.MidiFile(type=1, ticks_per_beat=480)
    conductor = mido.MidiTrack([mido.MetaMessage("set_tempo", tempo=600000, time=0),
                                mido.MetaMessage("time_signature", numerator=3, denominator=4, time=0)])
    conductor.append(mido.MetaMessage("set_tempo", tempo=500000, time=1440))  # tempo change → limitation
    lead = mido.MidiTrack([
        mido.MetaMessage("track_name", name="Lead", time=0),
        mido.Message("program_change", channel=0, program=0, time=0),
        mido.Message("note_on", channel=0, note=60, velocity=90, time=0),
        mido.Message("control_change", channel=0, control=64, value=127, time=10),
        mido.Message("note_off", channel=0, note=60, velocity=0, time=470),
    ])
    double = mido.MidiTrack([
        mido.MetaMessage("track_name", name="Double", time=0),
        mido.Message("program_change", channel=1, program=0, time=0),
        mido.Message("note_on", channel=1, note=60, velocity=50, time=240),
        mido.Message("note_off", channel=1, note=60, velocity=0, time=480),
    ])
    drums = mido.MidiTrack([
        mido.Message("note_on", channel=9, note=36, velocity=100, time=0),
        mido.Message("note_off", channel=9, note=36, velocity=0, time=120),
    ])
    mid.tracks.extend([conductor, lead, double, drums])
    src = tmp_path / "in.mid"
    mid.save(src)
    out = tmp_path / "out.json"
    run_cli("import", src, out)
    result = json.loads(out.read_text(encoding="utf-8"))
    assert result["ok"]
    p = result["project"]
    assert p["quarterBpm"] == 100
    assert p["timeSignature"] == {"numerator": 3, "denominator": 4}
    got = [(t["name"], t["program"], t["isDrum"],
            [(n["pitch"], n["startTick"], n["durationTick"], n["velocity"]) for n in t["clips"][0]["notes"]])
           for t in p["tracks"]]
    assert got == [
        ("Lead", 0, False, [(60, 0, 960, 90)]),
        ("Double", 0, False, [(60, 480, 960, 50)]),
        ("轨道 3", 0, True, [(36, 0, 240, 100)]),
    ]
    text = "\n".join(result["limitations"])
    assert "CC64" in text and "速度变化 1 处" in text
