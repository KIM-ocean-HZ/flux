"""Read MIDI files exported by the browser back with mido and compare them with the project
JSON saved in the same flow (tracks, programs, channels, notes, tempo, meter).

Usage: .venv/bin/python frontend/e2e/check_exports.py data/phase_a/evidence/<run>
"""

import json
import sys
from pathlib import Path

import mido


def notes_of(track):
    tick, open_, out, programs, channels, name = 0, {}, [], [], set(), None
    for msg in track:
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
    return name, programs, channels, sorted(out)


def check(json_path, mid_path):
    project = json.loads(json_path.read_text(encoding="utf-8"))
    mid = mido.MidiFile(mid_path)
    problems = []
    meta = {m.type: m for m in mid.tracks[0] if m.is_meta}
    if mid.ticks_per_beat != project["ppq"]:
        problems.append("ppq")
    if meta["set_tempo"].tempo != round(60e6 / project["quarterBpm"]):
        problems.append("tempo")
    ts = project["timeSignature"]
    if (meta["time_signature"].numerator, meta["time_signature"].denominator) != (ts["numerator"], ts["denominator"]):
        problems.append("meter")
    if len(mid.tracks) != 1 + len(project["tracks"]):
        problems.append(f"track count {len(mid.tracks)} != 1 + {len(project['tracks'])} (chord track must not be exported)")
    channels = []
    for mt, pt in zip(mid.tracks[1:], project["tracks"]):
        name, programs, chans, notes = notes_of(mt)
        want = sorted((n["pitch"], n["startTick"], n["durationTick"], n["velocity"]) for n in pt["clips"][0]["notes"])
        if name != pt["name"] or programs != [pt["program"]] or notes != want or len(chans) != 1:
            problems.append(f"track {pt['name']}: name/program/notes differ")
        channels.append(next(iter(chans)))
    if len(set(channels)) != len(channels):
        problems.append(f"pitched tracks share a channel: {channels}")
    return {
        "json": json_path.name, "midi": mid_path.name, "ok": not problems, "problems": problems,
        "tracks": len(project["tracks"]), "notes": sum(len(t["clips"][0]["notes"]) for t in project["tracks"]),
        "chordEvents": len(project["chordTrack"]), "channels": channels, "bpm": project["quarterBpm"],
        "meter": f"{ts['numerator']}/{ts['denominator']}",
    }


def main(run_dir):
    results = [check(j, j.with_name(j.name.replace(".flux.json", ".mid")))
               for j in sorted(run_dir.glob("flow*.flux.json"))]
    (run_dir / "midi-readback.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    for r in results:
        print(("OK  " if r["ok"] else "BAD ") + json.dumps(r, ensure_ascii=False))
    return 0 if results and all(r["ok"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
