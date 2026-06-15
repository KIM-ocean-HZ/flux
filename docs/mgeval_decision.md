# V2 — Evaluation tooling decision: muspy as the main line

**Decision (one line):** Use **muspy's built-in objective metrics as the primary,
load-bearing evaluation**; do **not** hard-depend on the original `mgeval`.

## Why

- The original [`mgeval`](https://github.com/RichardYang40148/mgeval) is from the
  Python-2 era and depends on `python-midi`, which is unmaintained and has known
  install problems on modern macOS / Apple Silicon. Fighting it would burn days
  for no methodological gain.
- `muspy` is actively maintained, installs cleanly under `uv`, and already gives
  the musically-informed metrics we need (pitch-class entropy, scale consistency,
  pitch range, pitches used, polyphony, groove consistency, empty-beat rate). These
  cover both *absolute* metrics (describe one set) and the building blocks for
  *relative* comparisons (reference vs generated distributions). See
  [research/metrics.py](../research/metrics.py).

## Fallback / optional

- If a reviewer specifically wants the classic `mgeval` metric set (e.g. pitch-class
  *transition matrices*, note-length transition matrices) we will try a **modern
  reimplementation** such as `lucainiaoge/midi-obj-eval`, in an isolated step, rather
  than the Python-2 original.
- This is optional and must not block the pipeline. muspy stays the main line.
