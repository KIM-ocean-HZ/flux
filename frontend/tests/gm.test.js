import { describe, expect, it } from 'vitest'
import {
  DRUM_KIT, drumNoteName, GM_DRUM_NOTES, GM_FAMILIES, GM_PROGRAMS, INSTRUMENT_PRESETS, instrumentLabel,
  searchPrograms,
} from '../src/music/gm.js'

describe('GM catalog (A-01)', () => {
  it('lists all 128 melodic programs stored 0–127 and shown 1–128', () => {
    expect(GM_PROGRAMS).toHaveLength(128)
    GM_PROGRAMS.forEach((p, i) => {
      expect(p.program).toBe(i)
      expect(p.display).toBe(i + 1)
      expect(p.en && p.zh).toBeTruthy()
    })
    expect(new Set(GM_PROGRAMS.map((p) => p.en)).size).toBe(128)
    expect(new Set(GM_PROGRAMS.map((p) => p.zh)).size).toBe(128)
  })

  it('has 16 families of 8 and no program offset at family edges', () => {
    expect(GM_FAMILIES).toHaveLength(16)
    for (const f of GM_FAMILIES) expect(GM_PROGRAMS.filter((p) => p.family === f)).toHaveLength(8)
    expect(GM_PROGRAMS[0].en).toBe('Acoustic Grand Piano')
    expect(GM_PROGRAMS[33].en).toBe('Electric Bass (finger)')
    expect(GM_PROGRAMS[89].en).toBe('Pad 2 (warm)')
    expect(GM_PROGRAMS[127].en).toBe('Gunshot')
    expect(instrumentLabel({ program: 33, isDrum: false })).toBe('34. 指弹贝斯 · Electric Bass (finger)')
  })

  it('keeps drums as a separate kit with named GM percussion notes', () => {
    expect(DRUM_KIT.program).toBe(0)
    expect(GM_DRUM_NOTES.map((d) => d.note)).toEqual(Array.from({ length: 47 }, (_, i) => 35 + i))
    expect(drumNoteName(36).en).toMatch(/Kick/)
    expect(drumNoteName(38).zh).toBe('原声军鼓')
    expect(drumNoteName(42).en).toBe('Closed Hi-Hat')
    expect(instrumentLabel({ program: 0, isDrum: true })).toMatch(/鼓组/)
  })

  it('searches Chinese, English, family names and display numbers', () => {
    expect(searchPrograms('贝斯').map((p) => p.program)).toEqual(expect.arrayContaining([32, 33, 34, 35, 36, 37, 38, 39, 87]))
    expect(searchPrograms('piano').map((p) => p.program)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(searchPrograms('Synth Pad').map((p) => p.program)).toEqual([88, 89, 90, 91, 92, 93, 94, 95])
    expect(searchPrograms('34').map((p) => p.program)).toEqual([33])
    expect(searchPrograms('')).toHaveLength(128)
  })

  it('maps the quick presets to the spec programs', () => {
    const byLabel = Object.fromEntries(INSTRUMENT_PRESETS.map((p) => [p.label, p]))
    expect(byLabel['指弹贝斯'].program).toBe(33)
    expect(byLabel['合成 Pad'].program).toBe(89)
    expect(byLabel['原声钢琴'].program).toBe(0)
    expect(byLabel['标准鼓组'].isDrum).toBe(true)
  })
})
