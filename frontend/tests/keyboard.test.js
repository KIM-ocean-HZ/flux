// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { isEditableTarget, KEY_OFFSETS, MusicalTyping, StepGroup, TakeRecorder } from '../src/music/keyboard.js'

let log, kb
const key = (type, code, init = {}) => {
  const e = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init })
  Object.defineProperty(e, 'target', { value: init.target ?? document.body })
  return e
}
const down = (code, init) => kb.keyDown(key('keydown', code, init))
const up = (code, init) => kb.keyUp(key('keyup', code, init))

beforeEach(() => {
  document.body.innerHTML = ''
  log = []
  kb = new MusicalTyping({
    noteOn: (pitch, velocity) => { log.push(['on', pitch, velocity]); return { pitch } },
    noteOff: (held) => log.push(['off', held.pitch]),
  })
  kb.setEnabled(true)
})

describe('Musical Typing mapping (A-03, CH-01)', () => {
  it('maps the Logic layout from A = MIDI 60', () => {
    expect(Object.keys(KEY_OFFSETS)).toHaveLength(18)
    down('KeyA'); down('KeyW'); down('KeyK'); down('Quote')
    expect(log.map((l) => l[1])).toEqual([60, 61, 72, 77])
  })

  it('plays A/D/G as a chord and releases each key once', () => {
    down('KeyA'); down('KeyD'); down('KeyG')
    expect(kb.heldPitches()).toEqual([60, 64, 67])
    up('KeyD'); up('KeyA'); up('KeyG')
    expect(log.filter((l) => l[0] === 'off').map((l) => l[1])).toEqual([64, 60, 67])
    expect(kb.heldPitches()).toEqual([])
  })

  it('ignores key repeat: a long press is one note', () => {
    down('KeyA'); down('KeyA', { repeat: true }); down('KeyA', { repeat: true })
    expect(log).toEqual([['on', 60, 80]])
  })

  it('Z/X shift octaves; a held key still releases its original pitch', () => {
    down('KeyA')
    down('KeyX')
    down('KeyS')
    up('KeyA'); up('KeyS')
    expect(log).toEqual([['on', 60, 80], ['on', 74, 80], ['off', 60], ['off', 74]])
    down('KeyZ'); down('KeyZ'); down('KeyZ'); down('KeyZ'); down('KeyZ')
    expect(kb.base).toBe(24) // clamped
  })

  it('C/V change velocity in steps of 8 within 1–127', () => {
    down('KeyV'); down('KeyA')
    expect(log[0]).toEqual(['on', 60, 88])
    for (let i = 0; i < 20; i++) down('KeyC')
    expect(kb.velocity).toBe(1)
  })

  it('ignores system shortcuts and IME composition', () => {
    expect(down('KeyA', { metaKey: true })).toBe(false)
    expect(down('KeyS', { ctrlKey: true })).toBe(false)
    expect(down('KeyD', { altKey: true })).toBe(false)
    expect(down('KeyF', { isComposing: true })).toBe(false)
    expect(log).toEqual([])
  })

  it('does not play while typing in text, BPM, search, select, editable text or a dialog', () => {
    document.body.innerHTML = `<input id="name" type="text"><input id="bpm" type="number"><input id="search" type="search">
      <select id="sel"><option>a</option></select><div id="ce" contenteditable="true"><span id="inner">x</span></div>
      <dialog open><button id="dlg">ok</button></dialog><input id="vol" type="range"><button id="btn">b</button>`
    for (const id of ['name', 'bpm', 'search', 'sel', 'inner', 'dlg']) {
      expect(down('KeyA', { target: document.getElementById(id) }), id).toBe(false)
    }
    expect(log).toEqual([])
    expect(isEditableTarget(document.getElementById('vol'))).toBe(false)
    expect(down('KeyA', { target: document.getElementById('btn') })).toBe(true)
  })

  it('keyup is honoured even if focus moved into a text field meanwhile', () => {
    document.body.innerHTML = '<input id="name" type="text">'
    down('KeyA')
    expect(up('KeyA', { target: document.getElementById('name') })).toBe(true)
    expect(log.at(-1)).toEqual(['off', 60])
  })

  it('releaseAll (blur, tab switch, leaving play mode, changing target) leaves nothing hanging', () => {
    down('KeyA'); down('KeyD'); down('KeyX'); down('KeyG')
    kb.releaseAll()
    expect(log.filter((l) => l[0] === 'off').map((l) => l[1]).sort()).toEqual([60, 64, 79])
    expect(kb.pressed.size).toBe(0)
    down('KeyA')
    kb.setEnabled(false)
    expect(log.at(-1)).toEqual(['off', 72])
    expect(down('KeyA')).toBe(false)
  })

  it('does nothing while blocked (e.g. an open modal)', () => {
    kb.isBlocked = () => true
    expect(down('KeyA')).toBe(false)
  })
})

describe('recording and step input', () => {
  it('records presses as raw ticks, closes held notes on stop and never writes zero length', () => {
    const take = new TakeRecorder(3840)
    take.noteOn('early', 50, 80, 3840 - 2000) // count-in audition, not recorded
    take.noteOn('a', 60, 90, 3840 - 100) // anticipation within a sixteenth → downbeat
    take.noteOn('b', 62, 70, 4001.6)
    take.noteOff('b', 4001.9)
    take.noteOff('a', 4500)
    take.noteOn('c', 64, 80, 5000)
    expect(take.snapshot(5100).at(-1)).toMatchObject({ pitch: 64, durationTick: 100 })
    const notes = take.finish(6000)
    expect(notes).toEqual([
      { pitch: 62, velocity: 70, startTick: 4002, durationTick: 1 },
      { pitch: 60, velocity: 90, startTick: 3840, durationTick: 660 },
      { pitch: 64, velocity: 80, startTick: 5000, durationTick: 1000 },
    ])
  })

  it('step input emits a chord once, only after the whole group is released', () => {
    const g = new StepGroup()
    g.down('KeyA', 60, 80); g.down('KeyD', 64, 80)
    expect(g.up('KeyA')).toBeNull()
    g.down('KeyG', 67, 80)
    expect(g.up('KeyD')).toBeNull()
    expect(g.up('KeyG')).toEqual([{ pitch: 60, velocity: 80 }, { pitch: 64, velocity: 80 }, { pitch: 67, velocity: 80 }])
    expect(g.up('KeyG')).toBeNull()
  })
})
