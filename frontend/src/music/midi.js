// Standard MIDI File exchange for fixed tempo / fixed meter projects. Chord-track controls are
// not written as notes; they stay lossless in the project JSON.

import { parseMidi, writeMidi } from 'midi-file'
import { m, translate } from '../i18n/translate.js'
import { createProject, createTrack, trackNotes } from './project.js'
import { isValidTimeSignature, PPQ, ticksPerBar } from './time.js'

const MELODIC_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15]
const DRUM_CHANNEL = 9

const encodeText = (s) => String.fromCharCode(...new TextEncoder().encode(s))
function decodeText(s) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff))
  } catch {
    return s
  }
}

/**
 * One port: each pitched track gets its own channel (so two tracks with the same program stay
 * independent); drum tracks share channel 10. Too many pitched tracks is an error, never a
 * silent merge; several drum tracks need explicit confirmation.
 */
export function planExport(project) {
  const melodic = project.tracks.filter((t) => !t.isDrum)
  const drums = project.tracks.filter((t) => t.isDrum)
  const errors = [], warnings = []
  if (melodic.length > MELODIC_CHANNELS.length) {
    errors.push(m('midi.err.tooManyTracks', { n: melodic.length, max: MELODIC_CHANNELS.length }))
  }
  if (drums.length > 1) {
    warnings.push(m('midi.warn.drumsShare', { n: drums.length }))
  }
  const channels = new Map()
  melodic.forEach((t, i) => channels.set(t.id, MELODIC_CHANNELS[i]))
  drums.forEach((t) => channels.set(t.id, DRUM_CHANNEL))
  return { ok: !errors.length, errors, warnings, channels }
}

function toDeltas(events) {
  let last = 0
  return events.map(({ tick, ...ev }) => {
    const out = { deltaTime: tick - last, ...ev }
    last = tick
    return out
  })
}

const ORDER = { trackName: 0, setTempo: 1, timeSignature: 2, programChange: 3, controller: 4, noteOff: 5, noteOn: 6 }

export function exportMidi(project, plan = planExport(project)) {
  if (!plan.ok) throw new Error(plan.errors.map((e) => translate('en', e)).join('\n'))
  const { numerator, denominator } = project.timeSignature
  const conductor = [
    { tick: 0, type: 'trackName', text: encodeText(project.name) },
    { tick: 0, type: 'setTempo', microsecondsPerBeat: Math.round(60e6 / project.quarterBpm) },
    { tick: 0, type: 'timeSignature', numerator, denominator, metronome: 24, thirtyseconds: 8 },
    { tick: 0, type: 'endOfTrack' },
  ]
  const tracks = project.tracks.map((t) => {
    const channel = plan.channels.get(t.id)
    const events = [
      { tick: 0, type: 'trackName', text: encodeText(t.name) },
      { tick: 0, type: 'programChange', channel, programNumber: t.program },
      { tick: 0, type: 'controller', channel, controllerType: 7, value: t.volume },
    ]
    for (const n of trackNotes(t)) {
      events.push({ tick: n.startTick, type: 'noteOn', channel, noteNumber: n.pitch, velocity: n.velocity })
      events.push({ tick: n.startTick + n.durationTick, type: 'noteOff', channel, noteNumber: n.pitch, velocity: 0 })
    }
    events.sort((a, b) => a.tick - b.tick || ORDER[a.type] - ORDER[b.type])
    events.push({ tick: events[events.length - 1].tick, type: 'endOfTrack' })
    return toDeltas(events)
  })
  return Uint8Array.from(writeMidi({
    header: { format: 1, numTracks: tracks.length + 1, ticksPerBeat: PPQ },
    tracks: [toDeltas(conductor), ...tracks],
  }))
}

const IGNORED_META = new Set(['text', 'copyrightNotice', 'instrumentName', 'lyrics', 'marker', 'cuePoint',
  'endOfTrack', 'sequenceNumber', 'channelPrefix', 'portPrefix', 'smpteOffset', 'sequencerSpecific',
  'unknownMeta', 'keySignature'])

/**
 * Parse a SMF into a new project. Returns { ok, project, limitations, notices, stats } or
 * { ok: false, errors }; messages are descriptors. `limitations` lists information that would
 * be lost (tempo/meter changes, CC, pitch bend, …): the caller must let the user cancel before
 * importing. Default track names are written in `lang`.
 */
export function importMidi(bytes, { name, lang = 'zh' } = {}) {
  let parsed
  try {
    parsed = parseMidi(bytes)
  } catch (e) {
    return { ok: false, errors: [m('midi.err.parse', { msg: String(e?.message ?? e) })] }
  }
  const { header } = parsed
  if (header.framesPerSecond) return { ok: false, errors: [m('midi.err.smpte')] }
  if (header.format === 2) return { ok: false, errors: [m('midi.err.format2')] }
  const tpb = header.ticksPerBeat
  let rounded = 0
  const conv = (t) => {
    const exact = (t * PPQ) / tpb
    const r = Math.round(exact)
    if (Math.abs(r - exact) > 1e-9) rounded++
    return r
  }
  const tempos = [], sigs = [], lost = new Map(), notices = []
  const count = (key, params) => {
    const id = JSON.stringify([key, params])
    lost.set(id, (lost.get(id) ?? 0) + 1)
  }
  const parts = new Map()
  let unmatched = 0, unclosed = 0

  parsed.tracks.forEach((track, ti) => {
    let tick = 0, trackName = null
    const partOf = (ch) => {
      const key = `${ti}:${ch}`
      if (!parts.has(key)) parts.set(key, { ti, channel: ch, programs: [], volumes: [], notes: [], open: new Map() })
      return parts.get(key)
    }
    for (const ev of track) {
      tick += ev.deltaTime
      switch (ev.type) {
        case 'trackName': trackName ??= decodeText(ev.text); break
        case 'setTempo': tempos.push({ tick, value: ev.microsecondsPerBeat }); break
        case 'timeSignature': sigs.push({ tick, value: `${ev.numerator}/${ev.denominator}`, ts: { numerator: ev.numerator, denominator: ev.denominator } }); break
        case 'noteOn': {
          const part = partOf(ev.channel)
          const stack = part.open.get(ev.noteNumber) ?? []
          stack.push({ tick, velocity: ev.velocity })
          part.open.set(ev.noteNumber, stack)
          break
        }
        case 'noteOff': {
          const part = partOf(ev.channel)
          const on = part.open.get(ev.noteNumber)?.shift()
          if (!on) { unmatched++; break }
          part.notes.push({ pitch: ev.noteNumber, velocity: on.velocity, start: on.tick, end: tick })
          break
        }
        case 'programChange': partOf(ev.channel).programs.push({ tick, value: ev.programNumber }); break
        case 'controller':
          if (ev.controllerType === 7) partOf(ev.channel).volumes.push({ tick, value: ev.value })
          else if (ev.controllerType === 64) count('midi.what.cc64')
          else if (ev.controllerType === 0 || ev.controllerType === 32) count('midi.what.bank')
          else count('midi.what.cc', { n: ev.controllerType })
          break
        case 'pitchBend': count('midi.what.pitchBend'); break
        case 'channelAftertouch': case 'noteAftertouch': count('midi.what.aftertouch'); break
        case 'sysEx': case 'endSysEx': count('midi.what.sysex'); break
        default: if (!IGNORED_META.has(ev.type)) count('midi.what.event', { type: ev.type })
      }
    }
    for (const part of parts.values()) {
      if (part.ti !== ti) continue
      part.trackName = trackName
      for (const [pitch, stack] of part.open) {
        for (const on of stack) {
          unclosed++
          part.notes.push({ pitch, velocity: on.velocity, start: on.tick, end: tick })
        }
      }
      part.open.clear()
    }
  })

  const limitations = [...lost].map(([id, n]) => {
    const [key, params] = JSON.parse(id)
    return m('midi.lost', { what: m(key, params ?? undefined), n })
  })
  const earliest = (notes) => notes.reduce((m, n) => Math.min(m, n.start), Infinity)
  const firstNote = [...parts.values()].reduce((m, p) => Math.min(m, earliest(p.notes)), Infinity)
  const distinct = (list, dflt) => {
    const values = list.map((e) => e.value)
    if (!list.length || (list[0].tick > 0 && list[0].tick > firstNote)) values.unshift(dflt)
    return [...new Set(values)]
  }
  const tempoValues = distinct(tempos, 500000)
  let quarterBpm = 60e6 / (tempos[0]?.value ?? 500000)
  if (!tempos.length) notices.push(m('midi.notice.noTempo'))
  if (tempoValues.length > 1) limitations.push(m('midi.limit.tempoChanges', { n: tempoValues.length - 1, bpm: quarterBpm.toFixed(2) }))
  if (quarterBpm < 20 || quarterBpm > 300) {
    limitations.push(m('midi.limit.tempoRange', { bpm: quarterBpm.toFixed(2), clamped: quarterBpm < 20 ? 20 : 300 }))
    quarterBpm = quarterBpm < 20 ? 20 : 300
  }
  const sigValues = distinct(sigs, '4/4')
  let timeSignature = sigs[0]?.ts ?? { numerator: 4, denominator: 4 }
  if (sigValues.length > 1) limitations.push(m('midi.limit.meterChanges', { n: sigValues.length - 1, ts: `${timeSignature.numerator}/${timeSignature.denominator}` }))
  if (!isValidTimeSignature(timeSignature)) {
    limitations.push(m('midi.limit.meterRange', { ts: `${timeSignature.numerator}/${timeSignature.denominator}` }))
    timeSignature = { numerator: 4, denominator: 4 }
  }
  if (unclosed) limitations.push(m('midi.limit.unclosed', { n: unclosed }))
  if (unmatched) notices.push(m('midi.notice.unmatched', { n: unmatched }))

  const project = createProject(lang)
  project.name = name ?? translate(lang, 'midi.defaultName')
  project.quarterBpm = quarterBpm
  project.timeSignature = { ...timeSignature }
  project.loopRange = { startTick: 0, endTick: ticksPerBar(timeSignature) * 4, enabled: false }
  const withNotes = [...parts.values()].filter((p) => p.notes.length)
    .sort((a, b) => a.ti - b.ti || a.channel - b.channel)
  const channelsPerTrack = new Map()
  for (const p of withNotes) channelsPerTrack.set(p.ti, (channelsPerTrack.get(p.ti) ?? 0) + 1)
  if (withNotes.length) {
    project.tracks = withNotes.map((p, i) => {
      const base = p.trackName || translate(lang, 'project.trackN', { n: i + 1 })
      const isDrum = p.channel === DRUM_CHANNEL
      const first = earliest(p.notes)
      const settle = (list, label, dflt) => {
        const before = list.filter((e) => e.tick <= first)
        const value = (before.length ? before[before.length - 1] : list[0])?.value ?? dflt
        const later = new Set(list.filter((e) => e.tick > first).map((e) => e.value))
        later.delete(value)
        if (later.size) {
          limitations.push(m('midi.limit.midTrackChange', {
            track: base, what: m(label), n: list.filter((e) => e.tick > first).length, value: label === 'midi.what.program' ? `Program ${value + 1}` : value,
          }))
        }
        return value
      }
      const track = createTrack({
        name: channelsPerTrack.get(p.ti) > 1 ? translate(lang, 'midi.trackChannel', { base, ch: p.channel + 1 }) : base,
        program: isDrum ? 0 : settle(p.programs, 'midi.what.program', 0), isDrum, role: isDrum ? 'drums' : 'melody',
      })
      if (isDrum && p.programs.some((e) => e.value !== 0)) limitations.push(m('midi.limit.drumProgram', { track: base }))
      track.volume = settle(p.volumes, 'midi.what.volume', 100)
      const notes = p.notes.map((n) => {
        const startTick = conv(n.start)
        return { pitch: n.pitch, velocity: Math.max(1, n.velocity), startTick, durationTick: Math.max(1, conv(n.end) - startTick) }
      }).sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch)
      const clip = track.clips[0]
      clip.notes = notes.map((n, j) => ({ id: `${track.id}_n${j}`, ...n }))
      clip.lengthTick = notes.reduce((m, n) => Math.max(m, n.startTick + n.durationTick), 0)
      return track
    })
  }
  if (rounded) limitations.push(m('midi.limit.ppqRounded', { ppq: tpb, n: rounded, target: PPQ }))
  const noteCount = project.tracks.reduce((s, t) => s + t.clips[0].notes.length, 0)
  return { ok: true, project, limitations, notices, stats: { tracks: project.tracks.length, notes: noteCount, sourcePpq: tpb, format: header.format } }
}
