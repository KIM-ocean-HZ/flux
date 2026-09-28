> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`docs/SUPERVISOR_HANDOVER_2026-09.md`。保留导师交接背景；状态、时间表和待讨论研究问题仅代表当时，当前技术路线重新评估。
> 当前入口：[项目 README](../../../README.md)；[归档纠错索引](../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# FLUX — supervisor handover note

**Student:** Hanze Jin · **Date:** 2026-08-24 · **Repository state:** Phase 0 complete,
Phase 1 starts 2026-09-01 · **Previous supervisor:** Dr. Anna Shvets

---

## What FLUX is

FLUX is a human–AI symbolic-music co-creation system that helps musicians develop
material they have already written, rather than generating complete pieces for them.

## Background

Symbolic-music models are normally evaluated as generators of finished material. In a
co-creative editor the load-bearing property is different: a suggestion has to land
where the user asked for it — the instrument they selected, the bars they selected, in
key — and arrive fast enough to stay interactive, without becoming musically empty.
FLUX therefore combines two suggestion sources: **deterministic motivic transforms**
(exact, verifiable, no model) and a **constrained symbolic model** (Anticipatory Music
Transformer), behind a non-destructive ghost-note interaction (Accept / Reject /
Regenerate).

## Working research question (provisional — I would like your judgement on it)

> Can a hybrid of deterministic musical transformations and hard-constrained symbolic
> generation provide more reliable and controllable co-creative suggestions than
> unconstrained model output, without unacceptable loss of musical quality or
> interactive latency?

This is a working formulation, not a locked RQ. Methodological context already settled
with the previous supervisor: the base model, pipeline and dataset choices were
endorsed; the RQ direction was explicitly delegated to me; a **formal user study was
ruled out** (ethics timeline impractical within the project scope), so the current plan
studies the interaction aspect through **objective evaluation**.

## What is finished and verifiable

| | Evidence |
|---|---|
| **Deterministic transform layer** — six transforms (sequence, inversion, retrograde, augmentation, diminution, fragmentation), exact rational time (`Fraction`, floats rejected), chromatic and diatonic modes | `core/transforms.py`; **20 property tests pass** (`uv run pytest -q`) pinning exact interval/degree relations, `retrograde∘retrograde = id`, bar/beat alignment, in-key output, purity |
| **Research pipeline end to end** — melody → AMT control tokens → generated accompaniment → MIDI + PNG → muspy metrics CSV | `research/pipeline.py`, one command |
| **Instrument-constrained decoding (allowed-set mask)** | `research/pipeline.py: instrument_constraint` |
| **Interactive prototype** — SVG piano roll, ghost suggestions, Accept / Reject / Regenerate | `frontend/` + `backend/`, production build passes |
| **Starter dataset** — Essen Folk Song Database, 10,457 files | `uv run python -m research.dataset` |
| **Environment reproducible offline** — both AMT checkpoints cached; model loads and generates with `HF_HUB_OFFLINE=1` | verified 2026-08-24 |

## Runnable demo today

`scripts/demo_check.sh` verifies the whole non-model path in one pass. The live demo
(see [PROFESSOR_DEMO_RUNBOOK.md](PROFESSOR_DEMO_RUNBOOK.md)) shows the transform layer,
the property tests, the pilot artifacts, and the ghost interaction in the browser.

## Proof of concept vs. formal result — the boundary I want to be explicit about

**Proof of concept (what exists):** a 2×2 pilot — model size (small/medium) ×
instrument constraint (on/off) — **one run per condition, one input melody, no
repeats, no fixed seed**. It shows the mask restricts the instrument set:
unconstrained runs scattered notes across 9–15 instruments; constrained runs stayed
inside the allowed set {piano, acoustic bass, drums}. It also shows constrained
generation can go very sparse (the medium constrained run produced roughly four new
notes). Latency exists only as four single measurements (0.27–4.77 s on an M-series
laptop).

**Not a formal result:** no replication, no multi-input evaluation set, no latency
distribution, no statistics, **and no assessment of musical quality** — the pilot
artifacts require human listening assessment, which I have not yet recorded.

**Also worth flagging:** neither constrained run placed a note on acoustic bass. The
current mechanism constrains the *allowed instrument set*; it does not guarantee output
on a *chosen target instrument*. That gap is exactly Phase 1's first milestone.

## Architecture

```
core/transforms.py   deterministic transforms — exact, no model, no I/O   [real]
research/            AMT loading, generation, constraint, muspy metrics    [real]
backend/main.py      FastAPI  POST /api/suggest  {notes} → {ghosts}        [STUB — random]
frontend/            React + Vite piano roll, ghost layer                  [real, on the stub]
```

The two real halves are **not yet connected**: the web demo's suggestions come from a
random stub, not the model, and `core/` is not imported by the backend.

## Not done

- Real model behind the interactive backend (the vertical slice).
- Target instrument: absent from the API schema and from the UI.
- Composable constraints (bar range, pitch range, key consistency) — designed only.
- Replicated baseline evaluation on multiple inputs.
- Any model adaptation / LoRA (`peft` is a declared dependency and nothing more).
- Listening assessment of any generated artifact.

## Main technical risks

1. **Constraint strength.** An allowed-set logit mask is weak evidence for a
   "controllability" claim, and it made output sparse in the pilot. If hard constraints
   buy compliance at the cost of musical density, that trade-off *is* the finding — but
   it needs a real measurement.
2. **Global mutable state in the sampler.** The constraint works by rebinding the
   toolkit's module-global `sample.instr_logits`. That is not concurrency-safe in a web
   backend and needs either serialisation or a safer hook.
3. **Representation boundary.** The pipeline builds controls from a MIDI *file*; the API
   speaks JSON notes in *beats*; the transform layer uses exact `Fraction` beats; AMT is
   wall-clock (10 ms bins). The adapter between them does not exist yet and is where
   silent musical errors would hide.
4. **Scope vs. time.** Vertical slice, constraint layer, replicated evaluation and
   possibly LoRA in one autumn is a lot; I would rather cut early than cut late.

## Questions I would value your judgement on

1. **Is the working RQ focused enough**, or should it narrow to controllability alone
   (dropping the quality/latency clause into secondary measures)?
2. **How should deterministic transforms, hard constraints and model adaptation be set
   up as a defensible comparison?** They are not the same kind of object — one is exact
   by construction, one masks a sampler, one changes the weights. What makes them
   comparable rather than merely juxtaposed?
3. **Is LoRA still worth keeping?** My inclination is to make it a **go/no-go after the
   baseline**, justified only if the baseline exposes a failure hard constraints cannot
   fix. Do you agree, or is learned adaptation load-bearing for the contribution?
4. **Is objective-only evaluation sufficient**, given the user study is out? Would some
   form of **practice-led evidence** that needs no formal ethics approval (my own
   documented compositional use, expert walkthrough, annotated session logs) strengthen
   it, and is that acceptable in this department?
5. **What framing should I target?** NIME 2027 (~Jan/Feb) and Audio Mostly are the
   candidate venues; the dissertation framing (HCI-led co-creation vs. controllable
   generation) should probably follow whichever we choose, and I would rather decide
   that with you than retrofit it.

## Milestones, September–December 2026

| Window | Milestone | Done when |
|---|---|---|
| Sep, week 1 | **M0 — restart verification** | environment, tests, build and artifacts all reproduce; baseline state recorded |
| Sep | **M1 — real-model target-track vertical slice** | one narrow path (piano melody → bass) runs through the real model in the UI; committed notes provably untouched; latency logged |
| Oct | **M2 — minimal composable constraint layer** | target instrument, bar range, pitch range, key consistency — independently toggleable, each with property tests and a constraint report |
| Nov | **M3 — replicated baseline evaluation** | multiple inputs, repeats, saved seeds, latency distribution, compliance + muspy metrics, artifact manifest |
| Nov/Dec | **M4 — LoRA go/no-go** | decided against pre-stated criteria; dropping it is an acceptable outcome |

Full plan with acceptance criteria: [PHASE1_RESTART_2026-09.md](PHASE1_RESTART_2026-09.md).
