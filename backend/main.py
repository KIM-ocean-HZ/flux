"""P2 — FLUX demo backend: a stub that returns fake ghost-accompaniment notes.

The interface is the real one (JSON notes in, JSON ghost notes out); only the
internals are fake. In Phase 1 the body of `suggest` is replaced by a call into
the shared model (research.generate / research.pipeline) — the frontend and the
protocol stay untouched.

Run:  uv run uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="FLUX demo backend (stub)")

# The Vite dev server origin; the demo is local-only at this stage.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Note(BaseModel):
    pitch: int          # MIDI pitch 0-127
    time: float         # onset in beats
    duration: float     # length in beats
    velocity: int = 80


class SuggestRequest(BaseModel):
    notes: list[Note]


class SuggestResponse(BaseModel):
    ghosts: list[Note]


@app.post("/api/suggest", response_model=SuggestResponse)
def suggest(req: SuggestRequest) -> SuggestResponse:
    """Fake accompaniment: a bass note plus a third under each downbeat melody note.

    Randomness makes each regenerate visibly different, which is what the
    P3 interaction gate needs.
    """
    ghosts: list[Note] = []
    for note in req.notes:
        if note.time % 1 != 0:  # only harmonize notes that land on a beat
            continue
        interval = random.choice([3, 4])  # minor or major third below
        ghosts.append(Note(pitch=note.pitch - 12, time=note.time,
                           duration=max(note.duration, 1.0), velocity=60))
        if random.random() < 0.7:
            ghosts.append(Note(pitch=note.pitch - interval, time=note.time,
                               duration=note.duration, velocity=55))
    return SuggestResponse(ghosts=ghosts)
