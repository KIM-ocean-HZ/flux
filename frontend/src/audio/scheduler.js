// Transport scheduling on the audio clock. Every event time is computed from one anchor
// (anchorTime ↔ anchorTick), so loops never accumulate drift and React never decides timing.
// The sink receives absolute AudioContext times.

import { PPQ, pulse, pulsesBetween } from '../music/time.js'

export class TransportScheduler {
  /**
   * notes: [{ trackId, pitch, velocity, startTick, durationTick }] (any order)
   * loop: { start, end } | null — applies when playback starts before loop.end
   * countInTicks: clicks before anchorTick; stopAtLoopEnd: recording stops instead of wrapping
   * sink: { noteOn(trackId, pitch, velocity, time), noteOff(trackId, pitch, time), click(accent, time) }
   */
  constructor({ anchorTime, anchorTick, bpm, timeSignature, loop = null, countInTicks = 0,
    metronome = false, stopAtLoopEnd = false, notes = [], sink }) {
    Object.assign(this, { anchorTime, anchorTick, timeSignature, countInTicks, metronome, stopAtLoopEnd, sink })
    this.tps = (bpm * PPQ) / 60
    this.loop = loop && loop.end > loop.start && anchorTick < loop.end ? loop : null
    this.scheduledE = -countInTicks
    this.pendingOffs = []
    this.active = new Map()
    this.setNotes(notes)
  }

  setNotes(notes) {
    this.notes = [...notes].sort((a, b) => a.startTick - b.startTick)
  }

  timeOf(e) {
    return this.anchorTime + e / this.tps
  }

  /** Project tick heard at an AudioContext time (negative offsets during the count-in). */
  tickAt(time) {
    const e = (time - this.anchorTime) * this.tps
    if (e < 0 || !this.loop) return this.anchorTick + e
    const first = this.loop.end - this.anchorTick
    if (e < first) return this.anchorTick + e
    if (this.stopAtLoopEnd) return this.loop.end
    return this.loop.start + ((e - first) % (this.loop.end - this.loop.start))
  }

  /** Passes over the project timeline overlapping elapsed ticks [e0, e1). */
  passes(e0, e1) {
    if (!this.loop) return [{ eStart: 0, eEnd: Infinity, tStart: this.anchorTick, tEnd: Infinity }]
    const first = this.loop.end - this.anchorTick
    const out = [{ eStart: 0, eEnd: first, tStart: this.anchorTick, tEnd: this.loop.end }]
    if (this.stopAtLoopEnd) return out
    const len = this.loop.end - this.loop.start
    for (let k = Math.max(0, Math.floor((e0 - first) / len)); first + k * len < e1; k++) {
      out.push({ eStart: first + k * len, eEnd: first + (k + 1) * len, tStart: this.loop.start, tEnd: this.loop.end })
    }
    return out
  }

  /** Send everything that starts before `untilTime`. Safe to call on every timer tick. */
  advance(untilTime) {
    const e1 = (untilTime - this.anchorTime) * this.tps
    const e0 = this.scheduledE
    if (e1 <= e0) return
    const events = []
    if (e0 < 0 && this.countInTicks > 0) {
      const step = pulse(this.timeSignature).ticks
      for (let k = Math.ceil((e0 + this.countInTicks) / step); -this.countInTicks + k * step < Math.min(e1, 0); k++) {
        events.push({ e: -this.countInTicks + k * step, kind: 'click', accent: k === 0 ? 'bar' : 'beat' })
      }
    }
    for (const p of this.passes(e0, e1)) {
      const a = Math.max(e0, p.eStart, 0), b = Math.min(e1, p.eEnd)
      if (a >= b) continue
      const ta = p.tStart + (a - p.eStart), tb = p.tStart + (b - p.eStart)
      for (let i = this.firstAtOrAfter(ta); i < this.notes.length && this.notes[i].startTick < tb; i++) {
        const n = this.notes[i]
        const end = Math.min(n.startTick + n.durationTick, p.tEnd)
        events.push({ e: p.eStart + (n.startTick - p.tStart), kind: 'on', note: n })
        this.pendingOffs.push({ e: p.eStart + (end - p.tStart), kind: 'off', note: n })
      }
      if (this.metronome) {
        for (const { tick, accent } of pulsesBetween(ta, tb, this.timeSignature)) {
          events.push({ e: p.eStart + (tick - p.tStart), kind: 'click', accent })
        }
      }
    }
    const due = this.pendingOffs.filter((o) => o.e < e1)
    this.pendingOffs = this.pendingOffs.filter((o) => o.e >= e1)
    events.push(...due)
    const order = { off: 0, click: 1, on: 2 }
    events.sort((x, y) => x.e - y.e || order[x.kind] - order[y.kind])
    for (const ev of events) this.emit(ev, this.timeOf(ev.e))
    this.scheduledE = e1
  }

  emit(ev, time) {
    if (ev.kind === 'click') return this.sink.click(ev.accent, time)
    const { trackId, pitch, velocity } = ev.note
    const key = `${trackId}|${pitch}`
    const count = this.active.get(key) ?? 0
    if (ev.kind === 'on') {
      this.active.set(key, count + 1)
      this.sink.noteOn(trackId, pitch, velocity, time)
    } else if (count <= 1) {
      // Overlapping same-pitch notes in one track share a note-off: release only the last.
      this.active.delete(key)
      this.sink.noteOff(trackId, pitch, time)
    } else this.active.set(key, count - 1)
  }

  /** Stop: release every note still held by the transport at `time`. */
  flush(time) {
    for (const off of this.pendingOffs) this.emit(off, time)
    this.pendingOffs = []
  }

  /** Latest AudioContext time already handed to the sink. */
  get scheduledUntil() {
    return this.timeOf(this.scheduledE)
  }

  firstAtOrAfter(tick) {
    let lo = 0, hi = this.notes.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.notes[mid].startTick < tick) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}
