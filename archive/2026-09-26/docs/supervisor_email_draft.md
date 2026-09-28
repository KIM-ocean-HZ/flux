> **历史归档 · 2026-09-26 · 不作为当前执行指令。**
> 原位置：`docs/supervisor_email_draft.md`。已发送并于 2026-07-07 收到回复的通信归档，不是待发邮件。目标轨硬保证表述不成立，会议日期未作本轮核实，文中计划微调没有完成。
> 当前入口：[项目 README](../../../README.md)；[归档纠错索引](../../README.md)。正文保留历史原文，相对路径和旧命令按原位置解释。

<!-- ARCHIVED ORIGINAL BELOW -->
# Follow-up email to Dr. Shvets — SENT; replied 2026-07-07

> **Status: closed.** Reply received 2026-07-07. Key answers, as recorded in the
> project plan (§3.8):
> - June–July busy for her (conference presentations + grant finalisation) — the
>   earlier silence was workload, not disinterest.
> - "Good progress, choices seem reasonable" → base model / pipeline / dataset
>   defaults endorsed.
> - **RQ direction delegated:** "It's your project… decide based on what you find
>   most interesting and feasible." Working decision: RQ-a primary, RQ-b second axis.
> - **User study ruled out** (ethics approval impractical in scope) → study the
>   interaction aspect **through objective evaluation** (E5 reframed).
> - Venues: check deadlines myself → checked 2026-07-07: NeurIPS Creative AI
>   Aug 3 2026 (stretch); NIME 2027 ~Jan/Feb (main target); AIMC 2027 (backup).
>
> Original draft kept below for the record.

---

**Subject:** Re: FLUX — kicking off Phase 0, a few questions to align the methodology

Dear Dr. Shvets,

Following up on my email from mid-June — I know summer is a busy time, so rather
than wait I kept going and made the calls I felt I could make on my own. I'd
rather show you something concrete anyway. Three weeks in, this is where the
project stands:

- The pipeline now runs end to end on my laptop: a melody goes in, the model
  generates accompaniment around it, and muspy computes objective metrics
  (pitch-class entropy, scale consistency, polyphony and so on) into a CSV.
- For the base model I went with the Anticipatory Music Transformer (Stanford's
  music-small/medium-800k checkpoints). Its control-token mechanism does
  accompaniment and infilling natively, which maps directly onto the vertical/
  horizontal suggestions from my May draft. Apache-2.0, runs fully locally.
- Speed looks promising for the real-time angle: about 6.4s to generate 7s of
  accompaniment on my M-series MacBook, before any optimisation.
- ComfyUI: I tried to see how it would fit a symbolic pipeline and couldn't find
  a clean way (it is quite diffusion/image-centric, and the evaluation tools are
  all symbolic), so I defaulted to plain HuggingFace + peft as I mentioned I
  might. Very happy to revisit if you had a specific workflow in mind.
- mgeval would not build on modern macOS (Python-2-era dependencies), so muspy's
  built-in metrics are my main line for now. For data I'm using the Essen
  folk-song database (10k monophonic melodies) as evaluation inputs, and I plan
  a Lakh MIDI subset for the LoRA fine-tuning, since that is AMT's training
  domain.

The one question I would really value your judgment on: from the first hands-on
results I can see three places the dissertation's contribution could sit, and
I'm unsure which is the most defensible —

(a) **control**: comparing mechanisms for track-targeted generation — soft
control via control tokens, hard constrained decoding (masking the sampler so
generated notes can only land on the instrument the user chose — I have a first
prototype of this working), and LoRA-learned control — evaluated on objective
metrics;

(b) **efficiency**: the quality-vs-latency trade-off for interactive use on
consumer hardware — as far as I can tell the symbolic generation literature
almost never measures latency;

(c) **interaction**: whether suggest-but-never-impose actually helps a
producer's sense of control — though I suspect a proper user study is too much
on top of the rest for one year.

Even a one-line steer on which axis looks strongest to you would set my
direction for the next month. The two smaller questions from June still stand
(are objective metrics alone defensible; which venue and deadline should I
shape the paper draft toward — NIME, AIMC?).

I'll keep going in the meantime — next up is a batch baseline over the Essen
melodies and a first LoRA fine-tune. If a short call is easier than email, I'm
free whenever suits you, and I can show the pipeline running.

Best regards,
Hanze Jin
