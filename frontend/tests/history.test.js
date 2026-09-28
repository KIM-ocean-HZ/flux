import { describe, expect, it } from 'vitest'
import { makeChord } from '../src/music/chords.js'
import { historyReducer, initHistory } from '../src/music/history.js'
import {
  addNotes, createExampleProject, createProject, deleteNotes, placeChord, setKeyContext, setTrackMix, trackNotes,
  updateChord, updateNotes,
} from '../src/music/project.js'
import { TakeRecorder } from '../src/music/keyboard.js'

const apply = (h, label, fn) => historyReducer(h, { type: 'apply', label, fn })
const undo = (h) => historyReducer(h, { type: 'undo' })
const redo = (h) => historyReducer(h, { type: 'redo' })
const music = (p) => JSON.stringify({ tracks: p.tracks.map((t) => ({ ...t, mute: 0, solo: 0, volume: 0 })), chordTrack: p.chordTrack, keyContext: p.keyContext, tempo: p.quarterBpm, ts: p.timeSignature })

describe('undo / redo (A-05)', () => {
  it('restores the exact project state for note edits, a recorded take and quantize', () => {
    let h = initHistory(createProject())
    const id = h.present.tracks[0].id
    const s0 = music(h.present)
    const take = new TakeRecorder(0)
    take.noteOn('a', 60, 80, 13)
    take.noteOn('d', 64, 80, 17)
    take.noteOff('a', 947)
    const recorded = take.finish(1000)
    h = apply(h, '录音', (p) => addNotes(p, id, recorded))
    const s1 = music(h.present)
    const n = trackNotes(h.present.tracks[0])[0]
    h = apply(h, '移动音符', (p) => updateNotes(p, id, [{ id: n.id, startTick: 960, pitch: 62 }]))
    const s2 = music(h.present)
    h = apply(h, '删除音符', (p) => deleteNotes(p, id, [n.id]))
    h = undo(h); expect(music(h.present)).toBe(s2)
    h = undo(h); expect(music(h.present)).toBe(s1)
    h = undo(h); expect(music(h.present)).toBe(s0)
    expect(undo(h)).toBe(h)
    h = redo(redo(h)); expect(music(h.present)).toBe(s2)
    expect(trackNotes(h.present.tracks[0]).map((x) => [x.pitch, x.startTick, x.durationTick]))
      .toEqual([[62, 960, 934], [64, 17, 983]])
  })

  it('never lowers the revision, even when undo restores older content', () => {
    let h = initHistory(createProject())
    h = apply(h, 'a', (p) => setKeyContext(p, { tonicPc: 0, tonicSpelling: 'C', mode: 'major', source: 'user', status: 'confirmed' }))
    const r1 = h.present.revision
    h = undo(h)
    expect(h.present.revision).toBeGreaterThan(r1)
    h = redo(h)
    expect(h.present.revision).toBeGreaterThan(r1 + 1)
  })

  it('does not undo monitoring state (Mute/Solo/volume)', () => {
    let h = initHistory(createExampleProject())
    const id = h.present.tracks[0].id
    h = apply(h, 'add', (p) => addNotes(p, id, [{ pitch: 70, startTick: 0, durationTick: 10 }]))
    h = historyReducer(h, { type: 'monitor', fn: (p) => setTrackMix(p, id, { mute: true, volume: 40 }) })
    h = undo(h)
    expect(h.present.tracks[0]).toMatchObject({ mute: true, volume: 40 })
    expect(trackNotes(h.present.tracks[0])).toHaveLength(14)
  })
})

describe('chord edits keep confirmed controls exact (CH-07)', () => {
  it('undo/redo of chord writes, moves and source acknowledgement restores structure and status', () => {
    let h = initHistory(createExampleProject())
    const trackId = h.present.tracks[0].id
    h = apply(h, '采用和弦', (p) => placeChord(p, {
      startTick: 0, durationTick: 3840, kind: 'chord', chord: makeChord('C', 'maj'), source: 'midi_detected',
      status: 'confirmed', sourceTrackId: trackId, sourceNoteIds: ['a'], sourceSignature: 'old',
    }))
    const confirmed = JSON.stringify(h.present.chordTrack)
    // Editing the source MIDI does not rewrite the confirmed chord.
    const n = trackNotes(h.present.tracks[0])[0]
    h = apply(h, '改音', (p) => updateNotes(p, trackId, [{ id: n.id, pitch: 57 }]))
    expect(JSON.stringify(h.present.chordTrack)).toBe(confirmed)
    const id = h.present.chordTrack[0].id
    h = apply(h, '改和弦', (p) => updateChord(p, id, { chord: makeChord('A', 'min', 'C'), durationTick: 1920 }))
    h = apply(h, '确认输入变化', (p) => updateChord(p, id, { sourceSignature: 'new' }))
    expect(h.present.chordTrack[0]).toMatchObject({ durationTick: 1920, sourceSignature: 'new', chord: { rootSpelling: 'A', bassSpelling: 'C' } })
    h = undo(undo(h))
    expect(JSON.stringify(h.present.chordTrack)).toBe(confirmed)
    h = redo(redo(h))
    expect(h.present.chordTrack[0].sourceSignature).toBe('new')
  })
})
