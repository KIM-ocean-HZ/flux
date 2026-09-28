"""P2 — FLUX demo backend: a stub that returns fake ghost-accompaniment notes.

Suggestions are still fake. The built frontend is served at the backend's root
URL; Vite on port 5173 remains available for frontend development. The planned
multi-track model integration will also need a richer note/request schema.

Run:  uv run uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import random
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="FLUX demo backend (stub)")
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"

app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets", check_dir=False),
          name="frontend-assets")


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def frontend():
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    return HTMLResponse("""<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>FLUX — 启动前端</title>
<h1>后端已启动，前端尚未构建</h1>
<p>在项目根目录执行以下命令，然后刷新本页：</p>
<pre>cd frontend\nnpm ci\nnpm run build</pre>
<p>开发界面也可以在另一个终端执行 <code>cd frontend &amp;&amp; npm run dev</code>，
然后打开 <a href="http://localhost:5173">http://localhost:5173</a>。</p>
<p><a href="/docs">查看 API 文档</a></p></html>""", status_code=503)

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
