> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`docs/PHASE1_RESTART_2026-09.md`。旧里程碑和不做播放等范围限制已失效。随机再生成不保证每次不同；新 tag 只隔离 MIDI/PNG，不隔离 CSV。
> 当前入口：[项目 README](../../../README.md)；[归档纠错索引](../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# FLUX Phase 1 — restart plan, from 2026-09-01

Written 2026-08-24, against the repository state audited on that date. This is an
execution plan: every milestone ends with acceptance criteria that are commands or
observable behaviours, not adjectives.

Ordering rule for the whole phase: **M1 before M2 before M3.** M4 is a decision, not a
commitment. If time runs short, cut from the back.

---

## Milestone 0 — Restart verification (day 1, ~1 hour)

Goal: prove the machine still reproduces the audited state, and freeze that state as
the baseline everything else is compared against.

### Steps

```sh
cd ~/flux
git status                                  # expect the Phase 0 uncommitted set, or a clean tree if it was committed
uv sync                                     # Python 3.12 environment
uv run pytest -q                            # transform-layer property tests
uv run python -m core.transforms            # rewrites data/generated/transforms_demo.mid
cd frontend && npm install && npm run build && cd ..
ls ~/.cache/huggingface/hub | grep music    # model cache
ls data/generated data/results data/essen   # artifacts + dataset
bash scripts/demo_check.sh                  # all of the non-model checks in one pass
```

Offline model check (does not download anything):

```sh
HF_HUB_OFFLINE=1 uv run python -c "
from research.generate import load_amt; m,d = load_amt(); print('offline load ok on', d)"
```

### Acceptance criteria

- [ ] `uv run pytest -q` → `20 passed`.
- [ ] `npm run build` completes with no errors.
- [ ] `uv run python -m core.transforms` rewrites `data/generated/transforms_demo.mid`
      **byte-identically** to the previous file (`md5 -q` before and after match) —
      this is the determinism check, and a mismatch is a real regression.
- [ ] `~/.cache/huggingface/hub` contains `models--stanford-crfm--music-small-800k`
      (and ideally `music-medium-800k`).
- [ ] `data/results/pipeline_metrics.csv` still holds the 8 Phase 0 pilot rows;
      `data/generated/` still holds the four `ab_*` MIDI/PNG pairs.
- [ ] The offline load prints a device and does not touch the network.

### Freeze the baseline

```sh
cp data/results/pipeline_metrics.csv data/results/pipeline_metrics_phase0_baseline.csv
```

Then record, in `docs/worklog_v3_zh.md`, the date, the commit hash, and any deviation
from the checks above. From this point on, **do not append Phase 1 runs to the Phase 0
CSV** — use a new tag or a new file (see M3).

---

## Milestone 1 — Real-model target-track vertical slice (September, first priority)

Goal: one narrow path where the user picks a target instrument in the UI and the ghost
notes come from the real AMT, not the stub.

### Scope (deliberately narrow)

- One path: **piano melody in → bass accompaniment out**. Other targets may appear in
  the selector, but only this path must work.
- Real AMT inference behind the existing `POST /api/suggest`.
- Minimal target-instrument selector in the UI (a `<select>`, no redesign).
- `SuggestRequest` gains an explicit `target_instrument` field (GM program, 128 = drums).
- Committed notes are never modified by a suggestion; ghosts enter committed state only
  via **Accept**.
- Accept / Reject / Regenerate keep working exactly as they do now.
- Per-request inference latency is logged.
- Reuse `research/` — do **not** reimplement generation, control extraction or the
  instrument mask in `backend/`.

### Design issues to settle before writing code

These come out of the 2026-08-24 audit; each one is a real property of the current code.

1. **Input adapter (JSON beats → AMT controls).** `research.pipeline.melody_to_controls`
   reads a **MIDI file** and calls `extract_instruments(events, [0])`. The API receives
   **JSON notes in beats**. Write one small adapter — notes → `muspy.Music` (or a MIDI
   buffer) → `midi_to_events` → `extract_instruments` — in one place, with an explicit
   tempo constant, because beats→seconds needs one. Do not scatter conversions.
2. **Units and types at each boundary.** API = `float` beats; `core/transforms.py` =
   exact `Fraction` beats and *rejects floats*; AMT = wall-clock 10 ms bins. Any code
   that hands API values to `core` must convert explicitly (e.g.
   `Fraction(round(t * 48), 48)`), and the chosen grid resolution must be written down.
3. **Model lifecycle.** Load the model **once** for the application lifetime (FastAPI
   lifespan/startup), never per request. A per-request `load_amt()` would add seconds to
   every suggestion.
4. **Concurrency around the instrument mask.** `instrument_constraint` rebinds the
   module-global `anticipation.sample.instr_logits`, which `add_token` calls as a global.
   Two overlapping requests would corrupt each other's mask. Minimum acceptable fix: a
   process-wide `threading.Lock` around load+generate, plus a comment and a line in the
   README stating that the backend serialises inference. Only refactor the sampler if a
   clean hook exists — otherwise the lock and the documented limitation are the correct
   scope here.
5. **Note also** that the current mask *replaces* the toolkit's own 16-instrument cap
   rather than wrapping it. If that matters, wrap the original instead of discarding it.
6. **Do not oversell the mechanism.** In code comments, docs and the UI, it is an
   allowed-set mask over note tokens plus (if added) a post-hoc filter — not a general
   constraint layer. If a post-hoc filter drops or moves notes, that is **post-processing**
   and must be named separately from constrained decoding.

### Acceptance criteria

- [ ] With **bass** selected, every ghost note returned is structurally on the bass
      target (instrument/program of returned notes, checked programmatically — not by eye).
- [ ] The input melody in the request is returned unchanged / is absent from `ghosts`;
      no committed note is modified by any suggestion.
- [ ] **Regenerate** returns a different ghost set from the previous call for the same input.
- [ ] **Reject** leaves committed notes byte-identical to before the suggestion.
- [ ] **Accept** only appends; no existing note is edited or removed.
- [ ] `cd frontend && npm run build` passes.
- [ ] An automated backend smoke test exists (e.g. `tests/test_backend_smoke.py` using
      `fastapi.testclient`) covering: schema accepts `target_instrument`; ghosts are on
      the requested target; two calls differ; the request's notes are not echoed into ghosts.
      It must run without the model (fixture/monkeypatched generator) so `uv run pytest -q`
      stays fast and offline.
- [ ] Latency is logged per request (a log line or a JSONL file), explicitly labelled as
      instrumentation, **not** presented as a benchmark anywhere.
- [ ] One fixed demo case is documented (fixed input melody + target + settings) that can
      be re-run to show the same behaviour in a meeting.

### Out of scope for M1

Audio playback, MIDI import/export, multiple simultaneous targets, instrument
recommendation, persistence, deployment, UI redesign.

---

## Milestone 2 — Minimal composable constraint layer (October)

Goal: turn "one hard-coded mask" into a small set of constraints the user can switch on
and off independently, each with an auditable report.

### Implementation order

1. **Target instrument** (promote M1's path into a named constraint).
2. **Selected bar range** — generation confined to the bars the user selected.
3. **Instrument pitch range** — e.g. bass confined to a stated MIDI range.
4. **Key consistency** — output pitches in the stated key.
5. **Playability / voice collision** — **only** once "playable" is defined in writing
   (what counts as a collision, what the fix is). If it is not defined, it is not built.

### Requirements

- Each constraint is independently toggleable; the unconstrained path stays available as
  the baseline and must not be deleted.
- Every run emits a **constraint report**: which notes were modified, transposed or
  dropped, by which constraint, and why. The report is data (JSON), not a log line.
- **Decoding-time masking and post-hoc correction are separate mechanisms** and must be
  labelled separately in the report and in the code. Never present a post-processed
  result as constrained decoding.
- Property tests per constraint, in the style of `tests/test_transforms.py`: e.g. bar
  range → no note starts outside the range; pitch range → no note outside the bounds;
  key consistency → `in_key()` holds for every returned note.

### Acceptance criteria

- [ ] Each constraint can be enabled/disabled per request.
- [ ] A run with all constraints off reproduces the unconstrained baseline path.
- [ ] Each constraint has at least one property test asserting its guarantee.
- [ ] The constraint report distinguishes *masked during decoding* from *corrected after
      decoding*, per note.
- [ ] `uv run pytest -q` passes with the new tests.

---

## Milestone 3 — Replicated baseline evaluation (November)

Goal: the first thing in this project that may be called a *result*.

### Conditions

1. Unconstrained model.
2. Instrument-constrained model.
3. Deterministic transformation only.
4. Hybrid (transform + constrained model) — **only** if it is stable by then.

### Protocol requirements

- **Multiple inputs.** Not Twinkle. Draw a stated number of melodies from the Essen
  Folk Song Database (10,457 files available) by a documented, reproducible selection
  rule; keep the sampled set on disk.
- **Seeds fixed or saved.** Every run records its seed so any artifact can be regenerated.
- **Repeats per condition** (a stated n > 1), because sampling is stochastic.
- **Metrics:**
  - target-track compliance rate (fraction of generated notes on the requested target);
  - invalid / out-of-range note rate (including how often `sanitize_events` drops triples);
  - **latency distribution** — median and spread across all runs, never a single number;
  - muspy metrics (`research/metrics.py`) for generated output and reference input.
- **Artifact manifest:** one machine-readable file per campaign listing every run — input
  file, condition, seed, model, settings, output paths, metrics, timing — so any number in
  the write-up traces back to an artifact.
- **Human listening notes** are recorded manually by a human, in a separate file, clearly
  attributed and dated. They are never generated, inferred or fabricated. If no listening
  has happened, the field says so.
- Write to a **new** results file (e.g. `data/results/e1_baseline.csv`), never appending
  to the Phase 0 pilot CSV.

### Acceptance criteria

- [ ] Every reported number is reproducible from the manifest with one command.
- [ ] Latency is reported as a distribution over repeated runs.
- [ ] Compliance and invalid-note rates are computed programmatically, not read off plots.
- [ ] The unconstrained condition is present as a baseline in every comparison.

---

## Milestone 4 — LoRA go/no-go (November–December)

**No LoRA training starts before M3 produces evidence.** This milestone is a written
decision; "no" is a fully acceptable outcome and should be recorded as a finding.

Before any training, state on paper:

1. **Which baseline failure it addresses** — a specific, measured weakness from M3 that
   hard constraints demonstrably cannot fix (e.g. compliance is fine but output density
   or idiom is not).
2. **Success metric and threshold** — what number, measured how, must improve by how much
   for the adaptation to count as working.
3. **Data** — corpus, size, licence, preprocessing, and why it matches AMT's domain.
4. **Cost** — training time on available hardware, storage, and the wall-clock budget
   that may be spent before abandoning.
5. **Non-redundant contribution** — what learned adaptation gives that hard constraints
   do not, stated as a testable claim.
6. **Deadline** — a calendar date for the go/no-go decision, chosen so that a "no" still
   leaves time to write up M1–M3.

### Acceptance criteria

- [ ] The decision is written down with the six points above answered, dated, and
      supported by M3 numbers.
- [ ] If **no-go**: the plan and the write-up are updated to drop LoRA, and the reason
      becomes part of the methodology narrative.
- [ ] If **go**: training runs against pre-registered criteria, and results are reported
      against the *same* evaluation protocol as M3 — no new metric invented afterwards.

---

## Standing rules for the phase

- Do not append experimental runs to `data/results/pipeline_metrics.csv`; it is the
  Phase 0 pilot record.
- Do not describe a mask as a guarantee, a single timing as a benchmark, a pilot as a
  result, or a structural check as a musical judgement.
- `data/` is gitignored: anything that must survive a fresh clone belongs in `docs/` or
  in code.
- Keep `core/` free of model code and I/O — its value is that it is exact and testable.
