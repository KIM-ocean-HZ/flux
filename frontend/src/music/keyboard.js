// Computer-keyboard input modelled on Logic's Musical Typing (physical KeyboardEvent.code).
// No DOM or audio access here: note on/off go through injected callbacks.

import { PPQ } from './time.js'

export const KEY_OFFSETS = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9,
  KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
}
export const KEY_LABELS = Object.fromEntries(Object.keys(KEY_OFFSETS).map((c) =>
  [c, c === 'Semicolon' ? ';' : c === 'Quote' ? "'" : c.slice(3)]))
export const DEFAULT_BASE = 60
export const BASE_MIN = 24
export const BASE_MAX = 96
export const VELOCITY_STEP = 8
export const DEFAULT_VELOCITY = 80

const NON_TEXT_INPUTS = ['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file']

/** Text entry, BPM/search fields, selects, editable text and dialogs keep their keystrokes. */
export function isEditableTarget(target) {
  if (!target || typeof target.closest !== 'function') return false
  if (target.closest('textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [role="listbox"], [role="combobox"]')) return true
  const input = target.closest('input')
  return !!input && !NON_TEXT_INPUTS.includes(input.type)
}

/**
 * Tracks pressed keys. Each key remembers the pitch/voice it started, so octave changes
 * or target changes never send note-off to the wrong pitch.
 */
export class MusicalTyping {
  constructor({ noteOn, noteOff, onChange = () => {}, isBlocked = () => false }) {
    Object.assign(this, { noteOn, noteOff, onChange, isBlocked })
    this.enabled = false
    this.base = DEFAULT_BASE
    this.velocity = DEFAULT_VELOCITY
    this.pressed = new Map() // code -> { pitch, voice }
  }

  setEnabled(on) {
    if (!on) this.releaseAll()
    this.enabled = on
    this.onChange()
  }

  shiftOctave(delta) {
    this.base = Math.min(BASE_MAX, Math.max(BASE_MIN, this.base + 12 * delta))
    this.onChange()
  }

  shiftVelocity(delta) {
    this.velocity = Math.min(127, Math.max(1, this.velocity + VELOCITY_STEP * delta))
    this.onChange()
  }

  /** Returns true when the event was consumed by musical typing. */
  keyDown(e) {
    if (!this.enabled || e.isComposing || e.keyCode === 229) return false
    if (e.metaKey || e.ctrlKey || e.altKey) return false
    if (isEditableTarget(e.target) || this.isBlocked()) return false
    const control = { KeyZ: () => this.shiftOctave(-1), KeyX: () => this.shiftOctave(1),
      KeyC: () => this.shiftVelocity(-1), KeyV: () => this.shiftVelocity(1) }[e.code]
    if (control) {
      e.preventDefault()
      if (!e.repeat) control()
      return true
    }
    if (!(e.code in KEY_OFFSETS)) return false
    e.preventDefault()
    this.press(e.code, e.timeStamp, e.repeat)
    return true
  }

  keyUp(e) {
    return this.release(e.code, e.timeStamp)
  }

  /** Shared by physical keys and on-screen keys. */
  press(code, timeStamp, repeat = false) {
    if (repeat || this.pressed.has(code)) return
    const pitch = this.base + KEY_OFFSETS[code]
    if (pitch > 127) return
    const voice = this.noteOn(pitch, this.velocity, timeStamp)
    this.pressed.set(code, { pitch, voice })
    this.onChange()
  }

  release(code, timeStamp) {
    const held = this.pressed.get(code)
    if (!held) return false
    this.pressed.delete(code)
    this.noteOff(held, timeStamp)
    this.onChange()
    return true
  }

  /** Blur, tab switch, leaving play mode, changing target, stopping: nothing may hang. */
  releaseAll(timeStamp) {
    for (const code of [...this.pressed.keys()]) this.release(code, timeStamp)
  }

  heldPitches() {
    return [...this.pressed.values()].map((h) => h.pitch)
  }
}

/**
 * One real-time take. Note times are ticks already mapped from the event clock; nothing is
 * quantized. A note pressed during the last sixteenth of the count-in starts at the downbeat;
 * earlier count-in presses are audition only.
 */
export class TakeRecorder {
  constructor(startTick) {
    this.startTick = startTick
    this.open = new Map()
    this.notes = []
  }

  noteOn(key, pitch, velocity, tick) {
    if (tick < this.startTick - PPQ / 4) return
    this.open.set(key, { pitch, velocity, startTick: Math.max(this.startTick, Math.round(tick)) })
  }

  noteOff(key, tick) {
    const o = this.open.get(key)
    if (!o) return
    this.open.delete(key)
    this.notes.push(this.close(o, tick))
  }

  close(o, tick) {
    return { pitch: o.pitch, velocity: o.velocity, startTick: o.startTick, durationTick: Math.max(1, Math.round(tick) - o.startTick) }
  }

  /** Notes so far, with held notes drawn up to `tick` (for the live view). */
  snapshot(tick) {
    return [...this.notes, ...[...this.open.values()].map((o) => this.close(o, tick))]
  }

  /** Close held notes at the stop position and return the take. */
  finish(stopTick) {
    for (const key of [...this.open.keys()]) this.noteOff(key, stopTick)
    return this.notes
  }
}

/** Step input: collects a chord while any key is down; releasing the whole group emits it once. */
export class StepGroup {
  constructor() {
    this.held = new Set()
    this.pitches = new Map()
  }

  down(key, pitch, velocity) {
    this.held.add(key)
    this.pitches.set(pitch, velocity)
  }

  up(key) {
    this.held.delete(key)
    if (this.held.size || !this.pitches.size) return null
    const group = [...this.pitches].map(([pitch, velocity]) => ({ pitch, velocity }))
    this.pitches.clear()
    return group
  }

  reset() {
    this.held.clear()
    this.pitches.clear()
  }
}
