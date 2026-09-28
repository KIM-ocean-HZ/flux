import { describe, expect, it } from 'vitest'
import { TransportScheduler } from '../src/audio/scheduler.js'

const TS44 = { numerator: 4, denominator: 4 }
const note = (trackId, pitch, startTick, durationTick) => ({ trackId, pitch, velocity: 90, startTick, durationTick })

function make(opts) {
  const events = []
  const sink = {
    noteOn: (trackId, pitch, velocity, time) => events.push({ type: 'on', trackId, pitch, time }),
    noteOff: (trackId, pitch, time) => events.push({ type: 'off', trackId, pitch, time }),
    click: (accent, time) => events.push({ type: 'click', accent, time }),
  }
  const s = new TransportScheduler({ anchorTime: 10, anchorTick: 0, bpm: 120, timeSignature: TS44, sink, ...opts })
  return { s, events }
}

// Drive the scheduler like the engine's timer: small steps with a lookahead window.
function runUntil(s, endTime, step = 0.025, lookahead = 0.12) {
  for (let t = s.anchorTime - 5; t < endTime; t += step) s.advance(t + lookahead)
}

describe('audio-clock scheduling (A-04)', () => {
  it('computes absolute times from ticks and tempo; 60 BPM doubles the same ticks', () => {
    const notes = [note('a', 60, 0, 960), note('a', 62, 3840, 960)]
    const fast = make({ notes })
    const slow = make({ notes, bpm: 60 })
    runUntil(fast.s, 20); runUntil(slow.s, 30)
    const times = (ev) => ev.filter((e) => e.type !== 'click').map((e) => [e.type, e.pitch, +(e.time - 10).toFixed(9)])
    expect(times(fast.events)).toEqual([['on', 60, 0], ['off', 60, 0.5], ['on', 62, 2], ['off', 62, 2.5]])
    expect(times(slow.events)).toEqual([['on', 60, 0], ['off', 60, 1], ['on', 62, 4], ['off', 62, 5]])
  })

  it('never sends the same event twice across overlapping windows', () => {
    const notes = Array.from({ length: 64 }, (_, i) => note('a', 60 + (i % 12), i * 240, 200))
    const { s, events } = make({ notes })
    for (let t = 9; t < 20; t += 0.003) s.advance(t + 0.12)
    expect(events.filter((e) => e.type === 'on')).toHaveLength(64)
    expect(events.filter((e) => e.type === 'off')).toHaveLength(64)
  })

  it('clicks the metronome with 3/4 and 6/8 accents, and counts in one bar', () => {
    const three = make({ metronome: true, timeSignature: { numerator: 3, denominator: 4 } })
    runUntil(three.s, 10 + 2.8)
    expect(three.events.map((e) => e.accent)).toEqual(['bar', 'beat', 'beat', 'bar', 'beat', 'beat'])
    const six = make({ metronome: true, timeSignature: { numerator: 6, denominator: 8 }, countInTicks: 2880 })
    runUntil(six.s, 10 + 2.8)
    expect(six.events.map((e) => [e.accent, +(e.time - 10).toFixed(6)])).toEqual([
      ['bar', -1.5], ['beat', -0.75], ['bar', 0], ['beat', 0.75], ['bar', 1.5], ['beat', 2.25]])
    expect(six.s.tickAt(9)).toBe(-1920)
  })
})

describe('isolation and hanging notes (A-02)', () => {
  it('keeps same-pitch notes of two tracks independent', () => {
    const { s, events } = make({ notes: [note('a', 60, 0, 3840), note('b', 60, 960, 960)] })
    runUntil(s, 13)
    const offB = events.find((e) => e.type === 'off' && e.trackId === 'b')
    const offA = events.find((e) => e.type === 'off' && e.trackId === 'a')
    expect(offB.time - 10).toBe(1)
    expect(offA.time - 10).toBe(2)
  })

  it('does not let an overlapping same-pitch note in one track cut the later one', () => {
    const { s, events } = make({ notes: [note('a', 60, 0, 960), note('a', 60, 480, 960)] })
    runUntil(s, 12)
    const offs = events.filter((e) => e.type === 'off')
    expect(offs).toHaveLength(1)
    expect(offs[0].time - 10).toBe(0.75)
  })

  it('flush on stop releases every note the transport still holds', () => {
    const { s, events } = make({ notes: [note('a', 60, 0, 9600), note('b', 64, 0, 9600)] })
    runUntil(s, 10.5)
    expect(events.filter((e) => e.type === 'off')).toHaveLength(0)
    s.flush(10.6)
    expect(events.filter((e) => e.type === 'off').map((e) => [e.trackId, e.time])).toEqual([['a', 10.6], ['b', 10.6]])
    expect(s.scheduledUntil).toBeLessThan(10.5 + 0.12 + 1e-9)
  })

  it('edits during playback do not orphan an already started note', () => {
    const notes = [note('a', 60, 0, 1920)]
    const { s, events } = make({ notes })
    runUntil(s, 10.2)
    s.setNotes([]) // the note is deleted while sounding
    runUntil(s, 12)
    expect(events.map((e) => e.type)).toEqual(['on', 'off'])
  })
})

describe('loops without drift (A-04, A-09)', () => {
  it('truncates at the loop end, retriggers next pass, and stays on the absolute grid', () => {
    const loop = { start: 0, end: 3840 }
    const { s, events } = make({ loop, notes: [note('a', 60, 0, 960), note('a', 67, 3000, 1800)] })
    const passes = 150 // 5 minutes at 2 s per bar
    runUntil(s, 10 + passes * 2 + 0.01, 0.025)
    const ons = events.filter((e) => e.type === 'on' && e.pitch === 60)
    expect(ons.length).toBeGreaterThanOrEqual(passes)
    ons.forEach((e, k) => expect(e.time).toBeCloseTo(10 + 2 * k, 9))
    const offs67 = events.filter((e) => e.type === 'off' && e.pitch === 67)
    offs67.forEach((e, k) => expect(e.time).toBeCloseTo(10 + 2 * (k + 1), 9))
    expect(s.tickAt(10 + 2 * 149 + 0.5)).toBeCloseTo(960, 6)
  })

  it('recording with a loop stops at the loop end instead of wrapping', () => {
    const { s, events } = make({ loop: { start: 0, end: 3840 }, stopAtLoopEnd: true, notes: [note('a', 60, 0, 480)] })
    runUntil(s, 20)
    expect(events.filter((e) => e.type === 'on')).toHaveLength(1)
    expect(s.tickAt(15)).toBe(3840)
  })

  it('ignores a loop that ends before the start position', () => {
    const { s } = make({ loop: { start: 0, end: 3840 }, anchorTick: 7680 })
    expect(s.loop).toBeNull()
    expect(s.tickAt(11)).toBe(7680 + 1920)
  })
})
