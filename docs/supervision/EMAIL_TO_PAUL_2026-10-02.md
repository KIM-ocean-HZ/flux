# Email to Paul (draft, 2 October 2026)

Draft for Hanze to review before sending. Attach [RESEARCH_NOTE_FOR_PAUL_2026-10-02.md](RESEARCH_NOTE_FOR_PAUL_2026-10-02.md), exported to PDF. The Chinese working version of the same design is [RESEARCH_DESIGN_2026-10-02.md](../research/RESEARCH_DESIGN_2026-10-02.md).

---

**Subject:** FLUX: proposed scope and research questions after our 30 September meeting

Dear Paul,

Thank you for our meeting on 30 September. You said that either an AI-led or an HCI-led direction would be acceptable, and that fixing the scope and research goal comes first. You also pointed out that a rule-based bass generator would be a substantial project in its own right. I have used both points to narrow the proposal, and I would be grateful for your comments before our next meeting.

**What has changed.** Having gone through the AMT and MIDI-GPT papers and their current public releases, I no longer think FLUX should aim to build a track-level generator. MIDI-GPT can already add a new track to existing ones or fill selected bars, and its authors have integrated it into Cubase, Ableton Live and REAPER. What remains open is reliability: when a musician specifies only part of what they want, does the model do it without changing everything else? MIDI-GPT's controls are learned and soft (in the paper, the median compliance of the polyphony control falls below the authors' 70% target in many settings). I could find no published evaluation of its newer controls, and the MMM-C user study (IJCAI 2023) reports limited controllability and predictability.

**Proposed scope.**

- Short Western pop/rock excerpts (4–8 bars, 4/4) that start from a motif: a melody, a riff or a drum groove. No chord chart is required.
- The musician may optionally specify a few intents (harmony, rhythm, register); anything unspecified is inferred from the motif.
- The first target part is bass, then drums if time allows. The base model is MIDI-GPT at a pinned checkpoint, and the existing FLUX workbench serves as the testbed and demonstration.
- The rule-based generator is no longer a research baseline. Comparisons are against the original human-written part, the model's native output and controls, best-of-N selection, and a random-retrieval floor.

**Research questions.**

- RQ1: In motif-first requests where users specify only some intents, how reliably do pretrained multitrack infilling models satisfy each intent alone and in combination — particularly when the intent departs from the model's default — and at what cost to musical quality?
- RQ2: Can verifier-guided post-training make a single sample satisfy whichever intents are specified as reliably as best-of-N selection, without reducing diversity, and generalise to unseen intent combinations?

Intent compliance is checked by rule-based verifiers, which I will validate before use, including against musicians' judgements. Musical quality is judged by a small blind listening test rather than by the verifiers.

**Where your view would help most.**

1. Is this a defensible individual contribution? I am treating RQ1 as the minimum outcome and RQ2 as the stronger one.
2. The listening test and the verifier-agreement check involve participants. Which ethics route applies, and could I start the application now?
3. Are you comfortable with the human-written parts, rather than a rule-based generator, as the reference point?
4. Is departmental GPU access available for short fine-tuning runs (a few GPU-hours), or should I plan around my laptop and cloud credits?
5. If you know of HCI work on how people express intent and control in creative tools, I would be glad of pointers.

Before our next meeting I plan to run MIDI-GPT locally at a pinned checkpoint, build the development task set, implement and validate the verifiers, and bring the first RQ1 baseline results together with a go/no-go decision on RQ2. A short note with the details is attached.

Best wishes,
Hanze
