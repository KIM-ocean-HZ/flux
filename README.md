# FLUX

Human–AI music co-creation built around a single shared symbolic-music model — the
same "brain" powering both the research experiments and (later) an interactive demo.

This repository currently contains the **Phase 0 foundation**: a reproducible
environment and a research pipeline (base model → generation → objective metrics).

## Phase 0 status

- **Environment** — reproducible via [`uv`](https://docs.astral.sh/uv/) on Python 3.12.
- **Base model** — Anticipatory Music Transformer (`stanford-crfm/music-small-800k`),
  driven through the [`anticipation`](https://github.com/jthickstun/anticipation)
  toolkit (Apache-2.0). Runs locally on Apple Silicon (MPS) with a CPU fallback.
- **Generation → MIDI → visualization** — see [research/generate.py](research/generate.py).
- **Objective metrics** — computed with [`muspy`](https://salu133445.github.io/muspy/);
  see [research/metrics.py](research/metrics.py) and the tooling decision in
  [docs/mgeval_decision.md](docs/mgeval_decision.md).

## Setup

```sh
uv sync
```

## Run

```sh
# V1 — read a MIDI and print objective metrics (generates a sample melody if none given)
uv run python -m research.metrics

# M2/M3 — load the base model, generate a short clip, write MIDI + a visualization
uv run python -m research.generate
```

Outputs are written under `data/` (gitignored, reproducible from the scripts above).

## Layout

```
research/   model + metrics — the shared "brain"
docs/       methodology decisions
data/       generated artifacts (gitignored)
```
