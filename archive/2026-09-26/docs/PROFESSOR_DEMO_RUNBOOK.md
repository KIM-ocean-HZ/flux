> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`docs/PROFESSOR_DEMO_RUNBOOK.md`。旧版演示流程，不能作为当前产品能力或下一阶段计划。端口启动方式已有更新。
> 当前入口：[项目 README](../../../README.md)；[归档纠错索引](../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# FLUX — demo runbook (5–7 minutes)

Written 2026-08-24. Purpose: run a reliable live demo of the current state for the
incoming supervisor, without overclaiming. Every command below was executed on the
development machine on 2026-08-24 and behaved as described.

---

## Pre-flight (do this ~10 minutes before, not in front of the professor)

```sh
cd ~/flux
git status                       # know what is uncommitted before you screen-share
bash scripts/demo_check.sh       # tests + build + transform demo + backend smoke + artifacts
```

Expect: `20 passed`, a successful `vite build`, `data/generated/transforms_demo.mid`
rewritten, backend smoke `200`, and all pilot artifacts reported present.

Also check, in this order:

1. **Artifacts exist** (they are gitignored, so a fresh clone has none):
   `ls data/generated/ab_*.png data/generated/transforms_demo.mid data/results/pipeline_metrics.csv`
2. **Model cache present**, if you intend to show the model path:
   `ls ~/.cache/huggingface/hub | grep music` → `music-small-800k`, `music-medium-800k`.
   If missing, **do not download during the meeting** (~489 MB / ~1.3 GB). Fall back to
   the existing artifacts.
3. **A MIDI player is open and works** (e.g. `open data/generated/transforms_demo.mid`
   in your usual DAW/player). Test playback beforehand — a silent player is the most
   likely on-camera failure.
4. **Ports free:** `lsof -ti:8000; lsof -ti:5173` → both empty.

## Terminals to open

| Terminal | Working dir | Command | Leave running |
|---|---|---|---|
| 1 | `~/flux` | `uv run uvicorn backend.main:app --reload --port 8000` | yes |
| 2 | `~/flux/frontend` | `npm run dev` → http://localhost:5173 | yes |
| 3 | `~/flux` | for the transform demo and tests | no |

Start terminals 1 and 2 **before** sharing your screen; only terminal 3 is used live.

---

## Demo sequence

### 1. One line (~20 s)

> "FLUX is a human–AI symbolic-music co-creation system that helps musicians develop
> material they have already written, rather than generating complete pieces for them.
> Two suggestion sources: exact deterministic transforms, and a constrained model.
> Everything the user wrote is non-destructive — suggestions arrive as ghost notes."

### 2. The deterministic transforms (~90 s)

Terminal 3:

```sh
uv run python -m core.transforms
```

**You should see** the bar map printed:

```
bar  1: original motif
bar  4: sequence: diatonic, down a step, x2
bar  9: inversion: diatonic around C4
bar 12: retrograde
bar 15: augmentation: x2
bar 20: diminution: x1/2
bar 22: fragmentation: notes 4-6 (A A G), x3
Wrote data/generated/transforms_demo.mid
```

Then play `data/generated/transforms_demo.mid` (58 notes, 24 bars, 110 BPM).

Say: exact rational time (`Fraction`) — floats are rejected at the type boundary, so
grid drift is impossible by construction, not fixed by quantisation afterwards; and
diatonic mode inverts by *scale degree*, which is how the inversion can be both an
exact mirror and in key.

### 3. The property tests (~40 s)

```sh
uv run pytest -q          # 20 passed
```

Say what they pin, not just the number: exact interval/degree relations,
`retrograde ∘ retrograde = identity`, bar/beat alignment, in-key output in diatonic
mode, and purity (inputs never mutated).

### 4. The constrained-decoding pilot (~90 s)

```sh
open data/generated/ab_small_free.png data/generated/ab_small_constrained.png
open data/results/pipeline_metrics.csv        # or: column -s, -t < data/results/pipeline_metrics.csv
```

**You should see** the unconstrained piano roll scattered across many instruments and
the constrained one confined to the allowed set.

Say, plainly:

- The constraint masks note-token logits so the sampler may only use an **allowed
  instrument set** {piano, acoustic bass, drums}.
- This is a **2×2 pilot: one run per condition, one input melody, no repeats, no fixed
  seed**. Unconstrained runs scattered across 9–15 instruments; constrained runs stayed
  inside the allowed set.
- Two honest caveats, said out loud: the constrained runs never actually used bass — an
  allowed set is **not** a target-track guarantee — and the medium constrained run
  produced only about four new notes, i.e. the constraint can starve the output.
- The `gen_seconds` column is **four single measurements**, not a benchmark.

If asked about musical quality: *"I have verified structure, not sound quality — that
requires human listening assessment, which I haven't recorded yet."*

### 5. The Ghost UI (~90 s)

Browser → http://localhost:5173 (already running).

- The default melody is on the grid. Click the grid to add a note, click a note to
  delete it.
- **Suggest** → translucent ghost notes appear under the melody.
- **Regenerate** → a visibly different set of ghosts.
- **Reject** → ghosts vanish; the melody is untouched.
- **Suggest** again, then **Accept** → ghosts become committed notes, appended; nothing
  the user wrote was overwritten.

### 6. Say the stub sentence — do not skip this (~20 s)

> "To be clear: this backend is a **stub**. It returns randomised intervals below the
> input notes — it does not call the model. The interface is the real one; the
> internals are fake. Connecting the real model behind this interaction is the first
> September milestone."

Optionally show the six lines of `backend/main.py:suggest` — it makes the honesty
concrete and takes ten seconds.

### 7. September plan (~60 s)

Open [PHASE1_RESTART_2026-09.md](PHASE1_RESTART_2026-09.md) and show **M1** only:
target instrument in the API schema and the UI, one narrow path (piano melody → bass),
real AMT inference, committed notes provably untouched, latency logged per request.
Then say the sequence after it in one breath: constraint layer → replicated baseline →
LoRA go/no-go, where dropping LoRA is an acceptable outcome.

Close with the questions from [SUPERVISOR_HANDOVER_2026-09.md](SUPERVISOR_HANDOVER_2026-09.md).

---

## Fallbacks

| Failure | Fallback |
|---|---|
| Vite dev server won't start | Show the pilot PNGs and `frontend/src/App.jsx`; describe the interaction. Do **not** use `npm run preview` — it serves the built bundle **without** the `/api` proxy, so **Suggest** will fail on camera. |
| Backend won't start (port busy) | `lsof -ti:8000 \| xargs kill`, restart. If it still fails, the UI still renders and notes can be drawn — Suggest will show an error; explain it is a stub anyway. |
| `/api/suggest` returns an error in the browser | In terminal 3: `curl -s -X POST http://localhost:8000/api/suggest -H 'Content-Type: application/json' -d '{"notes":[{"pitch":60,"time":0,"duration":1,"velocity":80}]}'` — showing the JSON ghosts is an acceptable substitute. |
| Model won't load / no cache / no network | Do not download. Use the existing pilot artifacts and CSV; say the model path is verified offline on this machine and is reproducible with `uv run python -m research.ab_test`. |
| MIDI player silent | Show the printed bar map and the piano-roll PNGs; say the artifact is on disk and can be sent afterwards. |
| Tests fail unexpectedly | Say so, show the failure, and move on — do not debug live. |

---

## 60–90 second compressed version

1. **(15 s)** "FLUX helps musicians develop material they have already written, rather
   than generating pieces for them. Suggestions are non-destructive ghost notes the
   user accepts, rejects or regenerates."
2. **(20 s)** `uv run pytest -q` → "20 property tests pin six deterministic motivic
   transforms: exact interval relations, exact rational time, bar alignment, in-key
   output."
3. **(20 s)** Show `ab_small_free.png` next to `ab_small_constrained.png`: "constrained
   decoding keeps generation inside the instruments the user allows. That is a pilot —
   one run per condition — not a result."
4. **(20 s)** Browser: **Suggest → Regenerate → Accept**. "This interaction is real;
   the backend behind it is still a stub."
5. **(15 s)** "September's first milestone replaces that stub with the real model on
   one narrow path — melody in, bass suggestion out, with the user's notes provably
   untouched."

---

## Claims not to make

- ❌ "The demo generates with the model." → It is a stub.
- ❌ "Suggestions are guaranteed to land on the instrument you choose." → The
  implemented constraint restricts an **allowed set**; there is no target-instrument
  guarantee, and in the pilot no bass note was ever produced.
- ❌ "Generation takes ~0.3 s." → Four single measurements, one machine, no repeats.
- ❌ "The evaluation shows constrained output is better." → No formal evaluation has
  been run; no statistics exist.
- ❌ "It sounds good / musically coherent." → No listening assessment has been recorded.
- ❌ "The model is fine-tuned / adapted / LoRA-trained." → No training has been started.
- ❌ "The transform layer feeds the model." → They are not connected yet.
