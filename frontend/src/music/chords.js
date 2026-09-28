// One chord dictionary shared by detection, manual selection, symbols and preview voicings.
// Stored spellings are ASCII ("Db", "F#"); display turns them into ♭/♯.

import { PPQ } from './time.js'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const ROOT_SPELLINGS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G',
  'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
const MIXED = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const mod12 = (n) => ((n % 12) + 12) % 12

export function spellingPc(spelling) {
  const m = /^([A-G])(#{0,2}|b{0,2})$/.exec(spelling ?? '')
  if (!m) return null
  const acc = m[2].startsWith('#') ? m[2].length : -m[2].length
  return mod12(LETTER_PC[m[1]] + acc)
}

export const displaySpelling = (s) => s.replace(/##/g, '𝄪').replace(/#/g, '♯').replace(/bb/g, '𝄫')
  .replace(/(?<=[A-G])b/g, '♭')

/** Default spelling for a pitch class; `accidentals` is 'sharps' | 'flats' | undefined (mixed). */
export function defaultSpelling(pc, accidentals) {
  const table = accidentals === 'sharps' ? SHARPS : accidentals === 'flats' ? FLATS : MIXED
  return table[mod12(pc)]
}

export function pitchName(pitch, accidentals) {
  return `${displaySpelling(defaultSpelling(pitch, accidentals))}${Math.floor(pitch / 12) - 1}`
}

/** Spell the note `semitones` above `rootSpelling` as the given scale degree (1–13). */
export function spellInterval(rootSpelling, semitones, degree) {
  const letter = LETTERS[(LETTERS.indexOf(rootSpelling[0]) + degree - 1) % 7]
  let diff = mod12(spellingPc(rootSpelling) + semitones - LETTER_PC[letter])
  if (diff > 6) diff -= 12
  return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff))
}

// [semitones above root, scale degree]. `omit5` marks types still recognised without the fifth.
export const CHORD_TYPES = [
  { id: 'maj', label: '大三', quality: 'maj', additions: [], suffix: '', tones: [[0, 1], [4, 3], [7, 5]] },
  { id: 'min', label: '小三', quality: 'min', additions: [], suffix: 'm', tones: [[0, 1], [3, 3], [7, 5]] },
  { id: 'dim', label: '减三', quality: 'dim', additions: [], suffix: 'dim', tones: [[0, 1], [3, 3], [6, 5]] },
  { id: 'aug', label: '增三', quality: 'aug', additions: [], suffix: 'aug', tones: [[0, 1], [4, 3], [8, 5]] },
  { id: '7', label: '属七', quality: '7', additions: [], suffix: '7', tones: [[0, 1], [4, 3], [7, 5], [10, 7]], omit5: true },
  { id: 'maj7', label: '大七', quality: 'maj7', additions: [], suffix: 'maj7', tones: [[0, 1], [4, 3], [7, 5], [11, 7]], omit5: true },
  { id: 'm7', label: '小七', quality: 'm7', additions: [], suffix: 'm7', tones: [[0, 1], [3, 3], [7, 5], [10, 7]], omit5: true },
  { id: 'sus2', label: '挂二', quality: 'sus2', additions: [], suffix: 'sus2', tones: [[0, 1], [2, 2], [7, 5]] },
  { id: 'sus4', label: '挂四', quality: 'sus4', additions: [], suffix: 'sus4', tones: [[0, 1], [5, 4], [7, 5]] },
  { id: 'add9', label: '加九', quality: 'maj', additions: ['add9'], suffix: 'add9', tones: [[0, 1], [4, 3], [7, 5], [2, 9]], omit5: true },
  { id: 'madd9', label: '小加九', quality: 'min', additions: ['add9'], suffix: 'madd9', tones: [[0, 1], [3, 3], [7, 5], [2, 9]], omit5: true },
  { id: 'add11', label: '加十一', quality: 'maj', additions: ['add11'], suffix: 'add11', tones: [[0, 1], [4, 3], [7, 5], [5, 11]] },
  { id: '6', label: '大六', quality: '6', additions: [], suffix: '6', tones: [[0, 1], [4, 3], [7, 5], [9, 6]] },
  { id: 'm6', label: '小六', quality: 'm6', additions: [], suffix: 'm6', tones: [[0, 1], [3, 3], [7, 5], [9, 6]] },
  { id: '9', label: '属九', quality: '9', additions: [], suffix: '9', tones: [[0, 1], [4, 3], [7, 5], [10, 7], [2, 9]], omit5: true },
]

export const MINOR_THIRD_QUALITIES = new Set(['min', 'dim', 'm7', 'm6'])

export function chordType(chord) {
  const adds = [...(chord.additions ?? [])].sort().join(',')
  return CHORD_TYPES.find((t) => t.quality === chord.quality && t.additions.join(',') === adds) ?? null
}

export function makeChord(rootSpelling, typeId, bassSpelling = null) {
  const type = CHORD_TYPES.find((t) => t.id === typeId)
  const rootPc = spellingPc(rootSpelling)
  const bassPc = bassSpelling ? spellingPc(bassSpelling) : null
  return {
    rootPc, rootSpelling, quality: type.quality, additions: [...type.additions],
    bassPc: bassPc === rootPc ? null : bassPc, bassSpelling: bassPc === rootPc ? null : bassSpelling,
  }
}

/** Spelled chord members in stacking order, e.g. Cadd9 → C E G D. */
export function chordToneSpellings(chord) {
  return chordType(chord).tones.map(([s, d]) => spellInterval(chord.rootSpelling, s, d))
}

export function chordPcs(chord) {
  return new Set(chordType(chord).tones.map(([s]) => mod12(chord.rootPc + s)))
}

export function chordSymbol(chord) {
  if (!chord) return 'N.C.'
  const base = displaySpelling(chord.rootSpelling) + chordType(chord).suffix
  return chord.bassPc == null ? base : `${base}/${displaySpelling(chord.bassSpelling)}`
}

export const eventSymbol = (event) => (event.kind === 'no_chord' ? 'N.C.' : chordSymbol(event.chord))

/** Returns an error message, or null when the structured chord is valid. */
export function validateChord(chord) {
  if (!chord || typeof chord !== 'object') return '缺少 chord 字段'
  if (!Number.isInteger(chord.rootPc) || chord.rootPc < 0 || chord.rootPc > 11) return '根音 rootPc 须为 0–11'
  if (!ROOT_SPELLINGS.includes(chord.rootSpelling) || spellingPc(chord.rootSpelling) !== chord.rootPc) {
    return `根音拼写 ${chord.rootSpelling} 与 rootPc ${chord.rootPc} 不一致`
  }
  if (!Array.isArray(chord.additions)) return 'additions 须为数组'
  if (!chordType(chord)) return `不支持的和弦类型 ${chord.quality}+${chord.additions.join(',')}`
  if (chord.bassPc != null) {
    if (!Number.isInteger(chord.bassPc) || chord.bassPc < 0 || chord.bassPc > 11) return '低音 bassPc 须为 0–11'
    if (spellingPc(chord.bassSpelling) !== chord.bassPc) return `低音拼写 ${chord.bassSpelling} 与 bassPc 不一致`
    if (chord.bassPc === chord.rootPc) return '低音与根音相同时应省略 bassPc'
  } else if (chord.bassSpelling != null) return '缺少 bassPc 时不能有 bassSpelling'
  return null
}

/** Bass options offered in the chord editor: chord tones first, then any other pitch class. */
export function bassOptions(chord) {
  const tones = chordToneSpellings(chord).slice(1)
  const tonePcs = new Set(tones.map(spellingPc))
  const others = ROOT_SPELLINGS.filter((s) => spellingPc(s) !== chord.rootPc && !tonePcs.has(spellingPc(s)))
  return { tones, others }
}

/** Close-position preview voicing: bass in octave 3, chord from middle C upward, 9/11 an octave up. */
export function voiceChord(chord) {
  const bass = 48 + (chord.bassPc ?? chord.rootPc)
  const upper = chordType(chord).tones.map(([s, d]) => 60 + chord.rootPc + s + (d >= 9 ? 12 : 0))
  return [bass, ...upper]
}

const INTERVAL_NAMES = ['纯八度', '小二度', '大二度', '小三度', '大三度', '纯四度', '三全音',
  '纯五度', '小六度', '大六度', '小七度', '大七度']

/**
 * Identify a simultaneous pitch set. Octave duplicates are merged for matching; the lowest
 * sounding pitch decides the inversion. Scores only order candidates and are not probabilities.
 * status: 'empty' | 'undetermined' (1–2 pitch classes) | 'unsupported' | 'clear' | 'ambiguous'
 */
export function detectChord(pitches, { key = null } = {}) {
  const uniq = [...new Set(pitches)].sort((a, b) => a - b)
  if (!uniq.length) return { status: 'empty', candidates: [], pitches: uniq }
  const bassPc = mod12(uniq[0])
  const pcs = [...new Set(uniq.map(mod12))]
  const accidentals = key ? keyAccidentals(key) : undefined
  if (pcs.length < 3) {
    const reason = pcs.length === 1
      ? `单音 ${uniq.map((p) => pitchName(p, accidentals)).join(' ')}`
      : `双音程 ${pitchName(uniq[0], accidentals)}–${pitchName(uniq.find((p) => mod12(p) !== bassPc), accidentals)}（${INTERVAL_NAMES[mod12(pcs[1] - pcs[0])]}）`
    return { status: 'undetermined', reason, candidates: [], pitches: uniq }
  }
  const set = new Set(pcs)
  const candidates = []
  for (const root of pcs) {
    for (const type of CHORD_TYPES) {
      const template = type.tones.map(([s]) => mod12(root + s))
      const full = template.length === set.size && template.every((pc) => set.has(pc))
      const no5 = !full && type.omit5 && template.length - 1 === set.size
        && template.every((pc) => pc === mod12(root + 7) || set.has(pc))
      if (!full && !no5) continue
      const rootSpelling = defaultSpelling(root, accidentals)
      const chord = { rootPc: root, rootSpelling, quality: type.quality, additions: [...type.additions], bassPc: null, bassSpelling: null }
      if (bassPc !== root) {
        const tone = type.tones.find(([s]) => mod12(root + s) === bassPc)
        chord.bassPc = bassPc
        chord.bassSpelling = spellInterval(rootSpelling, tone[0], tone[1])
      }
      candidates.push({ chord, typeId: type.id, complete: full, score: baseScore(type, root, bassPc, full) })
    }
  }
  if (!candidates.length) {
    return { status: 'unsupported', reason: `音集 ${pcs.map((pc) => displaySpelling(defaultSpelling(pc, accidentals))).join(' ')} 不在首版和弦字典中`, candidates, pitches: uniq }
  }
  // Ambiguity is a property of the notes; key context only reorders the interpretations.
  const base = candidates.map((c) => c.score).sort((a, b) => b - a)
  const clear = base.length === 1 || base[0] - base[1] >= 0.25
  if (key) for (const c of candidates) c.score += contextBonus(c.chord, key)
  candidates.sort((a, b) => b.score - a.score)
  return { status: clear ? 'clear' : 'ambiguous', candidates, pitches: uniq }
}

// Plain triads first, then sevenths, then coloured types (sus/add/6/9) when the notes fit several.
const COMPLEXITY = { maj: 0, min: 0, dim: 0, aug: 0, 7: 0.05, maj7: 0.05, m7: 0.05 }

function baseScore(type, root, bassPc, full) {
  let score = (full ? 1 : 0.6) - (COMPLEXITY[type.id] ?? 0.1)
  if (bassPc === root) score += 0.3
  else {
    const degree = type.tones.find(([s]) => mod12(root + s) === bassPc)?.[1]
    if (degree === 3 || degree === 5) score += 0.1
  }
  return score
}

// Key context re-ranks candidates: diatonic members and a tonic root are more plausible.
function contextBonus(chord, key) {
  let bonus = isDiatonicChord(chord, key) ? 0.1 : 0
  if (chord.rootPc === key.tonicPc) bonus += 0.25
  return bonus
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]
/** Pitch classes of the major or natural-minor scale. */
export function scalePcs(key) {
  return new Set((key.mode === 'major' ? MAJOR : NATURAL_MINOR).map((s) => mod12(key.tonicPc + s)))
}

/**
 * All members (and the bass) in the key. In minor, chords rooted on the dominant or the
 * leading tone may use the raised seventh (harmonic-minor V, V7, vii°); others may not.
 */
export function isDiatonicChord(chord, key) {
  const scale = scalePcs(key)
  const leading = mod12(key.tonicPc + 11)
  if (key.mode === 'minor' && [mod12(key.tonicPc + 7), leading].includes(chord.rootPc)) scale.add(leading)
  return [...chordPcs(chord)].every((pc) => scale.has(pc)) && (chord.bassPc == null || scale.has(chord.bassPc))
}

const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6])
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3])
export function keyAccidentals(key) {
  if (key.mode === 'major' && key.tonicPc === 0) return undefined
  if (key.mode === 'minor' && key.tonicPc === 9) return undefined
  return (key.mode === 'major' ? FLAT_MAJOR : FLAT_MINOR).has(key.tonicPc) ? 'flats' : 'sharps'
}

// ---------------------------------------------------------------------------
// Time-bounded segmentation of one pitched part.

/**
 * Split notes into spans of constant sounding pitches, detect each span and merge neighbours
 * with the same result. Spans shorter than `minTicks` (finger overlaps, grace releases) are
 * ignored; one short span between two identical chords is treated as a passing tone.
 * Consecutive single notes never become a chord: each span is judged on its own pitches.
 */
export function segmentChords(notes, { minTicks = PPQ / 4, passingTicks = PPQ, key = null } = {}) {
  if (!notes.length) return []
  const bounds = [...new Set(notes.flatMap((n) => [n.startTick, n.startTick + n.durationTick]))].sort((a, b) => a - b)
  const byStart = [...notes].sort((a, b) => a.startTick - b.startTick)
  const active = new Set()
  let next = 0
  const spans = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]
    for (const n of active) if (n.startTick + n.durationTick <= a) active.delete(n)
    while (next < byStart.length && byStart[next].startTick <= a) {
      if (byStart[next].startTick + byStart[next].durationTick > a) active.add(byStart[next])
      next++
    }
    if (!active.size) continue
    const b = bounds[i + 1]
    if (b - a < minTicks) continue
    const sounding = [...active]
    const detection = detectChord(sounding.map((n) => n.pitch), { key })
    spans.push({
      startTick: a, endTick: b, noteIds: sounding.map((n) => n.id), detection,
      label: detection.candidates[0] ? chordSymbol(detection.candidates[0].chord) : null,
    })
  }
  // Absorb a short passing span between two equal chords, then merge adjacent equal labels.
  for (let i = 1; i < spans.length - 1; i++) {
    const [p, s, n] = [spans[i - 1], spans[i], spans[i + 1]]
    if (p.label && p.label === n.label && s.label !== p.label && s.endTick - s.startTick < passingTicks
      && p.endTick === s.startTick && s.endTick === n.startTick) {
      s.label = p.label
      s.detection = p.detection
    }
  }
  const merged = []
  for (const s of spans) {
    const last = merged[merged.length - 1]
    if (last && last.label && last.label === s.label && last.endTick === s.startTick) {
      last.endTick = s.endTick
      last.noteIds = [...new Set([...last.noteIds, ...s.noteIds])]
    } else merged.push({ ...s, noteIds: [...s.noteIds] })
  }
  return merged
}

/** Stable text signature of the notes overlapping [start, end) — used to flag changed sources. */
export function notesSignature(notes, startTick, endTick) {
  return notes
    .filter((n) => n.startTick < endTick && n.startTick + n.durationTick > startTick)
    .map((n) => `${n.pitch}@${n.startTick}+${n.durationTick}`)
    .sort()
    .join('|')
}
