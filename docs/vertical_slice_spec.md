# P1 — FLUX vertical-slice spec (locked)

**One line:** a web piano-roll where the user enters a melody, requests **ghost
accompaniment suggestions**, and can **accept / reject / regenerate** them —
nothing else.

## Scope

### Behavior 1 (the slice): vertical — accompaniment
- User draws/loads a melody on the grid.
- "Suggest" sends the melody to the backend; ghost notes (translucent) come back.
- Accept = ghosts become committed notes. Reject = ghosts vanish.
  Regenerate = new ghosts replace the old ones.
- Maps 1:1 onto AMT's control-token accompaniment (`research/pipeline.py`),
  so swapping the stub for the real model changes no interface.

### Behavior 2 (stretch, not in slice): horizontal — motif development
Deferred until the control mechanism is prototyped in Phase 1 (§3.3 of the plan).

### Explicitly out of scope
Audio playback polish, multiple tracks in the UI, MIDI file import, sessions/
persistence, Logic Pro plugin, mobile. (Playback + MIDI export join in Phase 2.)

## Tech stack (decided)

| Piece | Choice | Why |
|---|---|---|
| Frontend | **React + Vite (web)** | Reuses existing skills; easiest to host/demo (plan §4.2). |
| Piano roll | Hand-rolled SVG grid | Full control over the ghost layer; no heavy DAW library for a slice. |
| Backend | **FastAPI** (same repo/env) | Thin wrapper; Phase 1 swaps the stub for `research.generate` — one brain, two faces. |
| Protocol | `POST /api/suggest` JSON notes `{pitch, time, duration, velocity}` (beats) | Model-agnostic; stable across stub → real model. |

## Gates
- **P2:** frontend renders the grid; backend returns fake MIDI notes.
- **P3:** clicking *regenerate* visibly refreshes a batch of fake ghosts.
- **Phase 1 swap:** replace stub internals with the shared model; UI untouched.
