import { describe, expect, it } from 'vitest'
import { analyzeHarmony, keyCandidates, keyLabel, romanNumeral } from '../src/music/analysis.js'
import { makeChord } from '../src/music/chords.js'

const TS = { numerator: 4, denominator: 4 }
const BAR = 3840
let seq = 0
const events = (...specs) => specs.map((s, i) => {
  const [root, type, bass] = s.split(/[: ]/).concat([])
  return { id: `e${seq++}`, startTick: i * BAR, durationTick: BAR, kind: 'chord', chord: makeChord(root, type, bass || null) }
})
const key = (tonicSpelling, tonicPc, mode = 'major') => ({ tonicPc, tonicSpelling, mode, source: 'user', status: 'confirmed' })
const run = (chords, keyContext = null, notes = []) => analyzeHarmony({ chords, notes, timeSignature: TS, keyContext, revision: 7 })
const romans = (a, chords) => chords.map((e) => a.chords[e.id].display)
const names = (a) => a.progressions.map((p) => p.name)

describe('Roman numerals in a confirmed key (CH-05)', () => {
  it('C–G–Am–F in C major is I–V–vi–IV (1–5–6m–4)', () => {
    const chords = events('C:maj', 'G:maj', 'A:min', 'F:maj')
    const a = run(chords, key('C', 0))
    expect(romans(a, chords)).toEqual(['I', 'V', 'vi', 'IV'])
    const pop = a.progressions.find((p) => p.text === 'I–V–vi–IV')
    expect(pop.detail).toBe('I–V–vi–IV（1–5–6m–4）')
    expect(a.inputRevision).toBe(7)
    expect(a.key.tentative).toBe(false)
  })

  it('Dm7–G7–Cmaj7 in C major is ii7–V7–Imaj7 (ii–V–I)', () => {
    const chords = events('D:m7', 'G:7', 'C:maj7')
    const a = run(chords, key('C', 0))
    expect(romans(a, chords)).toEqual(['ii7', 'V7', 'Imaj7'])
    expect(a.progressions.find((p) => p.name === 'ii–V–I').text).toBe('ii7–V7–Imaj7')
    expect(names(a)).not.toContain('正格终止') // V–I inside ii–V–I is not repeated
  })

  it('the same C chord is IV in G major and V in F major; chords are not transposed', () => {
    const chords = events('C:maj')
    const before = JSON.stringify(chords)
    expect(run(chords, key('G', 7)).chords[chords[0].id].display).toBe('IV')
    expect(run(chords, key('F', 5)).chords[chords[0].id].display).toBe('V')
    expect(JSON.stringify(chords)).toBe(before)
  })

  it('works the same after transposition to E♭ major and A major', () => {
    const eb = events('Eb:maj', 'Bb:maj', 'C:min', 'Ab:maj')
    expect(romans(run(eb, key('Eb', 3)), eb)).toEqual(['I', 'V', 'vi', 'IV'])
    const a = events('B:m7', 'E:7', 'A:maj7')
    const res = run(a, key('A', 9))
    expect(romans(res, a)).toEqual(['ii7', 'V7', 'Imaj7'])
    expect(names(res)).toContain('ii–V–I')
  })

  it('keeps inversion, add, sus and seventh information in the numeral', () => {
    const k = key('C', 0)
    expect(romanNumeral(makeChord('C', 'maj', 'E'), k)).toMatchObject({ base: 'I', text: 'I⁶', bassText: '三音低音' })
    expect(romanNumeral(makeChord('C', 'maj', 'G'), k).text).toBe('I⁶₄')
    expect(romanNumeral(makeChord('G', '7', 'B'), k).text).toBe('V⁶₅')
    expect(romanNumeral(makeChord('C', 'add9'), k).text).toBe('I add9')
    expect(romanNumeral(makeChord('A', 'madd9'), k).text).toBe('vi add9')
    expect(romanNumeral(makeChord('G', 'sus4'), k).text).toBe('Vsus4')
    expect(romanNumeral(makeChord('C', '6'), k).text).toBe('I add6')
    expect(romanNumeral(makeChord('G', '9'), k).text).toBe('V9')
    expect(romanNumeral(makeChord('B', 'dim'), k).text).toBe('vii°')
    expect(romanNumeral(makeChord('Bb', 'maj'), k).text).toBe('♭VII')
    expect(romanNumeral(makeChord('C', 'maj', 'D'), k).text).toBe('I/D')
  })

  it('uses minor-key degrees', () => {
    const chords = events('A:min', 'D:min', 'E:7', 'A:min')
    const a = run(chords, key('A', 9, 'minor'))
    expect(romans(a, chords)).toEqual(['i', 'iv', 'V7', 'i'])
    expect(romanNumeral(makeChord('G#', 'dim'), key('A', 9, 'minor')).text).toBe('vii°')
    expect(romanNumeral(makeChord('F', 'maj'), key('A', 9, 'minor')).text).toBe('VI')
  })
})

describe('context explanations (CH-06)', () => {
  it('D7–G in C major is V7/V → V, and the literal II7 stays available', () => {
    const chords = events('C:maj', 'D:7', 'G:maj', 'C:maj')
    const a = run(chords, key('C', 0))
    expect(romans(a, chords)).toEqual(['I', 'V7/V', 'V', 'I'])
    expect(a.chords[chords[1].id].alternatives).toContain('II7')
    expect(names(a)).toContain('副属和弦')
  })

  it('finds other secondary dominants by rule, not by a stored answer', () => {
    const chords = events('G:maj', 'B:7', 'E:min', 'C:maj', 'D:maj', 'G:maj') // G major: V7/vi
    const a = run(chords, key('G', 7))
    expect(a.chords[chords[1].id].display).toBe('V7/vi')
    const cm = events('C:maj', 'E:maj', 'A:min') // C major: V/vi without seventh
    expect(run(cm, key('C', 0)).chords[cm[1].id].display).toBe('V/vi')
  })

  it('F–Fm–C in C major is IV–iv–I with a borrowed minor subdominant', () => {
    const chords = events('F:maj', 'F:min', 'C:maj')
    const a = run(chords, key('C', 0))
    expect(romans(a, chords)).toEqual(['IV', 'iv', 'I'])
    expect(a.chords[chords[1].id].labels.join()).toMatch(/借用和弦（来自 C 小调）/)
    expect(names(a)).toEqual(expect.arrayContaining(['借用小下属', '借用和弦']))
    const bb = events('Bb:maj', 'Bb:min', 'F:maj')
    expect(romans(run(bb, key('F', 5)), bb)).toEqual(['IV', 'iv', 'I'])
  })

  it('an isolated chord does not lock a unique key', () => {
    const chords = events('C:maj')
    const a = run(chords)
    expect(a.keyStatus).toBe('insufficient')
    expect(a.key).toBeNull()
    expect(Object.keys(a.chords)).toHaveLength(0)
  })

  it('infers keys from context when none is chosen and keeps relative-key alternatives', () => {
    const chords = events('C:maj', 'G:maj', 'A:min', 'F:maj')
    const a = run(chords)
    expect(keyLabel(a.key)).toBe('C 大调')
    expect(a.key.tentative).toBe(true)
    expect(a.keyCandidates.map(keyLabel).slice(0, 2)).toEqual(['C 大调', 'A 小调'])
    const minor = events('A:min', 'D:min', 'E:7', 'A:min')
    expect(keyLabel(run(minor).key)).toBe('A 小调')
    const moved = events('D:maj', 'A:maj', 'B:min', 'G:maj', 'A:7', 'D:maj')
    expect(keyLabel(run(moved).key)).toBe('D 大调')
  })

  it('changing the surrounding chords changes the explanation of the same chord', () => {
    const inC = events('C:maj', 'D:7', 'G:maj', 'C:maj')
    const inG = events('G:maj', 'C:maj', 'D:7', 'G:maj')
    expect(keyLabel(run(inC).key)).toBe('C 大调')
    expect(keyLabel(run(inG).key)).toBe('G 大调')
    expect(run(inG).chords[inG[2].id].display).toBe('V7')
  })

  it('uses melody notes, duration and accents when there are no chords', () => {
    const notes = [[64, 0, 960], [62, 960, 960], [60, 1920, 1920], [67, 3840, 960], [65, 4800, 960], [64, 5760, 960], [62, 6720, 960], [60, 7680, 3840]]
      .map(([pitch, startTick, durationTick]) => ({ pitch, startTick, durationTick }))
    const { status, candidates } = keyCandidates([], notes, TS)
    expect(status).not.toBe('insufficient')
    expect(keyLabel(candidates[0])).toBe('C 大调')
    expect(keyCandidates([], notes.slice(0, 2), TS).status).toBe('insufficient')
  })

  it('flags a probable modulation for confirmation instead of forcing the global key', () => {
    const chords = events('C:maj', 'F:maj', 'G:maj', 'C:maj', 'E:maj', 'A:maj', 'B:7', 'E:maj')
    const a = run(chords, key('C', 0))
    expect(a.modulationHints).toHaveLength(1)
    expect(a.modulationHints[0].label).toMatch(/E 大调/)
    expect(a.modulationHints[0].startTick).toBeGreaterThanOrEqual(BAR * 3)
  })

  it('N.C. breaks a progression', () => {
    const chords = events('G:maj', 'C:maj')
    chords.splice(1, 0, { id: 'nc', startTick: BAR, durationTick: BAR, kind: 'no_chord' })
    chords[2].startTick = BAR * 2
    const a = run(chords, key('C', 0))
    expect(names(a)).not.toContain('正格终止')
    expect(a.chords.nc).toBeUndefined()
  })
})
