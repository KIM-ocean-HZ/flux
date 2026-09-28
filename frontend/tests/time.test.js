import { describe, expect, it } from 'vitest'
import {
  accentAt, countInPulses, formatPosition, isValidBpm, isValidTimeSignature, noteValueTicks, parsePosition, PPQ, pulse,
  pulsesBetween, secondsToTicks, ticksPerBar, ticksToSeconds,
} from '../src/music/time.js'

const ts = (numerator, denominator) => ({ numerator, denominator })

describe('tick / second / bar conversion (A-04)', () => {
  it('uses ppq 960 and integer bar lengths', () => {
    expect(PPQ).toBe(960)
    expect(ticksPerBar(ts(4, 4))).toBe(3840)
    expect(ticksPerBar(ts(3, 4))).toBe(2880)
    expect(ticksPerBar(ts(6, 8))).toBe(2880)
    expect(ticksPerBar(ts(7, 16))).toBe(1680)
  })

  it('treats BPM as quarter notes: 120 → 60 doubles the duration of the same ticks', () => {
    const bar = ticksPerBar(ts(4, 4))
    expect(ticksToSeconds(bar, 120)).toBe(2)
    expect(ticksToSeconds(bar, 60)).toBe(4)
    expect(ticksToSeconds(bar * 4, 60)).toBe(2 * ticksToSeconds(bar * 4, 120))
    expect(secondsToTicks(ticksToSeconds(12345, 97), 97)).toBeCloseTo(12345, 9)
  })

  it('keeps 6/8 in two dotted-quarter pulses and 3/4 in three beats', () => {
    expect(pulse(ts(6, 8))).toEqual({ ticks: 1440, perBar: 2 })
    expect(pulse(ts(3, 4))).toEqual({ ticks: 960, perBar: 3 })
    expect(pulse(ts(12, 8))).toEqual({ ticks: 1440, perBar: 4 })
    expect(pulse(ts(3, 8))).toEqual({ ticks: 480, perBar: 3 })
  })

  it('accents downbeats, pulses and the eighths inside a 6/8 group', () => {
    const six = ts(6, 8)
    expect([0, 480, 960, 1440, 1920, 2400].map((t) => accentAt(t, six)))
      .toEqual(['bar', 'sub', 'sub', 'beat', 'sub', 'sub'])
    expect(pulsesBetween(0, 2880 * 2, six).map((p) => p.accent)).toEqual(['bar', 'beat', 'bar', 'beat'])
    expect(pulsesBetween(0, 2880, ts(3, 4)).map((p) => [p.tick, p.accent]))
      .toEqual([[0, 'bar'], [960, 'beat'], [1920, 'beat']])
  })

  it('formats and parses bar.beat positions in the current meter', () => {
    expect(formatPosition(0, ts(4, 4))).toBe('1.1.1')
    expect(formatPosition(3840 + 960 + 240, ts(4, 4))).toBe('2.2.2')
    expect(formatPosition(1440, ts(6, 8))).toBe('1.2.1')
    expect(parsePosition('3.2', ts(3, 4))).toBe(2880 * 2 + 960)
    expect(parsePosition('2', ts(6, 8))).toBe(2880)
    expect(parsePosition('1.4', ts(3, 4))).toBeNull()
    expect(countInPulses(-500, ts(4, 4))).toBe(1)
    expect(countInPulses(-1921, ts(4, 4))).toBe(3)
  })

  it('validates the supported BPM and meter ranges', () => {
    expect([19.9, 20, 300, 300.1].map(isValidBpm)).toEqual([false, true, true, false])
    expect(isValidTimeSignature(ts(12, 16))).toBe(true)
    expect(isValidTimeSignature(ts(13, 4))).toBe(false)
    expect(isValidTimeSignature(ts(4, 3))).toBe(false)
  })

  it('has integer tick values for every grid and triplet', () => {
    for (const id of ['1/4', '1/8', '1/16', '1/4T', '1/8T', '1/16T']) expect(Number.isInteger(noteValueTicks(id))).toBe(true)
    expect(noteValueTicks('1/8T') * 3).toBe(noteValueTicks('1/4'))
  })
})
