# C1 — Draft email to Dr. Anna Shvets (§3.8 open questions)

> Draft only — review, adjust tone/details, and send from your own account.
> Status update reflects actual Phase 0 results in this repo.

---

**Subject:** FLUX project — Phase 0 complete; five methodology questions before Phase 1

Dear Dr. Shvets,

I hope you are well. Over the past weeks I have completed the foundation phase of
the project we discussed, and I would like to confirm a few methodology decisions
with you before starting the fine-tuning work.

**Where the project stands.** I have a reproducible `uv` environment (Python 3.12)
with the full pipeline running end-to-end on my machine: the Anticipatory Music
Transformer (Stanford CRFM, `music-small-800k`) generates accompaniment for a
given melody via its control-token mechanism, the output is written to MIDI, and
muspy computes objective metrics (pitch-class entropy, scale consistency, pitch
range, polyphony, groove consistency, etc.), logged to CSV. Generation currently
runs at roughly real-time speed on Apple Silicon (about 6.4 s to accompany a 7 s
melody), which is encouraging for the interactive/on-device angle. As a starter
dataset I am using the Essen Folk Song Database (10,457 monophonic melodies) as a
pool of input melodies, loaded through muspy.

**My questions:**

1. **ComfyUI.** You mentioned ComfyUI as a possible experimentation harness. Since
   my pipeline is symbolic (MIDI/event tokens) and the evaluation tools are
   symbolic too, I could not find an obvious fit — did you have a specific
   symbolic-music workflow in mind, or would you be comfortable with a plain
   Hugging Face `transformers` + `peft` pipeline instead?

2. **Base model.** Is the Anticipatory Music Transformer acceptable as the base
   model? It is open (Apache 2.0), multi-track, runs locally, and its
   control-token design maps directly onto the accompaniment and conditioned-
   continuation behaviors I need. The alternatives I considered (Music
   Transformer, MMM) seem weaker on either conditioning or tooling.

3. **Dataset for fine-tuning.** For LoRA fine-tuning I am considering a subset of
   the Lakh MIDI dataset (AMT's own training domain) — possibly genre-scoped to
   keep it tractable. Does that sound right, or would you recommend a different
   corpus?

4. **Evaluation.** The original mgeval is Python-2-era and does not install on
   modern macOS, so I am using muspy's built-in objective metrics as the main
   line (they cover the same musically-informed families). Is that sufficient,
   or do you want a specific mgeval metric (e.g., pitch-class transition
   matrices) reproduced? Relatedly: do you envision a small user study later, or
   are objective metrics sufficient for the dissertation?

5. **Target venue.** For the paper draft, which venue would you suggest aiming at
   (NIME, AIMC, TENOR, EVA...)? Knowing the deadline would help me plan the
   experiment schedule backwards from it.

I would be happy to show the running pipeline in a short meeting if useful.

Best regards,
Hanze (Ocean) Jin

---

*Repo state backing this email: see `research/pipeline.py` (end-to-end),
`docs/mgeval_decision.md` (Q4), `docs/representation_decision.md` (Q2/Q3).*
