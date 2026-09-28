// Serializable project model (DAW_SPEC §8) and pure edit operations. Every musical edit
// returns a new project; the history layer bumps `revision`.

import { m, translate } from '../i18n/translate.js'
import { validateChord, voiceChord } from './chords.js'
import { isValidBpm, isValidTimeSignature, PPQ, ticksPerBar } from './time.js'

export const SCHEMA_VERSION = 1

let counter = 0
export const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function createTrack({ name, program = 0, isDrum = false, role = 'melody', soundbankId = null }) {
  return {
    id: newId('trk'), name, role, program, isDrum, soundbankId, volume: 100, pan: 0, mute: false, solo: false,
    clips: [{ id: newId('clip'), startTick: 0, lengthTick: 0, status: 'committed', origin: 'user', notes: [] }],
  }
}

/** Default names are written in the interface language at creation time (they are data). */
export function createProject(lang = 'zh') {
  const timeSignature = { numerator: 4, denominator: 4 }
  return {
    id: newId('prj'), schemaVersion: SCHEMA_VERSION, revision: 0, name: translate(lang, 'project.untitled'), ppq: PPQ,
    quarterBpm: 120, timeSignature, loopRange: { startTick: 0, endTick: ticksPerBar(timeSignature) * 4, enabled: false },
    keyContext: null, chordTrack: [], tracks: [createTrack({ name: translate(lang, 'project.firstTrack') })], generations: [], soundbanks: [],
  }
}

// "Twinkle, Twinkle" — same tune as research/sample_data.py, in quarter notes.
const TWINKLE = [[60, 0, 1], [60, 1, 1], [67, 2, 1], [67, 3, 1], [69, 4, 1], [69, 5, 1], [67, 6, 2],
  [65, 8, 1], [65, 9, 1], [64, 10, 1], [64, 11, 1], [62, 12, 1], [62, 13, 1], [60, 14, 2]]

export function createExampleProject(lang = 'zh') {
  const project = createProject(lang)
  project.name = translate(lang, 'project.example')
  return addNotes(project, project.tracks[0].id, TWINKLE.map(([pitch, beat, beats]) => ({
    pitch, startTick: beat * PPQ, durationTick: beats * PPQ, velocity: 80,
  })))
}

export const mainClip = (track) => track.clips[0]
/** Notes of a track with project-absolute ticks (one active clip per track in phase A). */
export const trackNotes = (track) => {
  const clip = mainClip(track)
  return clip.notes.map((n) => ({ ...n, startTick: clip.startTick + n.startTick }))
}
export const findTrack = (project, id) => project.tracks.find((t) => t.id === id)

export function audibleTrackIds(tracks) {
  const anySolo = tracks.some((t) => t.solo)
  return new Set(tracks.filter((t) => !t.mute && (!anySolo || t.solo)).map((t) => t.id))
}

// --- Project settings ------------------------------------------------------------------

export const setTempo = (p, quarterBpm) => {
  if (!isValidBpm(quarterBpm)) throw new Error(`tempo must be 20–300 BPM: ${quarterBpm}`)
  return { ...p, quarterBpm }
}
export const setTimeSignature = (p, timeSignature) => {
  if (!isValidTimeSignature(timeSignature)) throw new Error('unsupported time signature')
  return { ...p, timeSignature: { ...timeSignature } }
}
export const setKeyContext = (p, keyContext) => ({ ...p, keyContext: keyContext ? { ...keyContext } : null })
export const renameProject = (p, name) => ({ ...p, name })

// --- Tracks ----------------------------------------------------------------------------

const mapTrack = (p, id, fn) => ({ ...p, tracks: p.tracks.map((t) => (t.id === id ? fn(t) : t)) })
const mapClipNotes = (p, id, fn) => mapTrack(p, id, (t) => {
  const [clip, ...rest] = t.clips
  const notes = fn(clip.notes)
  const lengthTick = notes.reduce((m, n) => Math.max(m, n.startTick + n.durationTick), 0)
  return { ...t, clips: [{ ...clip, notes, lengthTick }, ...rest] }
})

export function addTrack(p, opts) {
  const track = createTrack(opts)
  return { project: { ...p, tracks: [...p.tracks, track] }, trackId: track.id }
}
export const deleteTrack = (p, id) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== id) })
export const renameTrack = (p, id, name) => mapTrack(p, id, (t) => ({ ...t, name }))
export const setTrackInstrument = (p, id, { program, isDrum }) => mapTrack(p, id, (t) => ({
  ...t, program, isDrum, role: isDrum ? 'drums' : t.role === 'drums' ? 'melody' : t.role,
}))
/** Monitoring-only fields (mute/solo/volume): not part of undo history or revision. */
export const setTrackMix = (p, id, mix) => mapTrack(p, id, (t) => ({ ...t, ...mix }))

// --- Notes -----------------------------------------------------------------------------

const cleanNote = (n) => ({
  id: n.id ?? newId('n'),
  pitch: Math.min(127, Math.max(0, Math.round(n.pitch))),
  startTick: Math.max(0, Math.round(n.startTick)),
  durationTick: Math.max(1, Math.round(n.durationTick)),
  velocity: Math.min(127, Math.max(1, Math.round(n.velocity ?? 80))),
})

export const addNotes = (p, trackId, notes) =>
  mapClipNotes(p, trackId, (existing) => [...existing, ...notes.map(cleanNote)])

/** updates: [{ id, pitch?, startTick?, durationTick?, velocity? }] */
export function updateNotes(p, trackId, updates) {
  const byId = new Map(updates.map((u) => [u.id, u]))
  return mapClipNotes(p, trackId, (notes) => notes.map((n) => (byId.has(n.id) ? cleanNote({ ...n, ...byId.get(n.id) }) : n)))
}

export const deleteNotes = (p, trackId, ids) => {
  const drop = new Set(ids)
  return mapClipNotes(p, trackId, (notes) => notes.filter((n) => !drop.has(n.id)))
}

/** Explicit quantize: starts and ends to the grid, never shorter than one grid step. */
export function quantizeNotes(p, trackId, ids, grid) {
  const pick = ids ? new Set(ids) : null
  return mapClipNotes(p, trackId, (notes) => notes.map((n) => {
    if (pick && !pick.has(n.id)) return n
    const start = Math.round(n.startTick / grid) * grid
    const end = Math.max(start + grid, Math.round((n.startTick + n.durationTick) / grid) * grid)
    return { ...n, startTick: start, durationTick: end - start }
  }))
}

// --- Chord track -----------------------------------------------------------------------
// Events use half-open ranges [startTick, startTick + durationTick) and never overlap.

const endOf = (e) => e.startTick + e.durationTick

/** Existing events a write over [start, end) would remove or shorten. */
export function chordConflicts(chordTrack, startTick, endTick, excludeId = null) {
  return chordTrack.filter((e) => e.id !== excludeId && e.startTick < endTick && endOf(e) > startTick)
    .map((e) => ({
      event: e,
      action: e.startTick >= startTick && endOf(e) <= endTick ? 'remove'
        : e.startTick < startTick && endOf(e) > endTick ? 'split'
          : e.startTick < startTick ? 'trim-end' : 'trim-start',
    }))
}

/** Write an event, trimming/splitting/removing what it overlaps (one undoable step). */
export function placeChord(p, event, { excludeId = null } = {}) {
  const start = event.startTick, end = endOf(event)
  const out = []
  for (const e of p.chordTrack) {
    if (e.id === excludeId) continue
    if (endOf(e) <= start || e.startTick >= end) { out.push(e); continue }
    if (e.startTick < start) out.push({ ...e, durationTick: start - e.startTick })
    if (endOf(e) > end) out.push({ ...e, id: e.startTick < start ? newId('chd') : e.id, startTick: end, durationTick: endOf(e) - end })
  }
  out.push({ id: newId('chd'), ...event })
  out.sort((a, b) => a.startTick - b.startTick)
  return { ...p, chordTrack: out }
}

export function updateChord(p, id, changes) {
  const current = p.chordTrack.find((e) => e.id === id)
  return placeChord(p, { ...current, ...changes, id }, { excludeId: id })
}

export const deleteChord = (p, id) => ({ ...p, chordTrack: p.chordTrack.filter((e) => e.id !== id) })

export function copyChord(p, id, startTick) {
  const { id: _omit, ...rest } = p.chordTrack.find((e) => e.id === id)
  return placeChord(p, { ...rest, startTick })
}

/**
 * Block chords for the confirmed chord events inside [startTick, endTick): the dictionary
 * voicing (slash bass included), clipped to the range. N.C. and gaps give no notes; the
 * chord track itself is left unchanged.
 */
export function chordTrackNotes(chordTrack, { startTick = 0, endTick = Infinity, velocity = 80 } = {}) {
  const notes = []
  for (const e of chordTrack) {
    if (e.status !== 'confirmed' || e.kind !== 'chord') continue
    const a = Math.max(e.startTick, startTick)
    const b = Math.min(e.startTick + e.durationTick, endTick)
    if (b <= a) continue
    for (const pitch of voiceChord(e.chord)) notes.push({ pitch, startTick: a, durationTick: b - a, velocity })
  }
  return notes
}

// --- Validation and serialization ------------------------------------------------------

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && (max === undefined || v <= max)

/**
 * Validate an opened project file. Returns { ok: true, project } or { ok: false, errors }
 * (error message descriptors). Unknown top-level fields are dropped; missing optional fields
 * get defaults.
 */
export function validateProject(data, lang = 'zh') {
  const errors = []
  const err = (key, params) => errors.push(m(key, params))
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: [m('project.err.notObject')] }
  if (data.schemaVersion !== SCHEMA_VERSION) err('project.err.schema', { got: String(data.schemaVersion), want: SCHEMA_VERSION })
  if (data.ppq !== PPQ) err('project.err.ppq', { want: PPQ, got: String(data.ppq) })
  if (!isValidBpm(data.quarterBpm)) err('project.err.bpm', { got: String(data.quarterBpm) })
  if (!isValidTimeSignature(data.timeSignature)) err('project.err.ts')
  if (!Array.isArray(data.tracks) || !data.tracks.length) err('project.err.tracks')
  const ids = new Set()
  const unique = (id, at) => {
    if (typeof id !== 'string' || !id) err('project.err.noId', { at })
    else if (ids.has(id)) err('project.err.dupId', { id })
    else ids.add(id)
  }
  for (const [ti, t] of (Array.isArray(data.tracks) ? data.tracks : []).entries()) {
    const at = `tracks[${ti}]`
    unique(t?.id, at)
    if (typeof t?.name !== 'string') err('project.err.trackName', { at })
    if (!isInt(t?.program, 0, 127)) err('project.err.program', { at })
    if (typeof t?.isDrum !== 'boolean') err('project.err.isDrum', { at })
    if (t?.volume !== undefined && !isInt(t.volume, 0, 127)) err('project.err.volume', { at })
    if (!Array.isArray(t?.clips) || t.clips.length !== 1) { err('project.err.clips', { at }); continue }
    const clip = t.clips[0]
    unique(clip?.id, `${at}.clips[0]`)
    if (!isInt(clip?.startTick, 0)) err('project.err.clipStart', { at })
    if (!Array.isArray(clip?.notes)) { err('project.err.notes', { at }); continue }
    for (const [ni, n] of clip.notes.entries()) {
      const an = `${at}.notes[${ni}]`
      unique(n?.id, an)
      if (!isInt(n?.pitch, 0, 127)) err('project.err.pitch', { at: an })
      if (!isInt(n?.startTick, 0)) err('project.err.noteStart', { at: an })
      if (!isInt(n?.durationTick, 1)) err('project.err.noteDuration', { at: an })
      if (!isInt(n?.velocity, 1, 127)) err('project.err.velocity', { at: an })
    }
  }
  const chords = Array.isArray(data.chordTrack) ? data.chordTrack : (err('project.err.chordTrack'), [])
  const sorted = [...chords].sort((a, b) => a.startTick - b.startTick)
  for (const [ci, e] of sorted.entries()) {
    const at = `chordTrack[${chords.indexOf(e)}]`
    unique(e?.id, at)
    if (!isInt(e?.startTick, 0) || !isInt(e?.durationTick, 1)) err('project.err.chordTime', { at })
    if (e?.kind === 'chord') {
      const msg = validateChord(e.chord)
      if (msg) err('project.err.chord', { at, msg })
    } else if (e?.kind === 'no_chord') {
      if (e.chord != null) err('project.err.ncChord', { at })
    } else err('project.err.kind', { at })
    if (!['manual', 'midi_detected', 'harmonized'].includes(e?.source)) err('project.err.source', { at })
    if (!['suggested', 'confirmed'].includes(e?.status)) err('project.err.status', { at })
    if (ci > 0 && sorted[ci - 1].startTick + sorted[ci - 1].durationTick > e?.startTick) err('project.err.overlap', { at })
  }
  const k = data.keyContext
  if (k != null && (!isInt(k.tonicPc, 0, 11) || !['major', 'minor'].includes(k.mode)
    || typeof k.tonicSpelling !== 'string' || !['user', 'inferred'].includes(k.source)
    || !['suggested', 'confirmed'].includes(k.status))) err('project.err.key')
  const loop = data.loopRange
  if (loop && (!isInt(loop.startTick, 0) || !isInt(loop.endTick, 1) || loop.endTick <= loop.startTick)) err('project.err.loop')
  if (errors.length) return { ok: false, errors }

  const project = {
    id: typeof data.id === 'string' ? data.id : newId('prj'), schemaVersion: SCHEMA_VERSION,
    revision: isInt(data.revision, 0) ? data.revision : 0, name: typeof data.name === 'string' ? data.name : translate(lang, 'project.untitled'),
    ppq: PPQ, quarterBpm: data.quarterBpm, timeSignature: { numerator: data.timeSignature.numerator, denominator: data.timeSignature.denominator },
    loopRange: loop ? { startTick: loop.startTick, endTick: loop.endTick, enabled: !!loop.enabled }
      : { startTick: 0, endTick: ticksPerBar(data.timeSignature) * 4, enabled: false },
    keyContext: k ?? null,
    chordTrack: sorted,
    tracks: data.tracks.map((t) => ({
      id: t.id, name: t.name, role: t.role ?? (t.isDrum ? 'drums' : 'melody'), program: t.program, isDrum: t.isDrum,
      soundbankId: t.soundbankId ?? null, volume: t.volume ?? 100, pan: t.pan ?? 0, mute: !!t.mute, solo: !!t.solo,
      clips: t.clips.map((c) => ({ ...c, status: c.status ?? 'committed', origin: c.origin ?? 'user', lengthTick: c.lengthTick ?? 0 })),
    })),
    generations: Array.isArray(data.generations) ? data.generations : [],
    soundbanks: Array.isArray(data.soundbanks) ? data.soundbanks : [],
  }
  return { ok: true, project }
}

export const serializeProject = (p) => JSON.stringify(p, null, 2)

export function parseProjectFile(text, lang = 'zh') {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [m('project.err.json', { msg: e.message })] }
  }
  return validateProject(data, lang)
}
