# FLUX

Human–AI music co-creation built around a single shared symbolic-music model — the
same "brain" powering both the research experiments and an interactive demo.

This repository contains the **Phase 0 foundation**: a reproducible environment,
a research pipeline that runs end-to-end (melody in → model accompaniment →
objective metrics), and the demo's interaction skeleton (piano-roll + ghost
suggestions against a stub backend).

## Research track

- **Environment** — reproducible via [`uv`](https://docs.astral.sh/uv/) on Python 3.12.
- **Base model** — Anticipatory Music Transformer (`stanford-crfm/music-small-800k`),
  driven through the [`anticipation`](https://github.com/jthickstun/anticipation)
  toolkit (Apache-2.0). Runs locally on Apple Silicon (MPS) with a CPU fallback.
- **Objective metrics** — [`muspy`](https://salu133445.github.io/muspy/); see
  [research/metrics.py](research/metrics.py) and [docs/mgeval_decision.md](docs/mgeval_decision.md).
- **End-to-end** — melody → AMT control tokens → generated accompaniment → MIDI →
  metrics CSV; see [research/pipeline.py](research/pipeline.py).
- **Starter dataset** — Essen Folk Song Database (10k+ monophonic melodies) via
  [research/dataset.py](research/dataset.py).
- **Representation** — aligned with AMT's arrival-time event encoding; rationale in
  [docs/representation_decision.md](docs/representation_decision.md).

```sh
uv sync

# read a MIDI and print objective metrics (uses a bundled sample if no path given)
uv run python -m research.metrics

# load the base model, generate a short clip, write MIDI + a visualization
uv run python -m research.generate

# end-to-end: melody -> accompaniment -> MIDI -> metrics CSV
uv run python -m research.pipeline

# download + enumerate the starter dataset
uv run python -m research.dataset
```

Outputs land under `data/` (gitignored, reproducible from the scripts above).

## Demo track (vertical slice)

Spec: [docs/vertical_slice_spec.md](docs/vertical_slice_spec.md). The backend is a
stub returning fake ghost notes; Phase 1 swaps its internals for the shared model
without touching the frontend or the protocol.

```sh
# terminal 1 — stub backend
uv run uvicorn backend.main:app --reload --port 8000

# terminal 2 — piano-roll frontend (http://localhost:5173)
cd frontend && npm install && npm run dev
```

Draw notes on the grid, click **Suggest** for translucent ghost accompaniment,
then **Accept / Reject / Regenerate**.

## Layout

```
research/   model + metrics + data — the shared "brain"
backend/    FastAPI suggestion service (stub for now)
frontend/   React + Vite piano-roll with the ghost-note interaction
docs/       methodology decisions, specs, drafts
data/       downloaded datasets + generated artifacts (gitignored)
```
