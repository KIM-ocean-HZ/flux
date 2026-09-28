import { parseMidi, writeMidi } from 'midi-file'
import { describe, expect, it } from 'vitest'
import { translate } from '../src/i18n/translate.js'
import { makeChord } from '../src/music/chords.js'
import { exportMidi, importMidi, planExport } from '../src/music/midi.js'
import { addNotes, addTrack, createExampleProject, createProject, placeChord, setTempo, setTimeSignature, trackNotes } from '../src/music/project.js'

const zh = (msg) => translate('zh', msg)
const simple = (tracks) => tracks.map((t) => ({
  name: t.name, program: t.program, isDrum: t.isDrum, volume: t.volume,
  notes: trackNotes(t).map((n) => [n.pitch, n.startTick, n.durationTick, n.velocity]).sort((a, b) => a[1] - b[1] || a[0] - b[0]),
}))

function band() {
  let p = createExampleProject()
  p.name = '测试 · Band'
  let r = addTrack(p, { name: '钢琴建议', program: 0 }); p = r.project
  p = addNotes(p, r.trackId, [{ pitch: 60, startTick: 0, durationTick: 3840, velocity: 70 }, { pitch: 67, startTick: 7, durationTick: 1, velocity: 1 }])
  r = addTrack(p, { name: '贝斯', program: 33 }); p = r.project
  p = addNotes(p, r.trackId, [{ pitch: 36, startTick: 0, durationTick: 960, velocity: 100 }])
  r = addTrack(p, { name: '鼓', program: 0, isDrum: true }); p = r.project
  p = addNotes(p, r.trackId, [{ pitch: 36, startTick: 0, durationTick: 60 }, { pitch: 42, startTick: 480, durationTick: 60 }])
  p.tracks[2].volume = 64
  p = setTempo(setTimeSignature(p, { numerator: 6, denominator: 8 }), 87)
  return placeChord(p, { startTick: 0, durationTick: 2880, kind: 'chord', chord: makeChord('C', 'add9'), source: 'manual', status: 'confirmed' })
}

describe('MIDI export (A-06, CH-08)', () => {
  it('writes tempo, meter, one MIDI track per project track, and never the chord track', () => {
    const p = band()
    const mid = parseMidi(exportMidi(p))
    expect(mid.header).toMatchObject({ format: 1, ticksPerBeat: 960, numTracks: 5 })
    const conductor = mid.tracks[0]
    expect(conductor.find((e) => e.type === 'setTempo').microsecondsPerBeat).toBe(Math.round(60e6 / 87))
    expect(conductor.find((e) => e.type === 'timeSignature')).toMatchObject({ numerator: 6, denominator: 8 })
    const noteCount = mid.tracks.flat().filter((e) => e.type === 'noteOn').length
    expect(noteCount).toBe(14 + 2 + 1 + 2)
  })

  it('gives same-program tracks different channels and drums channel 10', () => {
    const p = band()
    const plan = planExport(p)
    const [melody, suggestion, bass, drums] = p.tracks.map((t) => plan.channels.get(t.id))
    expect(melody).not.toBe(suggestion)
    expect(new Set([melody, suggestion, bass]).size).toBe(3)
    expect(drums).toBe(9)
    expect([melody, suggestion, bass]).not.toContain(9)
  })

  it('refuses more pitched tracks than channels, and asks before sharing the drum channel', () => {
    let p = createProject()
    for (let i = 0; i < 15; i++) p = addTrack(p, { name: `t${i}`, program: i }).project
    const plan = planExport(p)
    expect(plan.ok).toBe(false)
    expect(zh(plan.errors[0])).toMatch(/16 条音高轨/)
    expect(() => exportMidi(p)).toThrow()
    let q = band()
    q = addTrack(q, { name: '鼓 2', program: 0, isDrum: true }).project
    expect(zh(planExport(q).warnings[0])).toMatch(/共用第 10 通道/)
  })

  it('round-trips notes, tracks, programs, velocity, tempo and meter through import', () => {
    const p = band()
    const back = importMidi(exportMidi(p), { name: 'x' })
    expect(back.ok).toBe(true)
    expect(back.limitations).toEqual([])
    expect(back.project.quarterBpm).toBeCloseTo(87, 3)
    expect(back.project.timeSignature).toEqual({ numerator: 6, denominator: 8 })
    expect(simple(back.project.tracks)).toEqual(simple(p.tracks))
    expect(back.project.chordTrack).toEqual([])
  })
})

// Hand-built SMF helpers for foreign files.
const ev = (deltaTime, type, extra = {}) => ({ deltaTime, type, ...extra })
const build = (ticksPerBeat, tracks, format = 1) => Uint8Array.from(writeMidi({ header: { format, numTracks: tracks.length, ticksPerBeat }, tracks }))

describe('MIDI import (A-06)', () => {
  it('converts other PPQs exactly and keeps same-program tracks separate', () => {
    const mid = build(480, [
      [ev(0, 'setTempo', { microsecondsPerBeat: 600000 }), ev(0, 'timeSignature', { numerator: 3, denominator: 4, metronome: 24, thirtyseconds: 8 }), ev(0, 'endOfTrack')],
      [ev(0, 'trackName', { text: 'Lead' }), ev(0, 'programChange', { channel: 0, programNumber: 0 }), ev(0, 'noteOn', { channel: 0, noteNumber: 60, velocity: 90 }), ev(480, 'noteOff', { channel: 0, noteNumber: 60, velocity: 0 }), ev(0, 'endOfTrack')],
      [ev(0, 'trackName', { text: 'Double' }), ev(0, 'programChange', { channel: 1, programNumber: 0 }), ev(240, 'noteOn', { channel: 1, noteNumber: 60, velocity: 50 }), ev(480, 'noteOff', { channel: 1, noteNumber: 60, velocity: 0 }), ev(0, 'endOfTrack')],
    ])
    const r = importMidi(mid)
    expect(r.ok).toBe(true)
    expect(r.project.quarterBpm).toBe(100)
    expect(r.project.timeSignature).toEqual({ numerator: 3, denominator: 4 })
    expect(simple(r.project.tracks).map((t) => [t.name, t.program, t.notes])).toEqual([
      ['Lead', 0, [[60, 0, 960, 90]]], ['Double', 0, [[60, 480, 960, 50]]]])
    expect(r.limitations).toEqual([])
  })

  it('reports PPQ rounding, CC64, pitch bend, tempo and program changes as limitations', () => {
    const mid = build(96, [
      [ev(0, 'setTempo', { microsecondsPerBeat: 500000 }), ev(960, 'setTempo', { microsecondsPerBeat: 400000 }), ev(0, 'endOfTrack')],
      [ev(0, 'programChange', { channel: 0, programNumber: 5 }), ev(0, 'noteOn', { channel: 0, noteNumber: 60, velocity: 90 }),
        ev(0, 'controller', { channel: 0, controllerType: 64, value: 127 }), ev(1, 'pitchBend', { channel: 0, value: 100 }),
        ev(96, 'noteOff', { channel: 0, noteNumber: 60, velocity: 0 }), ev(0, 'programChange', { channel: 0, programNumber: 9 }),
        ev(0, 'noteOn', { channel: 0, noteNumber: 62, velocity: 90 }), ev(1, 'noteOff', { channel: 0, noteNumber: 62, velocity: 0 }),
        ev(0, 'endOfTrack')],
    ])
    const r = importMidi(mid)
    expect(r.ok).toBe(true)
    const text = r.limitations.map(zh).join('\n')
    expect(text).toMatch(/延音踏板 CC64 ×1/)
    expect(text).toMatch(/弯音 ×1/)
    expect(text).toMatch(/速度变化 1 处/)
    expect(text).toMatch(/音色中途变化/)
    expect(r.project.tracks[0].program).toBe(5)
    expect(trackNotes(r.project.tracks[0]).map((n) => [n.startTick, n.durationTick])).toEqual([[0, 970], [970, 10]])
  })

  it('rounds non-integer PPQ conversions and says so', () => {
    const mid = build(384, [[ev(0, 'noteOn', { channel: 0, noteNumber: 60, velocity: 90 }), ev(1, 'noteOff', { channel: 0, noteNumber: 60, velocity: 0 }), ev(0, 'endOfTrack')]])
    const r = importMidi(mid)
    expect(trackNotes(r.project.tracks[0])[0]).toMatchObject({ startTick: 0, durationTick: 3 })
    expect(r.limitations.map(zh).join()).toMatch(/PPQ 384：1 个事件/)
    expect(translate('en', r.limitations[0])).toMatch(/^Source PPQ 384: 1 event time rounded/)
  })

  it('splits a format-0 file by channel and marks channel 10 as drums', () => {
    const mid = build(960, [[
      ev(0, 'programChange', { channel: 2, programNumber: 33 }),
      ev(0, 'noteOn', { channel: 2, noteNumber: 40, velocity: 80 }), ev(0, 'noteOn', { channel: 9, noteNumber: 36, velocity: 100 }),
      ev(960, 'noteOff', { channel: 2, noteNumber: 40, velocity: 0 }), ev(0, 'noteOff', { channel: 9, noteNumber: 36, velocity: 0 }),
      ev(0, 'endOfTrack')]], 0)
    const r = importMidi(mid)
    expect(r.project.tracks.map((t) => [t.program, t.isDrum])).toEqual([[33, false], [0, true]])
    expect(r.notices.map(zh).join()).toMatch(/120 BPM/)
  })

  it('rejects files it cannot read instead of producing a partial project', () => {
    expect(importMidi(Uint8Array.from([1, 2, 3])).ok).toBe(false)
    const smpte = Uint8Array.from(writeMidi({ header: { format: 1, numTracks: 1, framesPerSecond: 25, ticksPerFrame: 40 }, tracks: [[ev(0, 'endOfTrack')]] }))
    expect(zh(importMidi(smpte).errors[0])).toMatch(/SMPTE/)
  })
})
