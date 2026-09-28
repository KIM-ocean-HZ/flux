// Serializable project model (DAW_SPEC §8) and pure edit operations. Every musical edit
// returns a new project; the history layer bumps `revision`.

import { validateChord } from './chords.js'
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

export function createProject() {
  const timeSignature = { numerator: 4, denominator: 4 }
  return {
    id: newId('prj'), schemaVersion: SCHEMA_VERSION, revision: 0, name: '未命名项目', ppq: PPQ,
    quarterBpm: 120, timeSignature, loopRange: { startTick: 0, endTick: ticksPerBar(timeSignature) * 4, enabled: false },
    keyContext: null, chordTrack: [], tracks: [createTrack({ name: '旋律 1' })], generations: [], soundbanks: [],
  }
}

// "Twinkle, Twinkle" — same tune as research/sample_data.py, in quarter notes.
const TWINKLE = [[60, 0, 1], [60, 1, 1], [67, 2, 1], [67, 3, 1], [69, 4, 1], [69, 5, 1], [67, 6, 2],
  [65, 8, 1], [65, 9, 1], [64, 10, 1], [64, 11, 1], [62, 12, 1], [62, 13, 1], [60, 14, 2]]

export function createExampleProject() {
  const project = createProject()
  project.name = '示例：小星星'
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
  if (!isValidBpm(quarterBpm)) throw new Error(`速度须在 20–300 BPM 之间：${quarterBpm}`)
  return { ...p, quarterBpm }
}
export const setTimeSignature = (p, timeSignature) => {
  if (!isValidTimeSignature(timeSignature)) throw new Error('拍号超出支持范围')
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

// --- Validation and serialization ------------------------------------------------------

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && (max === undefined || v <= max)

/**
 * Validate an opened project file. Returns { ok: true, project } or { ok: false, errors }.
 * Unknown top-level fields are dropped; missing optional fields get defaults.
 */
export function validateProject(data) {
  const errors = []
  const err = (m) => errors.push(m)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['文件内容不是 FLUX 项目对象'] }
  if (data.schemaVersion !== SCHEMA_VERSION) err(`不支持的 schemaVersion：${data.schemaVersion}（需要 ${SCHEMA_VERSION}）`)
  if (data.ppq !== PPQ) err(`ppq 须为 ${PPQ}，文件为 ${data.ppq}`)
  if (!isValidBpm(data.quarterBpm)) err(`quarterBpm 须在 20–300：${data.quarterBpm}`)
  if (!isValidTimeSignature(data.timeSignature)) err('timeSignature 无效（分子 1–12，分母 2/4/8/16）')
  if (!Array.isArray(data.tracks) || !data.tracks.length) err('tracks 须为非空数组')
  const ids = new Set()
  const unique = (id, where) => {
    if (typeof id !== 'string' || !id) err(`${where} 缺少 id`)
    else if (ids.has(id)) err(`重复 id：${id}`)
    else ids.add(id)
  }
  for (const [ti, t] of (Array.isArray(data.tracks) ? data.tracks : []).entries()) {
    const at = `tracks[${ti}]`
    unique(t?.id, at)
    if (typeof t?.name !== 'string') err(`${at}.name 须为字符串`)
    if (!isInt(t?.program, 0, 127)) err(`${at}.program 须为 0–127 的整数`)
    if (typeof t?.isDrum !== 'boolean') err(`${at}.isDrum 须为布尔值`)
    if (t?.volume !== undefined && !isInt(t.volume, 0, 127)) err(`${at}.volume 须为 0–127`)
    if (!Array.isArray(t?.clips) || t.clips.length !== 1) { err(`${at}.clips 须恰有一个片段（阶段 A）`); continue }
    const clip = t.clips[0]
    unique(clip?.id, `${at}.clips[0]`)
    if (!isInt(clip?.startTick, 0)) err(`${at}.clips[0].startTick 须为非负整数`)
    if (!Array.isArray(clip?.notes)) { err(`${at}.clips[0].notes 须为数组`); continue }
    for (const [ni, n] of clip.notes.entries()) {
      const an = `${at}.notes[${ni}]`
      unique(n?.id, an)
      if (!isInt(n?.pitch, 0, 127)) err(`${an}.pitch 须为 0–127 的整数`)
      if (!isInt(n?.startTick, 0)) err(`${an}.startTick 须为非负整数`)
      if (!isInt(n?.durationTick, 1)) err(`${an}.durationTick 须为正整数`)
      if (!isInt(n?.velocity, 1, 127)) err(`${an}.velocity 须为 1–127`)
    }
  }
  const chords = Array.isArray(data.chordTrack) ? data.chordTrack : (err('chordTrack 须为数组'), [])
  const sorted = [...chords].sort((a, b) => a.startTick - b.startTick)
  for (const [ci, e] of sorted.entries()) {
    const ac = `chordTrack[${chords.indexOf(e)}]`
    unique(e?.id, ac)
    if (!isInt(e?.startTick, 0) || !isInt(e?.durationTick, 1)) err(`${ac} 起点／时长须为整数 tick`)
    if (e?.kind === 'chord') {
      const msg = validateChord(e.chord)
      if (msg) err(`${ac}: ${msg}`)
    } else if (e?.kind === 'no_chord') {
      if (e.chord != null) err(`${ac}: N.C. 不应带 chord 字段`)
    } else err(`${ac}.kind 须为 chord 或 no_chord`)
    if (!['manual', 'midi_detected', 'harmonized'].includes(e?.source)) err(`${ac}.source 无效`)
    if (!['suggested', 'confirmed'].includes(e?.status)) err(`${ac}.status 无效`)
    if (ci > 0 && sorted[ci - 1].startTick + sorted[ci - 1].durationTick > e?.startTick) err(`${ac} 与前一个和弦事件重叠`)
  }
  const k = data.keyContext
  if (k != null && (!isInt(k.tonicPc, 0, 11) || !['major', 'minor'].includes(k.mode)
    || typeof k.tonicSpelling !== 'string' || !['user', 'inferred'].includes(k.source)
    || !['suggested', 'confirmed'].includes(k.status))) err('keyContext 无效')
  const loop = data.loopRange
  if (loop && (!isInt(loop.startTick, 0) || !isInt(loop.endTick, 1) || loop.endTick <= loop.startTick)) err('loopRange 无效')
  if (errors.length) return { ok: false, errors }

  const project = {
    id: typeof data.id === 'string' ? data.id : newId('prj'), schemaVersion: SCHEMA_VERSION,
    revision: isInt(data.revision, 0) ? data.revision : 0, name: typeof data.name === 'string' ? data.name : '未命名项目',
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

export function parseProjectFile(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`不是有效的 JSON：${e.message}`] }
  }
  return validateProject(data)
}
