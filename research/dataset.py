"""D1 — starter dataset: load the Essen Folk Song Database via muspy.

Why Essen: it is tiny (~1.7 MB download), openly mirrored, and consists of
monophonic folk melodies — exactly the *input* side of the FLUX accompaniment
task, so it doubles as a pool of test melodies for the end-to-end pipeline.
The larger multi-track fine-tuning corpus (a Lakh MIDI subset, AMT's own
training domain) remains a research choice; see docs/RESEARCH_RESET_2026-09-26.md.
"""

from __future__ import annotations

from pathlib import Path

import muspy

DATA_ROOT = Path("data/essen")


def load_essen(root: str | Path = DATA_ROOT) -> muspy.EssenFolkSongDatabase:
    """Download (once) and return the Essen dataset; conversion is lazy."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    return muspy.EssenFolkSongDatabase(root, download_and_extract=True)


if __name__ == "__main__":
    # Gate: muspy can enumerate the dataset and read individual songs.
    dataset = load_essen()
    n = len(dataset)
    print(f"Essen Folk Song Database: {n} files")

    # Read a handful to prove individual songs parse into Music objects.
    ok, failed = 0, 0
    for i in range(0, min(n, 50)):
        try:
            music = dataset[i]
            ok += 1
        except Exception:
            failed += 1
    print(f"Parsed {ok}/{ok + failed} sampled songs")

    music = dataset[0]
    notes = sum(len(t.notes) for t in music.tracks)
    print(f"First song: {len(music.tracks)} track(s), {notes} notes")
