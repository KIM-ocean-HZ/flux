import { describe, expect, it } from 'vitest'
import { makeChord } from '../src/music/chords.js'
import {
  addNotes, addTrack, audibleTrackIds, chordConflicts, copyChord, createExampleProject, createProject, deleteChord,
  deleteNotes, parseProjectFile, placeChord, quantizeNotes, serializeProject, setKeyContext, setTempo,
  setTimeSignature, setTrackMix, trackNotes, updateChord, updateNotes, validateProject,
} from '../src/music/project.js'

const chordEvent = (root, type, startTick, durationTick, extra = {}) => ({
  startTick, durationTick, kind: 'chord', chord: makeChord(root, type), source: 'manual', status: 'confirmed', ...extra,
})
const layout = (p) => p.chordTrack.map((e) => `${e.startTick}+${e.durationTick}:${e.chord ? e.chord.rootSpelling : 'NC'}`)

describe('project model', () => {
  it('starts with one empty "旋律 1" piano track; the example is opt-in', () => {
    const p = createProject()
    expect(p).toMatchObject({ ppq: 960, quarterBpm: 120, timeSignature: { numerator: 4, denominator: 4 }, chordTrack: [], generations: [] })
    expect(p.tracks).toHaveLength(1)
    expect(p.tracks[0]).toMatchObject({ name: '旋律 1', program: 0, isDrum: false })
    expect(trackNotes(p.tracks[0])).toHaveLength(0)
    const ex = createExampleProject()
    expect(trackNotes(ex.tracks[0])).toHaveLength(14)
    expect(trackNotes(ex.tracks[0])[6]).toMatchObject({ pitch: 67, startTick: 6 * 960, durationTick: 1920 })
  })

  it('tempo and meter changes keep every note and chord tick (A-04, CH-08)', () => {
    let p = addNotes(createProject(), createProject().tracks[0].id, [])
    p = createExampleProject()
    p = placeChord(p, chordEvent('C', 'maj', 0, 3840))
    const ticks = JSON.stringify([trackNotes(p.tracks[0]), p.chordTrack])
    for (const ts of [{ numerator: 3, denominator: 4 }, { numerator: 6, denominator: 8 }]) {
      const q = setTimeSignature(setTempo(p, 60), ts)
      expect(JSON.stringify([trackNotes(q.tracks[0]), q.chordTrack])).toBe(ticks)
      expect(q.timeSignature).toEqual(ts)
    }
    expect(() => setTempo(p, 301)).toThrow()
    expect(() => setTimeSignature(p, { numerator: 5, denominator: 3 })).toThrow()
  })

  it('edits notes with integer ticks and minimum duration', () => {
    let p = createProject()
    const id = p.tracks[0].id
    p = addNotes(p, id, [{ pitch: 60, startTick: 10.4, durationTick: 0.2, velocity: 200 }])
    const [n] = trackNotes(p.tracks[0])
    expect(n).toMatchObject({ pitch: 60, startTick: 10, durationTick: 1, velocity: 127 })
    p = updateNotes(p, id, [{ id: n.id, startTick: 480, durationTick: 960, pitch: 62 }])
    expect(trackNotes(p.tracks[0])[0]).toMatchObject({ pitch: 62, startTick: 480, durationTick: 960 })
    p = quantizeNotes(p, id, null, 960)
    expect(trackNotes(p.tracks[0])[0]).toMatchObject({ startTick: 960, durationTick: 960 })
    p = deleteNotes(p, id, [n.id])
    expect(trackNotes(p.tracks[0])).toHaveLength(0)
  })

  it('Mute wins over Solo, several Solos can coexist', () => {
    let p = createProject()
    const a = p.tracks[0].id
    let r = addTrack(p, { name: 'B', program: 0 }); p = r.project; const b = r.trackId
    r = addTrack(p, { name: 'C', program: 0 }); p = r.project; const c = r.trackId
    expect(audibleTrackIds(p.tracks)).toEqual(new Set([a, b, c]))
    p = setTrackMix(p, a, { solo: true })
    p = setTrackMix(p, b, { solo: true })
    expect(audibleTrackIds(p.tracks)).toEqual(new Set([a, b]))
    p = setTrackMix(p, a, { mute: true })
    expect(audibleTrackIds(p.tracks)).toEqual(new Set([b]))
  })
})

describe('chord track editing (CH-04, CH-07)', () => {
  it('uses half-open ranges: adjacent events do not conflict', () => {
    let p = placeChord(createProject(), chordEvent('C', 'maj', 0, 3840))
    expect(chordConflicts(p.chordTrack, 3840, 7680)).toHaveLength(0)
    p = placeChord(p, chordEvent('G', 'maj', 3840, 3840))
    expect(layout(p)).toEqual(['0+3840:C', '3840+3840:G'])
  })

  it('shows and applies the replaced range: trim, split and remove', () => {
    let p = placeChord(createProject(), chordEvent('C', 'maj', 0, 7680))
    p = placeChord(p, chordEvent('F', 'maj', 7680, 3840))
    const conflicts = chordConflicts(p.chordTrack, 1920, 9600)
    expect(conflicts.map((c) => c.action)).toEqual(['trim-end', 'trim-start'])
    p = placeChord(p, chordEvent('A', 'min', 1920, 7680))
    expect(layout(p)).toEqual(['0+1920:C', '1920+7680:A', '9600+1920:F'])
    expect(chordConflicts(p.chordTrack, 960, 1440).map((c) => c.action)).toEqual(['split'])
    p = placeChord(p, chordEvent('D', 'min', 960, 480))
    expect(layout(p)).toEqual(['0+960:C', '960+480:D', '1440+480:C', '1920+7680:A', '9600+1920:F'])
    expect(new Set(p.chordTrack.map((e) => e.id)).size).toBe(5)
    p = placeChord(p, { startTick: 0, durationTick: 11520, kind: 'no_chord', source: 'manual', status: 'confirmed' })
    expect(layout(p)).toEqual(['0+11520:NC'])
  })

  it('moves, resizes, copies and deletes without overlaps', () => {
    let p = placeChord(createProject(), chordEvent('C', 'maj', 0, 3840))
    p = placeChord(p, chordEvent('G', 'maj', 3840, 3840))
    const [c, g] = p.chordTrack
    p = updateChord(p, c.id, { durationTick: 5760 })
    expect(layout(p)).toEqual(['0+5760:C', '5760+1920:G'])
    p = copyChord(p, c.id, 7680)
    expect(layout(p)).toEqual(['0+5760:C', '5760+1920:G', '7680+5760:C'])
    p = updateChord(p, g.id, { startTick: 0 })
    expect(layout(p)).toEqual(['0+1920:G', '1920+3840:C', '7680+5760:C'])
    p = deleteChord(p, g.id)
    expect(layout(p)).toEqual(['1920+3840:C', '7680+5760:C'])
  })
})

describe('project JSON (A-06, CH-08)', () => {
  const rich = () => {
    let p = createExampleProject()
    const r = addTrack(p, { name: '鼓', program: 0, isDrum: true }); p = r.project
    p = addNotes(p, r.trackId, [{ pitch: 36, startTick: 0, durationTick: 120, velocity: 100 }])
    p = setTempo(setTimeSignature(p, { numerator: 6, denominator: 8 }), 93.5)
    p = placeChord(p, { ...chordEvent('C', 'add9', 0, 2880), source: 'midi_detected', sourceTrackId: p.tracks[0].id, sourceNoteIds: ['x'], sourceSignature: 'sig' })
    p = placeChord(p, { startTick: 2880, durationTick: 1440, kind: 'no_chord', source: 'manual', status: 'confirmed' })
    p = placeChord(p, { startTick: 4320, durationTick: 1440, kind: 'chord', chord: makeChord('Db', 'maj', 'F'), source: 'manual', status: 'confirmed' })
    p = setKeyContext(p, { tonicPc: 1, tonicSpelling: 'Db', mode: 'major', source: 'user', status: 'confirmed' })
    p.tracks[0].soundbankId = 'GeneralUser-GS.sf2:32319396:9575028c7a1f589f'
    return p
  }

  it('round-trips losslessly, including chord structure, bass, spelling, source and key', () => {
    const p = rich()
    const back = parseProjectFile(serializeProject(p))
    expect(back.ok).toBe(true)
    expect(back.project).toEqual(p)
    expect(back.project.chordTrack[2].chord).toEqual({ rootPc: 1, rootSpelling: 'Db', quality: 'maj', additions: [], bassPc: 5, bassSpelling: 'F' })
  })

  it('rejects invalid files with readable reasons', () => {
    expect(parseProjectFile('{not json').errors[0]).toMatch(/JSON/)
    const bad = (mutate) => {
      const d = JSON.parse(serializeProject(rich()))
      mutate(d)
      return validateProject(d)
    }
    expect(bad((d) => { d.ppq = 480 }).errors.join()).toMatch(/ppq/)
    expect(bad((d) => { d.quarterBpm = 999 }).errors.join()).toMatch(/quarterBpm/)
    expect(bad((d) => { d.tracks[0].clips[0].notes[0].pitch = 128 }).errors.join()).toMatch(/pitch/)
    expect(bad((d) => { d.tracks[0].clips[0].notes[0].durationTick = 0 }).errors.join()).toMatch(/durationTick/)
    expect(bad((d) => { d.chordTrack[0].chord.rootSpelling = 'E' }).errors.join()).toMatch(/不一致/)
    expect(bad((d) => { d.chordTrack[1].startTick = 100 }).errors.join()).toMatch(/重叠/)
    expect(bad((d) => { d.chordTrack[1].chord = d.chordTrack[0].chord }).errors.join()).toMatch(/N\.C\./)
    expect(bad((d) => { d.tracks[1].id = d.tracks[0].id }).errors.join()).toMatch(/重复 id/)
    expect(bad((d) => { d.schemaVersion = 2 }).ok).toBe(false)
    expect(validateProject([]).ok).toBe(false)
  })
})
