// Context analysis derived from the chord track and pitched notes: key candidates, Roman
// numerals, progression labels. Nothing here is stored as a chord fact; results carry the
// input revision they were computed from.

import {
  chordPcs, chordType, displaySpelling, isDiatonicChord, MINOR_THIRD_QUALITIES, scalePcs,
} from './chords.js'
import { m } from '../i18n/translate.js'
import { accentAt, PPQ } from './time.js'

export const ANALYSIS_VERSION = 'phase-a-1'

const mod12 = (n) => ((n % 12) + 12) % 12
const MAJOR_TONIC = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_TONIC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

export const ALL_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap((pc) => [
  { tonicPc: pc, tonicSpelling: MAJOR_TONIC[pc], mode: 'major' },
  { tonicPc: pc, tonicSpelling: MINOR_TONIC[pc], mode: 'minor' },
])

export const keyLabel = (key) => m(key.mode === 'major' ? 'key.major' : 'key.minor', { tonic: displaySpelling(key.tonicSpelling) })
export const sameKey = (a, b) => !!a && !!b && a.tonicPc === b.tonicPc && a.mode === b.mode

// Krumhansl–Kessler key profiles.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const isMinorThird = (chord) => MINOR_THIRD_QUALITIES.has(chord.quality)
const isDominantType = (chord) => ['maj', '7', '9'].includes(chord.quality)
const modeMatches = (chord, key) => (key.mode === 'minor' ? isMinorThird(chord)
  : ['maj', '7', 'maj7', '6', '9'].includes(chord.quality))

function correlation(xs, ys) {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}

/** Duration × metric-accent weighted pitch-class histogram. */
function pitchProfile(notes, timeSignature) {
  const hist = new Array(12).fill(0)
  for (const n of notes) {
    const accent = accentAt(n.startTick, timeSignature)
    const w = accent === 'bar' ? 1.5 : accent === 'beat' ? 1.2 : 1
    hist[mod12(n.pitch)] += (n.durationTick / PPQ) * w
  }
  return hist
}

const isDiatonic = isDiatonicChord
const parallel = (key) => ({ ...key, mode: key.mode === 'major' ? 'minor' : 'major' })

const sameChord = (a, b) => a.rootPc === b.rootPc && a.quality === b.quality && a.bassPc === b.bassPc
  && (a.additions ?? []).join() === (b.additions ?? []).join()

/** Is chord i a dominant-type chord resolving down a fifth to a diatonic, non-tonic target? */
function secondaryTarget(chords, i, key) {
  const c = chords[i].chord
  let j = i
  // A repeated chord is one harmony: look past repeats that follow without a gap.
  while (chords[j + 1]?.chord && sameChord(chords[j + 1].chord, c)
    && chords[j + 1].startTick - (chords[j].startTick + chords[j].durationTick) <= PPQ) j++
  const next = chords[j + 1]
  if (!isDominantType(c) || !next?.chord || next.startTick - (chords[j].startTick + chords[j].durationTick) > PPQ) return null
  if (next.chord.rootPc !== mod12(c.rootPc + 5) || next.chord.rootPc === key.tonicPc) return null
  return isDiatonic(next.chord, key) ? next : null
}

const isBorrowed = (chord, key) => !isDiatonic(chord, key)
  && [...chordPcs(chord)].every((pc) => scalePcs(parallel(key)).has(pc))

/** How well a chord sequence sits in a key: diatonic 1, explained chromatic chords partial credit. */
function chordFit(chords, key) {
  let total = 0, fit = 0
  chords.forEach((e, i) => {
    const w = Math.min(e.durationTick / PPQ, 8)
    total += w
    if (isDiatonic(e.chord, key)) fit += w
    else if (secondaryTarget(chords, i, key)) fit += 0.75 * w
    else if (isBorrowed(e.chord, key)) fit += 0.6 * w
  })
  return total ? fit / total : 0
}

function cadenceBonus(chords, key) {
  if (!chords.length) return 0
  let bonus = 0
  const first = chords[0].chord, last = chords[chords.length - 1].chord
  if (first.rootPc === key.tonicPc && modeMatches(first, key)) bonus += 0.08
  if (last.rootPc === key.tonicPc && modeMatches(last, key)) bonus += 0.15
  const vi = (a, b) => isDominantType(a) && a.rootPc === mod12(key.tonicPc + 7)
    && b.rootPc === key.tonicPc && modeMatches(b, key)
  if (chords.length >= 2 && vi(chords[chords.length - 2].chord, last)) bonus += 0.1
  else if (chords.some((e, i) => i > 0 && vi(chords[i - 1].chord, e.chord))) bonus += 0.04
  return bonus
}

/**
 * Rank all 24 keys. status: 'insufficient' (an isolated chord or too few notes — no unique key),
 * 'ambiguous' (top two within 0.05), else 'suggested'. Scores only order candidates.
 */
export function keyCandidates(chords, notes, timeSignature) {
  const pitched = chords.filter((e) => e.chord)
  const hist = pitchProfile(notes, timeSignature)
  const useProfile = notes.length >= 4
  const scored = ALL_KEYS.map((key) => {
    const profile = KK_MAJOR.map((_, i) => (key.mode === 'major' ? KK_MAJOR : KK_MINOR)[mod12(i - key.tonicPc)])
    const r = useProfile ? correlation(hist, profile) : 0
    const score = pitched.length
      ? chordFit(pitched, key) + cadenceBonus(pitched, key) + 0.2 * r
      : r
    return { ...key, score }
  }).sort((a, b) => b.score - a.score)
  const distinctRoots = new Set(pitched.map((e) => e.chord.rootPc)).size
  const distinctPcs = hist.filter((w) => w > 0).length
  let status = 'suggested'
  if (distinctRoots < 2 && distinctPcs < 5) status = 'insufficient'
  else if (scored[0].score - scored[1].score < 0.05) status = 'ambiguous'
  return { status, candidates: scored }
}

const MAJOR_DEGREES = { 0: ['', 'I'], 1: ['♭', 'II'], 2: ['', 'II'], 3: ['♭', 'III'], 4: ['', 'III'], 5: ['', 'IV'],
  6: ['♯', 'IV'], 7: ['', 'V'], 8: ['♭', 'VI'], 9: ['', 'VI'], 10: ['♭', 'VII'], 11: ['', 'VII'] }
const MINOR_DEGREES = { 0: ['', 'I'], 1: ['♭', 'II'], 2: ['', 'II'], 3: ['', 'III'], 4: ['♯', 'III'], 5: ['', 'IV'],
  6: ['♯', 'IV'], 7: ['', 'V'], 8: ['', 'VI'], 9: ['♯', 'VI'], 10: ['', 'VII'], 11: ['', 'VII'] }
const DIGIT = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 }
const QUALITY_TEXT = { maj: '', min: '', dim: '°', aug: '+', 7: '7', maj7: 'maj7', m7: '7', sus2: 'sus2',
  sus4: 'sus4', 6: ' add6', m6: ' add6', 9: '9' }
const TRIAD_FIGURES = { 3: '⁶', 5: '⁶₄' }
const SEVENTH_FIGURES = { 3: '⁶₅', 5: '⁴₃', 7: '⁴₂' }
const BASS_DEGREE_TEXT = { 3: m('roman.bass3'), 5: m('roman.bass5'), 7: m('roman.bass7') }

/** Roman numeral of a chord in a key; keeps quality, additions and inversion visible. */
export function romanNumeral(chord, key) {
  const [acc, numeral] = (key.mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES)[mod12(chord.rootPc - key.tonicPc)]
  const minor = isMinorThird(chord)
  const base = acc + (minor ? numeral.toLowerCase() : numeral)
  const additions = (chord.additions ?? []).map((a) => ` ${a}`).join('')
  let figure = ''
  let bassText = null
  if (chord.bassPc != null) {
    const tone = chordType(chord).tones.find(([s]) => mod12(chord.rootPc + s) === chord.bassPc)
    const degree = tone?.[1]
    const figures = ['7', 'maj7', 'm7'].includes(chord.quality) ? SEVENTH_FIGURES
      : ['maj', 'min', 'dim', 'aug'].includes(chord.quality) ? TRIAD_FIGURES : {}
    figure = figures[degree] ?? ''
    bassText = BASS_DEGREE_TEXT[degree] ?? m('roman.bassOther', { bass: displaySpelling(chord.bassSpelling) })
    if (!figure) figure = `/${displaySpelling(chord.bassSpelling)}`
  }
  let qualityText = QUALITY_TEXT[chord.quality]
  // Inverted sevenths: the figure (⁶₅, ⁴₃, ⁴₂) already implies the seventh; keep "maj" visible.
  if (figure && !figure.startsWith('/')) {
    if (chord.quality === '7' || chord.quality === 'm7') qualityText = ''
    else if (chord.quality === 'maj7') qualityText = 'maj'
  }
  const spaced = qualityText.startsWith(' ')
  const number = `${acc}${DIGIT[numeral]}${minor ? 'm' : ''}${chord.quality === 'dim' ? '°' : chord.quality === 'aug' ? '+' : ''}`
  return {
    base, number, figure, bassText, diatonic: isDiatonic(chord, key),
    text: `${base}${spaced ? '' : qualityText}${figure}${spaced ? qualityText : ''}${additions}`,
  }
}

const PATTERNS = {
  major: [
    { seq: ['I', 'V', 'vi', 'IV'], name: 'prog.pop' },
    { seq: ['vi', 'IV', 'I', 'V'], name: 'prog.popFromVi' },
    { seq: ['I', 'vi', 'IV', 'V'], name: 'prog.fifties' },
    { seq: ['IV', 'iv', 'I'], name: 'prog.borrowedIv' },
    { seq: ['ii', 'V', 'I'], name: 'prog.iiVI' },
    { seq: ['IV', 'V', 'I'], name: 'prog.authentic' },
    { seq: ['V', 'I'], name: 'prog.authentic' },
    { seq: ['IV', 'I'], name: 'prog.plagal' },
    { seq: ['V', 'vi'], name: 'prog.deceptive' },
  ],
  minor: [
    { seq: ['i', 'VI', 'III', 'VII'], name: 'prog.minorPop' },
    { seq: ['ii', 'V', 'i'], name: 'prog.minorIiVi' },
    { seq: ['iv', 'V', 'i'], name: 'prog.minorCadence' },
    { seq: ['V', 'i'], name: 'prog.authentic' },
    { seq: ['iv', 'i'], name: 'prog.plagal' },
    { seq: ['V', 'VI'], name: 'prog.deceptive' },
  ],
}

/**
 * Full derived analysis. `chords` are chord-track events (confirmed and tentative suggestions)
 * sorted by start; N.C. events break progressions. With no confirmed key the top inferred key
 * is used tentatively unless the evidence is insufficient. Every run of chords gets its full
 * numeral sequence (`runs`), whether or not it matches a named progression.
 */
export function analyzeHarmony({ chords, notes, timeSignature, keyContext, revision }) {
  const candidates = keyCandidates(chords, notes, timeSignature)
  let key = null
  if (keyContext?.status === 'confirmed') key = { ...keyContext, tentative: false }
  else if (candidates.status !== 'insufficient') {
    const top = candidates.candidates[0]
    key = { tonicPc: top.tonicPc, tonicSpelling: top.tonicSpelling, mode: top.mode, source: 'inferred', status: 'suggested', tentative: true }
  }
  const result = {
    analysisVersion: ANALYSIS_VERSION, inputRevision: revision, key, keyStatus: candidates.status,
    keyCandidates: candidates.candidates.slice(0, 4), chords: {}, runs: [], progressions: [], modulationHints: [],
  }
  if (!key) return result

  // Contiguous runs of pitched chords; N.C. or a gap longer than a bar ends a run.
  const runs = []
  let run = []
  for (const e of chords) {
    const prev = run[run.length - 1]
    if (!e.chord || (prev && e.startTick - (prev.startTick + prev.durationTick) > PPQ * 4)) {
      if (run.length) runs.push(run)
      run = e.chord ? [e] : []
    } else run.push(e)
  }
  if (run.length) runs.push(run)

  for (const r of runs) {
    // Repeats of the same chord are one harmony for labels and progression patterns.
    const groups = []
    for (const e of r) {
      const last = groups[groups.length - 1]
      if (last && sameChord(last.chord, e.chord)) {
        last.events.push(e)
        last.durationTick = e.startTick + e.durationTick - last.startTick
      } else groups.push({ chord: e.chord, startTick: e.startTick, durationTick: e.durationTick, events: [e] })
    }
    const romans = groups.map((g) => romanNumeral(g.chord, key))
    groups.forEach((g, i) => {
      const roman = romans[i]
      const entry = { roman, display: roman.text, alternatives: [], labels: [] }
      if (!roman.diatonic) {
        const target = secondaryTarget(groups, i, key)
        if (target) {
          const targetBase = romans[i + 1].base
          const seventh = g.chord.quality === '7' ? '7' : g.chord.quality === '9' ? '9' : ''
          entry.display = `V${seventh}/${targetBase}${roman.figure}`
          entry.alternatives.push(roman.text)
          entry.labels.push(m('analysis.secondaryLabel', { target: targetBase }))
          result.progressions.push({
            startTick: g.startTick, endTick: target.startTick + target.durationTick,
            text: `${entry.display}–${romans[i + 1].text}`, name: m('prog.secondary'),
            detail: m('analysis.secondaryDetail', { target: targetBase, literal: roman.text }),
          })
        } else if (isBorrowed(g.chord, key)) {
          const source = keyLabel(parallel(key))
          entry.labels.push(m('analysis.borrowedLabel', { source }))
          result.progressions.push({
            startTick: g.startTick, endTick: g.startTick + g.durationTick, text: roman.text,
            name: m('prog.borrowed'), detail: m('analysis.borrowedDetail', { roman: roman.text, source }),
          })
        } else entry.labels.push(m('analysis.chromatic'))
      }
      if (roman.bassText) entry.labels.push(roman.bassText)
      for (const e of g.events) result.chords[e.id] = { ...entry, tentative: !!e.tentative }
    })
    const last = groups[groups.length - 1]
    result.runs.push({
      startTick: groups[0].startTick, endTick: last.startTick + last.durationTick,
      text: romans.map((x) => x.text).join('–'), numbers: romans.map((x) => x.number).join('–'),
      tentative: r.some((e) => e.tentative),
    })
    matchPatterns(groups, romans, key, result.progressions)
  }
  result.progressions.sort((a, b) => a.startTick - b.startTick || b.endTick - a.endTick)
  result.modulationHints = modulationHints(chords.filter((e) => e.chord), key)
  return result
}

function matchPatterns(run, romans, key, out) {
  const bases = romans.map((r) => r.base)
  const covered = []
  for (const p of PATTERNS[key.mode]) {
    for (let i = 0; i + p.seq.length <= bases.length; i++) {
      if (!p.seq.every((b, j) => bases[i + j] === b)) continue
      const end = i + p.seq.length - 1
      // Skip a cadence already contained in a longer match (e.g. V–I inside ii–V–I).
      if (covered.some(([s, e]) => s <= i && end <= e)) continue
      covered.push([i, end])
      const slice = romans.slice(i, end + 1)
      out.push({
        startTick: run[i].startTick, endTick: run[end].startTick + run[end].durationTick,
        text: slice.map((r) => r.text).join('–'), name: m(p.name),
        detail: m('prog.detail', { seq: p.seq.join('–'), numbers: slice.map((r) => r.number).join('–') }),
      })
    }
  }
}

/** Four-chord windows that fit another key perfectly but the working key poorly. */
function modulationHints(chords, key) {
  if (chords.length < 6) return []
  const hints = []
  for (let i = 0; i + 4 <= chords.length; i++) {
    const win = chords.slice(i, i + 4)
    if (chordFit(win, key) >= 0.75) continue
    const best = ALL_KEYS.map((k) => ({ k, fit: chordFit(win, k) + cadenceBonus(win, k) }))
      .sort((a, b) => b.fit - a.fit)[0]
    if (sameKey(best.k, key) || chordFit(win, best.k) < 1) continue
    const last = hints[hints.length - 1]
    const endTick = win[3].startTick + win[3].durationTick
    if (last && sameKey(last.key, best.k) && last.endTick >= win[0].startTick) last.endTick = endTick
    else hints.push({ startTick: win[0].startTick, endTick, key: best.k, label: m('analysis.modulation', { key: keyLabel(best.k) }) })
  }
  return hints
}
