> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`docs/vertical_slice_spec.md`。撤销 locked 状态。允许乐器集合不保证指定目标轨有输出；当时 API 无 target_instrument。新多轨与播放需求也需要更新协议和前端，不能承诺只替换后端。
> 当前入口：[项目 README](../../../README.md)；[归档纠错索引](../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# P1 — FLUX vertical-slice spec (locked; behaviors refined 2026-07)

> **Implementation status as of 2026-08-24 — this is a specification, not a status
> report.** The described target-track slice is **not yet implemented**: the backend is
> still a random stub, `SuggestRequest` has no `target_instrument` field, and the UI has
> no instrument selector. What the Phase 0 pilot validated is narrower than the wording
> below: `instrument_constraint` restricts generation to an *allowed instrument set*, and
> in the pilot neither constrained run placed a note on the bass. Delivering this spec is
> Milestone 1 of [PHASE1_RESTART_2026-09.md](PHASE1_RESTART_2026-09.md).

**One line:** a web piano-roll where the user enters a melody, picks a **target
track/instrument**, requests **ghost suggestions for that track**, and can
**accept / reject / regenerate** them — nothing else.

## Scope

### Behavior 1 (the slice): vertical — track-targeted accompaniment
- User draws/loads a melody on the grid, then picks the target instrument for
  the suggestion (piano / bass / drums to start).
- "Suggest" sends melody + target instrument to the backend; ghost notes
  (translucent) come back **guaranteed to be on that instrument** — enforced by
  constrained decoding (`instrument_constraint` in `research/pipeline.py`),
  validated in the Phase 0 A/B pilot.
- Accept = ghosts become committed notes. Reject = ghosts vanish.
  Regenerate = new ghosts replace the old ones.
- Maps 1:1 onto AMT's control-token accompaniment + instrument masking, so
  swapping the stub for the real model changes no interface.

### Behavior 2 (stretch, not in slice): horizontal — single-track continuation
User picks a track; the model continues that track's material forward in time
(same constrained-decoding guarantee). Deferred until the control mechanism is
prototyped in Phase 1 (§3.3 of the plan); "development intent" controls
(sequence/inversion) come later still.

### Explicitly out of scope
Audio playback polish, multiple tracks in the UI, MIDI file import, sessions/
persistence, Logic Pro plugin, mobile. (Playback + MIDI export join in Phase 2.)

## Tech stack (decided)

| Piece | Choice | Why |
|---|---|---|
| Frontend | **React + Vite (web)** | Reuses existing skills; easiest to host/demo (plan §4.2). |
| Piano roll | Hand-rolled SVG grid | Full control over the ghost layer; no heavy DAW library for a slice. |
| Backend | **FastAPI** (same repo/env) | Thin wrapper; Phase 1 swaps the stub for `research.generate` — one brain, two faces. |
| Protocol | `POST /api/suggest` JSON: notes `{pitch, time, duration, velocity}` (beats) + `target_instrument` (GM program, 128=drums) | Model-agnostic; stable across stub → real model. |

## Gates
- **P2:** frontend renders the grid; backend returns fake MIDI notes.
- **P3:** clicking *regenerate* visibly refreshes a batch of fake ghosts.
- **Phase 1 swap:** replace stub internals with the shared model; UI untouched.
