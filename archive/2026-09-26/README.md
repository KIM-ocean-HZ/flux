> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`README.md`。旧状态和排期已被 2026-09-26 用户需求取代。原文中的测试数量、MPS 速度属于历史记录；更换 tag 不会隔离 pipeline_metrics.csv。
> 当前入口：[项目 README](../../README.md)；[归档纠错索引](../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# FLUX

FLUX is a human–AI symbolic-music co-creation system that helps musicians develop
material they have already written, rather than generating complete pieces for them.

The interaction is non-destructive: the user's own notes are never overwritten.
The system proposes *ghost* suggestions, and the user **accepts**, **rejects** or
**regenerates** them. Suggestions come from two sources — deterministic motivic
transformations (exact, no model) and a symbolic-music model conditioned on the
user's material under explicit constraints.

> **Status (2026-08-24):** Phase 0 is complete and Phase 1 has not started. The
> transform layer and the research pipeline are real and runnable; the interactive
> demo's backend is still a random **stub**, not the model. Section
> [What is still a prototype](#what-is-still-a-prototype) is the honest boundary.

## Research motivation

Symbolic-music generation systems are usually evaluated as generators of complete
material. In a co-creative setting the useful question is different: whether a
suggestion lands *where the user asked for it* (right instrument, right bars, right
key), fast enough to stay interactive, without collapsing into musically empty output.

**Working research question (provisional — to be confirmed with the incoming supervisor):**

> Can a hybrid of deterministic musical transformations and hard-constrained symbolic
> generation provide more reliable and controllable co-creative suggestions than
> unconstrained model output, without unacceptable loss of musical quality or
> interactive latency?

The intended evidence is objective: controllability (does output obey the requested
constraint), musical characteristics (muspy metrics against reference melodies), and
latency distribution. A formal user study was ruled out earlier for ethics-timeline
reasons; whether objective-only evidence is sufficient is an open question for the
incoming supervisor (see [handover note](docs/SUPERVISOR_HANDOVER_2026-09.md)).

## Current architecture

```
                deterministic path                      model path
        core/transforms.py (exact, no model)     research/ (AMT, muspy metrics)
                        │                                   │
                        └───────────────┬───────────────────┘
                                        │  ← not yet joined in the running demo
                              backend/main.py  (FastAPI, STUB)
                                        │  POST /api/suggest  {notes} → {ghosts}
                              frontend/ (React + Vite piano roll)
                                   Suggest / Accept / Reject / Regenerate
```

- **Model** — Anticipatory Music Transformer, `stanford-crfm/music-small-800k`
  (and `music-medium-800k` in the pilot), via the
  [`anticipation`](https://github.com/jthickstun/anticipation) toolkit (Apache-2.0).
  Runs locally on Apple Silicon (MPS) with a CPU fallback.
- **Conditioning** — the user's melody is re-tagged as AMT *control* tokens
  (`research/pipeline.py: melody_to_controls`), which is AMT's native accompaniment
  mechanism.
- **Representation** — AMT event tokens at the model boundary, muspy `Music` for
  metrics, JSON note lists at the frontend boundary; rationale in
  [docs/representation_decision.md](docs/representation_decision.md).
- **Evaluation tooling** — muspy's objective metrics; rationale in
  [docs/mgeval_decision.md](docs/mgeval_decision.md).

## What currently works

Every claim below is checkable with a command in
[Reproduction commands](#reproduction-commands).

| Component | State | Evidence |
|---|---|---|
| Deterministic transform layer | Working | `core/transforms.py`: `sequence`, `inversion`, `retrograde`, `augmentation`, `diminution`, `fragmentation`; times are `fractions.Fraction` and floats are rejected at the boundary; chromatic and diatonic (in-key) modes. |
| Transform guarantees | Verified | `uv run pytest -q` → **20 passed**: interval/degree relations exact, `retrograde ∘ retrograde = id`, results bar/beat-aligned, diatonic output in key, inputs never mutated. |
| Transform demo artifact | Working, deterministic | `uv run python -m core.transforms` writes `data/generated/transforms_demo.mid` (58 notes, 24 bars, 110 BPM). Re-running reproduces the file byte-for-byte. |
| Research pipeline (end to end) | Working | `research/pipeline.py`: melody MIDI → AMT controls → generated accompaniment → mixed MIDI + PNG → muspy metrics appended to `data/results/pipeline_metrics.csv`. |
| Model loads and generates offline | Verified 2026-08-24 | Both checkpoints are in the local HuggingFace cache; `HF_HUB_OFFLINE=1` load + constrained generation succeeded (small checkpoint, MPS). |
| Instrument-constrained decoding | Working, narrow (see below) | `research/pipeline.py: instrument_constraint` masks note-token logits so generated notes may only fall in an **allowed instrument set**. |
| 2×2 pilot artifacts | Present locally | small/medium × constrained/unconstrained, 4 runs; MIDI + PNG in `data/generated/`, 8 rows in `data/results/pipeline_metrics.csv`. |
| Starter dataset | Working | `uv run python -m research.dataset` → Essen Folk Song Database, **10,457 files**, 50/50 sampled songs parsed. |
| Piano-roll UI + ghost interaction | Working against the stub | `frontend/`: draw/delete notes, **Suggest**, translucent ghosts, **Accept / Reject / Regenerate**; `npm run build` succeeds. |

### What the 2×2 pilot actually showed

Four runs — one run per condition, one input melody (the bundled 14-note
"Twinkle"), no repeats, no fixed seed. Counting instruments in the generated MIDI:

| Condition | Instruments in output | Note |
|---|---|---|
| small, unconstrained | 15 tracks | scattered across the GM map |
| medium, unconstrained | 9 tracks | scattered |
| small, constrained to {0, 32, 128} | piano + 1 drum note | inside the allowed set |
| medium, constrained to {0, 32, 128} | piano only, 18 notes on program 0 — of which the 14-note input melody is folded back in | inside the allowed set, but very sparse |

This is a **proof of concept**, not a result: it shows the mask is effective at
restricting the instrument set, and it shows constrained generation can become very
sparse. Neither constrained run placed a single note on acoustic bass (program 32),
which is why the current mechanism must not be described as target-track generation.
Musical quality has **not** been assessed — the artifacts require human listening
assessment.

## What is still a prototype

- **The demo backend is a stub.** `backend/main.py` returns randomly perturbed
  intervals below the input notes. It does **not** call the model. The interface
  (`POST /api/suggest`) is real; the internals are fake.
- **No target instrument anywhere in the running product.** The API schema
  (`SuggestRequest`) has only `notes`; a `target_instrument` field sent by a client
  is silently ignored. The UI has no instrument selector.
- **The constraint is an allowed-set mask, not a target-track guarantee.** It
  restricts *which* instruments the sampler may use; it does not force output onto a
  chosen instrument, and the pilot above shows the difference matters.
- **The constraint is implemented by rebinding a module-global** (`sample.instr_logits`)
  for the duration of a generation. That is process-wide state — it is not safe under
  concurrent requests, and it replaces (rather than wraps) the toolkit's own
  16-instrument cap.
- **Latency numbers are single measurements**, from one pilot run per condition on
  one machine (`gen_seconds` in the CSV: 4.77 / 1.68 / 1.12 / 0.27 s). They are not a
  benchmark and no distribution has been measured.
- **No formal evaluation has been run.** No replicated conditions, no multi-input
  evaluation set, no statistics.
- **No model adaptation.** No LoRA training has been started; `peft` is a declared
  dependency only.
- **The transform layer and the model path are not yet connected.** `core/` is not
  imported by `backend/` or by `research/`.
- **`docs/vertical_slice_spec.md` describes the intended target-track slice**, which
  the code does not yet implement. It is a specification, not a status report.

## Reproduction commands

```sh
uv sync                                   # Python 3.12 environment

# --- no network, no model needed ---
uv run pytest -q                          # 20 passed  (transform-layer property tests)
uv run python -m core.transforms          # writes data/generated/transforms_demo.mid
uv run python -m research.metrics         # muspy metrics for the bundled sample melody

# --- interactive demo (stub backend) ---
uv run uvicorn backend.main:app --reload --port 8000     # terminal 1
cd frontend && npm install && npm run dev                # terminal 2 → http://localhost:5173

# --- model path (needs the checkpoint; ~489 MB for music-small-800k) ---
uv run python -m research.generate        # load model, generate a clip, write MIDI + PNG
uv run python -m research.pipeline        # melody → accompaniment → MIDI → metrics CSV
uv run python -m research.ab_test         # the 2×2 pilot (also downloads music-medium-800k, ~1.3 GB)

# --- dataset (~1.7 MB download, cached under data/essen) ---
uv run python -m research.dataset         # → 10457 files
```

`scripts/demo_check.sh` runs the non-model, non-destructive subset of the above in
one pass (tests, frontend build, transform demo, backend smoke, artifact check).

Note that `research.pipeline` and `research.ab_test` **append** to
`data/results/pipeline_metrics.csv` and overwrite MIDI/PNG artifacts for their tag.
Pass a distinct tag or work in a copy if the existing pilot rows matter.

## Repository layout

```
core/       deterministic transform layer (pure symbolic music ops, no model, no I/O)
research/   model loading, generation, constraints, metrics, dataset, 2×2 pilot
backend/    FastAPI suggestion service — STUB, no model behind it yet
frontend/   React + Vite piano roll with the ghost-note interaction
tests/      property tests for the transform layer (20)
docs/       methodology decisions, specs, handover, runbook, restart plan, worklogs
data/       datasets + generated artifacts — GITIGNORED, local only, reproducible
plans/      local-only planning material (gitignored, not part of the handover)
```

Because `data/` is gitignored, a fresh clone contains **no** artifacts and no metrics
CSV: the pilot outputs shown above exist on the development machine and are
regenerated by the commands above.

## Current limitations

1. The interactive product and the research pipeline share a repository, not a code
   path. Connecting them is the Phase 1 vertical slice.
2. `research.pipeline` reads a **MIDI file** to build controls, while the API speaks
   **JSON notes in beats**. An adapter (and an explicit beats↔seconds and
   float↔`Fraction` boundary) does not exist yet.
3. Generation loads the model per invocation; the backend has no model lifecycle.
4. Constrained generation can produce very little material (see the pilot table);
   no minimum-density or retry policy exists.
5. Objective metrics currently describe single pieces. Reference-vs-generated
   distribution comparison is designed but not implemented.
6. Musical quality claims are unavailable: no listening assessment has been recorded.

## Next milestone

**Phase 1 restart, from 2026-09-01** — plan:
[docs/PHASE1_RESTART_2026-09.md](docs/PHASE1_RESTART_2026-09.md).

The first priority is a **real-model target-track vertical slice**: a minimal target
instrument selector in the UI, `target_instrument` in the API schema, the stub
replaced by a real AMT call on one narrow path (piano melody → bass accompaniment),
the user's committed notes provably untouched, and per-request latency logged.
LoRA is explicitly a later go/no-go decision, not a commitment.

## Supervisor handover

Dr. Anna Shvets supervised the project through Phase 0 and is handing it over.
For the incoming supervisor:

- [docs/SUPERVISOR_HANDOVER_2026-09.md](docs/SUPERVISOR_HANDOVER_2026-09.md) — one
  page: what exists, what is proof of concept, open questions.
- [docs/PROFESSOR_DEMO_RUNBOOK.md](docs/PROFESSOR_DEMO_RUNBOOK.md) — how the live
  demo is run, and what must be said out loud about the stub.
- [docs/PHASE1_RESTART_2026-09.md](docs/PHASE1_RESTART_2026-09.md) — the September
  plan with acceptance criteria.
