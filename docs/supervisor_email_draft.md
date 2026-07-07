# Follow-up email to Dr. Shvets (draft — review and send from your own account)

> Context: first email sent mid-June, no reply after ~3 weeks. This one is a
> follow-up: short progress report, decisions taken by default where possible,
> and a single main question so it can be answered in one line.

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
