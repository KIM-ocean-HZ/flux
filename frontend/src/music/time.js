// Project time model: integer ticks at a fixed PPQ; tempo is always quarter-note BPM.

export const PPQ = 960
export const BPM_MIN = 20
export const BPM_MAX = 300
export const TS_NUMERATORS = Array.from({ length: 12 }, (_, i) => i + 1)
export const TS_DENOMINATORS = [2, 4, 8, 16]
export const TS_PRESETS = [
  { numerator: 4, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 6, denominator: 8 },
]

// Note values in ticks, used by the editing grid and the step-input duration.
export const NOTE_VALUES = [
  { id: '1/1', label: '全音符', ticks: PPQ * 4 },
  { id: '1/2', label: '1/2', ticks: PPQ * 2 },
  { id: '1/4', label: '1/4', ticks: PPQ },
  { id: '1/8', label: '1/8', ticks: PPQ / 2 },
  { id: '1/16', label: '1/16', ticks: PPQ / 4 },
  { id: '1/4T', label: '1/4 三连音', ticks: (PPQ * 2) / 3 },
  { id: '1/8T', label: '1/8 三连音', ticks: PPQ / 3 },
  { id: '1/16T', label: '1/16 三连音', ticks: PPQ / 6 },
]
export const noteValueTicks = (id) => NOTE_VALUES.find((v) => v.id === id)?.ticks

export function isValidBpm(bpm) {
  return typeof bpm === 'number' && Number.isFinite(bpm) && bpm >= BPM_MIN && bpm <= BPM_MAX
}

export function isValidTimeSignature(ts) {
  return !!ts && Number.isInteger(ts.numerator) && TS_NUMERATORS.includes(ts.numerator)
    && TS_DENOMINATORS.includes(ts.denominator)
}

/** Ticks of one notated beat (the denominator's note value). */
export const ticksPerDenominatorBeat = (ts) => (PPQ * 4) / ts.denominator
/** Ticks per bar = ppq × numerator × 4 / denominator. */
export const ticksPerBar = (ts) => ts.numerator * ticksPerDenominatorBeat(ts)

/**
 * Compound meters (6/8, 9/8, 12/8, and the /16 equivalents) pulse in dotted groups of
 * three denominator beats; everything else pulses on each denominator beat.
 */
export function isCompound(ts) {
  return ts.denominator >= 8 && ts.numerator % 3 === 0 && ts.numerator > 3
}

export function pulse(ts) {
  const beat = ticksPerDenominatorBeat(ts)
  return isCompound(ts)
    ? { ticks: beat * 3, perBar: ts.numerator / 3 }
    : { ticks: beat, perBar: ts.numerator }
}

export const ticksToSeconds = (ticks, bpm) => (ticks * 60) / (PPQ * bpm)
export const secondsToTicks = (seconds, bpm) => (seconds * PPQ * bpm) / 60

/**
 * Metronome/grid accent at a tick: 'bar' on downbeats, 'beat' on pulse starts,
 * 'sub' on other denominator beats (the eighths inside a 6/8 group), else null.
 */
export function accentAt(tick, ts) {
  if (tick % ticksPerBar(ts) === 0) return 'bar'
  if (tick % pulse(ts).ticks === 0) return 'beat'
  if (tick % ticksPerDenominatorBeat(ts) === 0) return 'sub'
  return null
}

/** Pulse positions with their accents inside [startTick, endTick). */
export function pulsesBetween(startTick, endTick, ts) {
  const step = pulse(ts).ticks
  const out = []
  for (let t = Math.ceil(startTick / step) * step; t < endTick; t += step) {
    out.push({ tick: t, accent: accentAt(t, ts) })
  }
  return out
}

/** 1-based "bar.pulse.sixteenth" position text. Negative ticks show the count-in. */
export function formatPosition(tick, ts) {
  if (tick < 0) return `倒数 ${Math.ceil(-tick / pulse(ts).ticks)}`
  const bar = Math.floor(tick / ticksPerBar(ts))
  const inBar = tick - bar * ticksPerBar(ts)
  const p = pulse(ts)
  const beat = Math.floor(inBar / p.ticks)
  const sixteenth = Math.floor((inBar - beat * p.ticks) / (PPQ / 4))
  return `${bar + 1}.${beat + 1}.${sixteenth + 1}`
}

/** Parse "bar" or "bar.pulse" (1-based, pulse may be fractional) into ticks; null when invalid. */
export function parsePosition(text, ts) {
  const m = /^\s*(\d+)(?:\.(\d+(?:\.\d+)?))?\s*$/.exec(text)
  if (!m) return null
  const bar = Number(m[1])
  const beat = m[2] === undefined ? 1 : Number(m[2])
  const p = pulse(ts)
  if (bar < 1 || beat < 1 || beat >= p.perBar + 1) return null
  return Math.round((bar - 1) * ticksPerBar(ts) + (beat - 1) * p.ticks)
}

export const snapTick = (tick, grid) => Math.round(tick / grid) * grid
export const floorTick = (tick, grid) => Math.floor(tick / grid) * grid
