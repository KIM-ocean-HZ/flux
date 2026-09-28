import { describe, expect, it } from 'vitest'
import {
  bassOptions, CHORD_TYPES, chordSymbol, chordToneSpellings, chordType, detectChord, makeChord, notesSignature,
  segmentChords, spellingPc, validateChord, voiceChord,
} from '../src/music/chords.js'

const symbols = (d) => d.candidates.map((c) => chordSymbol(c.chord))
const top = (pitches, opts) => symbols(detectChord(pitches, opts))[0]
const note = (pitch, startTick, durationTick, id = `${pitch}@${startTick}`) => ({ id, pitch, startTick, durationTick, velocity: 80 })

describe('chord dictionary (CH-04)', () => {
  it('covers every type in the spec table with the listed members', () => {
    const c = (id) => chordToneSpellings(makeChord('C', id)).join(' ')
    expect(CHORD_TYPES.map((t) => t.id)).toEqual(['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'sus2', 'sus4',
      'add9', 'madd9', 'add11', '6', 'm6', '9'])
    expect(c('maj')).toBe('C E G')
    expect(c('min')).toBe('C Eb G')
    expect(c('dim')).toBe('C Eb Gb')
    expect(c('aug')).toBe('C E G#')
    expect(c('7')).toBe('C E G Bb')
    expect(c('maj7')).toBe('C E G B')
    expect(c('m7')).toBe('C Eb G Bb')
    expect(c('sus2')).toBe('C D G')
    expect(c('sus4')).toBe('C F G')
    expect(c('add9')).toBe('C E G D')
    expect(c('madd9')).toBe('C Eb G D')
    expect(c('add11')).toBe('C E G F')
    expect(c('6')).toBe('C E G A')
    expect(c('m6')).toBe('C Eb G A')
    expect(c('9')).toBe('C E G Bb D')
  })

  it('keeps add9 without a seventh, 9 with B♭, and sus without the replaced third', () => {
    expect(chordToneSpellings(makeChord('C', 'add9'))).not.toContain('Bb')
    expect(chordToneSpellings(makeChord('C', '9'))).toContain('Bb')
    for (const id of ['sus2', 'sus4']) {
      const tones = chordToneSpellings(makeChord('C', id))
      expect(tones).not.toContain('E')
      expect(tones).not.toContain('Eb')
    }
    expect(chordSymbol(makeChord('C', 'add9'))).toBe('Cadd9')
    expect(chordSymbol(makeChord('C', '9'))).toBe('C9')
    expect(voiceChord(makeChord('C', 'add9'))).toEqual([48, 60, 64, 67, 74])
    expect(voiceChord(makeChord('C', 'sus2'))).toEqual([48, 60, 62, 67])
  })

  it('spells by the chosen root spelling and separates bass from root', () => {
    expect(chordToneSpellings(makeChord('Eb', 'min'))).toEqual(['Eb', 'Gb', 'Bb'])
    expect(chordToneSpellings(makeChord('D#', 'min'))).toEqual(['D#', 'F#', 'A#'])
    expect(chordSymbol(makeChord('Db', 'maj7'))).toBe('D♭maj7')
    const ce = makeChord('C', 'maj', 'E')
    expect(ce).toMatchObject({ rootPc: 0, bassPc: 4, bassSpelling: 'E' })
    expect(chordSymbol(ce)).toBe('C/E')
    expect(chordSymbol(makeChord('C', 'maj', 'C'))).toBe('C')
    expect(bassOptions(makeChord('C', 'maj')).tones).toEqual(['E', 'G'])
    expect(bassOptions(makeChord('C', 'maj')).others).toContain('D')
  })

  it('validates structured chords instead of trusting a symbol', () => {
    expect(validateChord(makeChord('F#', 'm7', 'E'))).toBeNull()
    expect(validateChord({ ...makeChord('C', 'maj'), rootSpelling: 'D' })).toMatch(/不一致/)
    expect(validateChord({ ...makeChord('C', 'maj'), quality: 'maj', additions: ['add13'] })).toMatch(/不支持/)
    expect(validateChord({ ...makeChord('C', 'maj'), bassPc: 4, bassSpelling: 'Fb' })).toBeNull()
    expect(chordType(makeChord('C', 'madd9')).id).toBe('madd9')
  })
})

describe('simultaneous-note detection (CH-01, CH-03)', () => {
  it('CH-01: 60-64-67 is C, 52-55-60 is C/E', () => {
    const c = detectChord([60, 64, 67])
    expect(c.status).toBe('clear')
    expect(symbols(c)).toEqual(['C'])
    const ce = detectChord([52, 55, 60])
    expect(symbols(ce)[0]).toBe('C/E')
    expect(ce.candidates[0].chord).toMatchObject({ rootPc: 0, bassPc: 4 })
  })

  it('merges octave duplicates for matching but keeps the real lowest note for inversion', () => {
    expect(top([48, 64, 67, 72, 76])).toBe('C')
    expect(top([43, 60, 64, 67, 76])).toBe('C/G')
    expect(top([67, 60, 64, 52])).toBe('C/E') // input order does not matter
  })

  it('CH-03: C–E–G–A keeps C6 and Am7/C, reordered by key context', () => {
    const plain = detectChord([60, 64, 67, 69])
    expect(plain.status).toBe('ambiguous')
    expect(symbols(plain)).toEqual(expect.arrayContaining(['C6', 'Am7/C']))
    expect(symbols(plain)[0]).toBe('C6')
    const inAMinor = detectChord([60, 64, 67, 69], { key: { tonicPc: 9, mode: 'minor' } })
    expect(inAMinor.status).toBe('ambiguous')
    expect(symbols(inAMinor)[0]).toBe('Am7/C')
    // Same structure transposed to D with a new voicing order.
    expect(symbols(detectChord([71, 62, 66, 69]))).toEqual(expect.arrayContaining(['D6', 'Bm7/D']))
  })

  it('does not overclaim with one or two pitch classes or an unsupported set', () => {
    expect(detectChord([60]).status).toBe('undetermined')
    expect(detectChord([60, 72]).status).toBe('undetermined')
    const dyad = detectChord([60, 64])
    expect(dyad.status).toBe('undetermined')
    expect(dyad.reason).toMatch(/大三度/)
    const dim7 = detectChord([60, 63, 66, 69])
    expect(dim7.status).toBe('unsupported')
    expect(dim7.reason).toMatch(/不在首版和弦字典/)
    expect(detectChord([60, 64, 67, 71, 74]).status).toBe('unsupported') // Cmaj9 is not silently a triad
  })

  it('keeps symmetric chords ambiguous', () => {
    const aug = detectChord([60, 64, 68])
    expect(aug.status).toBe('ambiguous')
    expect(aug.candidates.length).toBe(3)
  })

  it('recognises every dictionary type in several keys and inversions', () => {
    for (const type of CHORD_TYPES) {
      for (const root of ['C', 'Eb', 'F#', 'A']) {
        const chord = makeChord(root, type.id)
        const pitches = voiceChord(chord).slice(1).reverse() // unseen order, root on the bottom octave
        const d = detectChord([48 + chord.rootPc, ...pitches])
        const match = d.candidates.find((c) => c.typeId === type.id && c.chord.rootPc === chord.rootPc)
        expect(match, `${root}${type.suffix}`).toBeTruthy()
      }
    }
    expect(top([59, 62, 65, 67])).toBe('G7/B')
  })

  it('accepts sevenths and add9 without the fifth as incomplete voicings', () => {
    const c7 = detectChord([60, 64, 70])
    expect(symbols(c7)[0]).toBe('C7')
    expect(c7.candidates[0].complete).toBe(false)
    expect(top([62, 66, 72])).toBe('D7')
  })
})

describe('time-bounded segmentation (CH-02)', () => {
  it('turns a block chord into one suggestion and leaves consecutive single notes undetermined', () => {
    const notes = [note(60, 0, 960), note(64, 0, 960), note(67, 0, 960),
      note(60, 960, 480), note(62, 1440, 480), note(64, 1920, 480)]
    const segs = segmentChords(notes)
    expect(segs[0]).toMatchObject({ startTick: 0, endTick: 960, label: 'C' })
    expect(segs.slice(1).every((s) => s.label === null && s.detection.status === 'undetermined')).toBe(true)
  })

  it('ignores finger-overlap slivers and merges a held chord under chord-tone melody', () => {
    const notes = [
      // C chord pressed slightly unevenly, held two beats
      note(60, 0, 1920), note(64, 10, 1910), note(67, 25, 1895),
      // legato into F chord with a 30-tick overlap
      note(65, 1890, 1920), note(69, 1895, 1920), note(72, 1900, 1920),
    ]
    const labels = segmentChords(notes).filter((s) => s.label).map((s) => s.label)
    expect(labels).toEqual(['C', 'F'])
  })

  it('absorbs a short passing tone between two equal chords', () => {
    const notes = [note(48, 0, 3840), note(52, 0, 3840), note(55, 0, 3840),
      note(72, 0, 960), note(74, 960, 480), note(76, 1440, 2400)]
    const labelled = segmentChords(notes).filter((s) => s.label)
    expect(labelled).toHaveLength(1)
    expect(labelled[0]).toMatchObject({ startTick: 0, endTick: 3840, label: 'C' })
  })

  it('signs the notes of a range so later source edits can be detected', () => {
    const notes = [note(60, 0, 960), note(64, 0, 960)]
    const sig = notesSignature(notes, 0, 960)
    expect(notesSignature([...notes], 0, 960)).toBe(sig)
    expect(notesSignature([note(60, 0, 960), note(63, 0, 960)], 0, 960)).not.toBe(sig)
    expect(notesSignature([...notes, note(70, 2000, 10)], 0, 960)).toBe(sig)
    expect(spellingPc('B#')).toBe(0)
  })
})
