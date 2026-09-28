> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`docs/representation_decision.md`。“10 ms 编码无损覆盖网格”表述过强。秒制量化可能损失节奏精度，当前 AMT 转换还不能保留独立同音色轨道身份及全部 MIDI 表情。
> 当前入口：[项目 README](../../../README.md)；[归档纠错索引](../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# D2 — Initial music representation: align with AMT's arrival-time event encoding

**Decision (one line):** For everything that touches the model, use the AMT
(anticipation) **arrival-time event encoding** unchanged; use **muspy `Music`
objects** as the neutral interchange for metrics and datasets; use a simple
**note list (JSON)** only at the frontend boundary.

## The encoding

Each note is 3 tokens (`EVENT_SIZE = 3`): **arrival time** (100 bins/second,
`TIME_RESOLUTION = 100`), **duration** (same bins, max 10 s), and **note** =
`instrument × 128 + pitch` (128 pitches × 129 instruments incl. drums). Control
tokens are the same triple shifted by `CONTROL_OFFSET` — this is the mechanism
behind accompaniment (`extract_instruments` re-tags a melody as controls and
`generate` anticipates them).

## Why align rather than design our own

- **Zero re-tokenization risk.** The base model (`stanford-crfm/music-small-800k`)
  was trained on exactly this vocabulary. Any custom representation would require
  retraining or an error-prone conversion layer — the opposite of Phase 0's goal.
- **Control is already first-class.** The encoding's control-token offset is
  precisely the conditioning hook the FLUX behaviors need (vertical accompaniment
  now; horizontal development via control tokens later, §3.3 of the plan).
- **Multi-track and time-resolution fit.** 10 ms bins and instrument-qualified
  notes cover the DAW-grid use case without lossy quantization at this stage.

## Boundaries

| Layer | Representation |
|---|---|
| Model in/out | AMT event tokens (3 per note) |
| Metrics / datasets | muspy `Music` (from MIDI) |
| Frontend ⇄ backend | JSON notes `{pitch, time, duration, velocity}` in beats |
| Interchange on disk | MIDI files |

## Revisit condition

If Phase 1 fine-tuning needs bar/beat-aware control (the encoding is
wall-clock-based, not metrical), revisit with the supervisor — options include
control tokens for meter or a beat-aligned preprocessing step. Recorded here so
the trade-off is explicit, not accidental.
