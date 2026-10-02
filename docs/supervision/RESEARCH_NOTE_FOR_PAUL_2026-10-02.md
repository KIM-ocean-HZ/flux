# FLUX: Proposed Research Design

Hanze Jin · 2 October 2026 · Draft for comment · Replaces the brief of 29 September

## 1. Position

FLUX is a browser MIDI workbench in which musicians develop material they have already started. The generation capability it originally aimed for already exists:

- **MIDI-GPT** (AAAI 2025) adds tracks to existing ones and fills selected bars, with attribute controls. Its authors have integrated it into Cubase (research version), Ableton Live (MMM4Live) and REAPER.
- **The Anticipatory Music Transformer** (TMLR 2024) supports instrument and time-span infilling.

The open problem is reliable control when a musician specifies only part of what they want:

- MIDI-GPT's controls are learned and soft. In the paper, the median compliance of the polyphony control falls below the authors' 70% target in many settings.
- Its newer controls (key, pitch range, per-bar pitch-class sets) have no published evaluation that I could find. In a related model (MMT), a 2026 activation-steering study found that controlling several attributes at once causes interference.
- MMM-C users reported limited controllability and predictability (IJCAI 2023). Practising musicians want fine-grained control and DAW integration (Krol et al., CHI 2025).

Harmony is treated as an optional, inferable and editable intent rather than a required input. This follows how commercial tools derive chord tracks from existing material, for example Logic Pro's Chord ID (2026).

## 2. Scope

- **Input:** one or two motif tracks (melody, riff or drum groove), 4–8 bars, 4/4, Western pop/rock.
- **Intents,** all optional and automatically checkable:
  - harmony: none, key only, a few chords, or an inferred chord track the user has edited;
  - rhythm: density, or alignment to another track such as the kick drum;
  - register: pitch range.
- **Target:** bass first; drums second, to test intents that do not involve harmony.
- **Model:** MIDI-GPT at a pinned checkpoint; AMT optional as a second representation.

**Why bass.** Both harmonic and rhythmic intents apply and can be checked, the part is monophonic, and errors are clearly audible. It is also the role where explicit harmony should matter most, so a null result there is informative.

**Why pop.** The model's training data are pop-heavy, as its authors state, so failures reflect control rather than an unfamiliar style. Clear chord changes also make the verifiers more accurate. Two safeguards come with this choice:

- To avoid ceiling effects, the test set deliberately includes atypical intents (borrowed chords, inversions, pushed or syncopated rhythms, single-chord edits). Results are reported by how far an intent departs from the model's default.
- To avoid training-data contamination, test pieces are original or newly written.

## 3. Research questions

- **RQ1:** In motif-first requests where users specify only some intents, how reliably do pretrained multitrack infilling models satisfy each intent alone and in combination — particularly when the intent departs from the model's default — and at what cost to musical quality?
- **RQ2:** Can verifier-guided post-training make a single sample satisfy whichever intents are specified as reliably as best-of-N selection, without reducing diversity, and generalise to unseen intent combinations?

## 4. Method

Tasks come from real multitrack MIDI (for example Slakh2100). Each task:

1. keeps the motif tracks;
2. removes the target part and computes its attributes;
3. asks the model to regenerate the part from the motif plus a subset of those attributes.

Some combinations of intents are held out of training to test generalisation. Splits are by piece.

| Condition | Description | Purpose |
|---|---|---|
| C0 | Motif only | Native behaviour; whether harmony needs to be explicit |
| C1 | Inferred chord track supplied as a temporary guide track | Value of an explicit harmonic plan |
| C2 | Native attribute controls plus hard pitch and rhythm masks | Native control and its musical cost |
| C3 | Best-of-N selection with the same verifier | Upper bound without training |
| P1 | Rejection-sampling fine-tuning: keep high-scoring samples and retrain with the standard objective | Simplest post-training |
| P2 | DPO on high- versus low-scoring pairs | Stronger post-training (optional) |

## 5. Verifiers and their validation

**Design.**

- The same attribute function defines each intent (from the human part) and scores the output, with tolerances. Human parts therefore score near the top by construction, and random retrieval scores low.
- **Harmony:** the bass note at each chord onset, including inversions; the proportion of strong-beat chord tones, within the range observed in the human part. Stepwise passing tones on weak beats are not penalised, and a small anticipation window is allowed.
- **Rhythm and register:** onset alignment with a reference track, notes per bar within a band, and pitch range.
- **Guards:** non-empty output, no copying of context tracks, and penalties for repetition and silence.
- C0 outputs are not scored against the original chords, because a melody admits several harmonisations. They are judged by melody–bass consonance and by listening.

**Validation before use.**

1. True chord labels must score clearly higher than shuffled ones.
2. Scores must agree with two or three musicians' ratings on 40–60 clips (subject to ethics approval).
3. Degenerate outputs (root whole-notes, copies, random in-key notes) must not score highest.
4. The chord recogniser is checked against POP909's annotated chords.

**Precedents.**

- FIGARO (ICLR 2023) evaluates controllable generation with rule-extracted attributes (chord F1 0.593, against 0.184 for the strongest baseline).
- Yeh et al. (JNMR 2021) found rule-based harmonicity metrics consistent with a 202-participant study, while still recommending human evaluation for final judgements.
- ReaLchords (ICML 2024) raised the proportion of melody notes within the chord from 36.99% to 54.29% using RL with rule penalties, and confirmed the gain with musicians.
- MusicRLVR (2026 preprint) used rule-based verifiers alone as RL rewards (joint constraint satisfaction 0.16 to 0.81).
- SMART (2025) shows diversity collapse under a vaguer learned reward, which is why diversity is monitored here.

## 6. Measures

- Compliance by intent type, combination and atypicality; first-attempt and retry-assisted results reported separately.
- Musical quality from a blind listening test (harmonic fit, rhythmic fit, usefulness; ties and "neither usable" allowed).
- Diversity across repeated samples.
- Latency, cold and warm, for one sample and for N samples.
- Empty and degenerate output rates.
- All candidates, failures and seeds are kept, and checkpoints are pinned by hash.

## 7. Plan

| Weeks | Work | Gate |
|---|---|---|
| 2–14 Oct | Pinned MIDI-GPT running locally; development task set; verifiers implemented and validated; C0–C2 baselines; ethics application | Verifiers validated; a compliance gap on atypical intents; acceptable local speed |
| 15 Oct–4 Nov | C3; rejection-sampling fine-tuning; optional DPO | Single-sample compliance near best-of-N without loss of diversity |
| 5–18 Nov | Frozen settings; test-set evaluation; listening test if approved; latency | Complete result tables, failure cases and audio examples |
| 19 Nov–2 Dec | Integration in FLUX; demonstration video; report or preprint | Stable demonstration and report |
| 3–15 Dec | Buffer; interim report; drums as a second role if time allows | — |

## 8. Risks and fallbacks

- If native controls already succeed on atypical intents, RQ2 is dropped and the work becomes a benchmark of models and control mechanisms on DAW-style requests.
- If the training loop is hard to integrate, rejection-sampling fine-tuning alone is used, since it needs only the standard objective; DPO is optional.
- If ethics approval cannot fit the timeline, the technical evaluation and my own annotated examples remain, with correspondingly narrower claims about musical quality.
- MIDI-GPT weights are licensed CC-BY-NC-4.0. They are fine for research, but a commercial FLUX would need another model (AMT is Apache-2.0) or a licence.

## 9. Out of scope

- Whole-song generation and long-range motif development.
- Training a new foundation model.
- A full DAW or plugin host.
- LLM-based arrangement.
- A large user study.

## References

- Pasquier et al., MIDI-GPT, AAAI 2025. arXiv:2501.17011
- Thickstun et al., Anticipatory Music Transformer, TMLR 2024. arXiv:2306.08620
- Bougueng Tchemeube et al., MMM-C, IJCAI 2023
- Krol et al., co-design with practising musicians, CHI 2025. arXiv:2502.09055
- von Rütte et al., FIGARO, ICLR 2023. arXiv:2201.10936
- Yeh et al., melody harmonisation comparative study, JNMR 2021. arXiv:2001.02360
- Wu et al., ReaLchords, ICML 2024. arXiv:2506.14723
- Liu et al., MusicRLVR, 2026. arXiv:2609.23665
- Jonason et al., SMART, 2025. arXiv:2504.16839
- Rafailov et al., Direct Preference Optimization, 2023. arXiv:2305.18290
- Sessa et al., BOND (best-of-N distillation), 2024. arXiv:2407.14622
- Activation steering for multi-attribute control in MMT, 2026. arXiv:2605.31295
