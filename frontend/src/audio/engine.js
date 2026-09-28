// Browser audio: one AudioContext + one SpessaSynth worklet synthesizer. Every project track
// owns its own synth channel (same program on two tracks still means two channels), live
// playing and previews use separate channels, and the transport schedules with absolute
// AudioContext times.

import { WorkletSynthesizer } from 'spessasynth_lib'
import processorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url'
import { audibleTrackIds, trackNotes } from '../music/project.js'
import { PPQ, ticksPerBar } from '../music/time.js'
import { record } from './perf.js'
import { TransportScheduler } from './scheduler.js'
import { cacheSoundbank, loadCachedSoundbank } from './soundbankCache.js'

const LOOKAHEAD = 0.12 // seconds of events handed to the worklet ahead of time
const TIMER_MS = 25
const START_DELAY = 0.06
const CH_PREVIEW = 13
const CH_LIVE = 14
const CH_METRONOME = 15
const TRACK_CHANNELS = Array.from({ length: 13 }, (_, i) => i) // 0–12, then 16+ on demand
const LOAD_TIMEOUT_MS = 60000
const CC_VOLUME = 7
const CC_ALL_SOUND_OFF = 120
const CC_ALL_NOTES_OFF = 123

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** SF2/SF3 ("RIFF….sfbk") or DLS ("RIFF….DLS ") header check before handing bytes to the worklet. */
export function isSoundbankHeader(buffer) {
  if (buffer.byteLength < 12) return false
  const text = String.fromCharCode(...new Uint8Array(buffer, 0, 12))
  return text.startsWith('RIFF') && ['sfbk', 'DLS '].includes(text.slice(8, 12))
}

export class AudioEngine {
  constructor() {
    this.status = 'off' // off | starting | needs-soundbank | loading | ready | error
    this.error = null
    this.soundbank = null // { id, name, byteLength, sha256 }
    this.coverage = null // { melodic: Set<program>, drumKit: boolean }
    this.listeners = new Set()
    this.trackChannels = new Map()
    this.freeChannels = [...TRACK_CHANNELS]
    this.nextExtra = 16
    this.channelState = new Map()
    this.liveCounts = new Map()
    this.liveConfig = null
    this.previewToken = 0
    this.tracks = []
    this.audible = new Set()
    this.scheduler = null
    this.transport = null
    this.drainUntil = 0
    this.draining = false
    this.sink = {
      noteOn: (trackId, pitch, velocity, time) => {
        const ch = this.trackChannels.get(trackId)
        if (ch === undefined) return
        record('scheduleLeadMs', (time - this.ctx.currentTime) * 1000)
        this.synth.noteOn(ch, pitch, velocity, { time })
      },
      noteOff: (trackId, pitch, time) => {
        const ch = this.trackChannels.get(trackId)
        if (ch !== undefined) this.synth.noteOff(ch, pitch, { time })
      },
      click: (accent, time) => {
        this.synth.noteOn(CH_METRONOME, accent === 'bar' ? 76 : 77, accent === 'bar' ? 127 : 85, { time })
      },
    }
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  setStatus(status, error = null) {
    this.status = status
    this.error = error
    this.emit()
  }

  get ready() {
    return this.status === 'ready' && this.ctx?.state === 'running'
  }

  /** Must run from a user gesture (button click): creates/resumes the AudioContext. */
  async enable() {
    if (this.ctx) {
      await this.ctx.resume()
      this.emit()
      return
    }
    this.setStatus('starting')
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      const resumed = ctx.resume() // inside the gesture, before any await
      await ctx.audioWorklet.addModule(processorUrl)
      const synth = new WorkletSynthesizer(ctx)
      await synth.isReady
      await resumed
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 2048
      synth.connect(ctx.destination)
      synth.connect(this.analyser)
      synth.eventHandler.addEvent('presetListChange', 'flux', (list) => this.updateCoverage(list))
      ctx.onstatechange = () => this.emit()
      this.ctx = ctx
      this.synth = synth
      this.startTimer()
      this.setStatus('needs-soundbank')
      this.syncTracks(this.tracks)
      const cached = await loadCachedSoundbank()
      if (cached) await this.loadSoundbank(cached.buffer, cached.name, { fromCache: true })
    } catch (err) {
      this.setStatus('error', `无法启动音频：${err.message}`)
    }
  }

  async loadSoundbankFile(file) {
    return this.loadSoundbank(await file.arrayBuffer(), file.name)
  }

  async loadSoundbank(buffer, name, { fromCache = false } = {}) {
    if (!this.synth) return false
    const fallback = this.soundbank ? 'ready' : 'needs-soundbank'
    if (!isSoundbankHeader(buffer)) {
      this.setStatus(fallback, `${name} 不是 SF2／SF3／DLS 音色文件`)
      return false
    }
    this.setStatus('loading')
    try {
      const sha256 = hex(await crypto.subtle.digest('SHA-256', buffer))
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('超时')), LOAD_TIMEOUT_MS)
        this.synth.eventHandler.addEvent('soundBankError', 'flux-load', (e) => reject(new Error(String(e?.message ?? e))))
        this.synth.soundBankManager.addSoundBank(buffer.slice(0), 'main')
          .then(resolve, reject).finally(() => clearTimeout(timer))
      }).finally(() => this.synth.eventHandler.removeEvent('soundBankError', 'flux-load'))
      this.soundbank = { id: `${name}:${buffer.byteLength}:${sha256.slice(0, 16)}`, name, byteLength: buffer.byteLength, sha256 }
      this.channelState.clear()
      this.liveConfig = null
      this.syncTracks(this.tracks)
      this.setStatus('ready')
      if (!fromCache) cacheSoundbank({ name, byteLength: buffer.byteLength, sha256, buffer })
      return true
    } catch (err) {
      this.setStatus(fallback, `音源 ${name} 加载失败：${err.message}`)
      return false
    }
  }

  updateCoverage(list) {
    this.coverage = {
      melodic: new Set(list.filter((p) => !p.isDrum && p.bankMSB === 0 && p.bankLSB === 0).map((p) => p.program)),
      drumKit: list.some((p) => p.isDrum && p.program === 0),
      presets: list.length,
    }
    this.emit()
  }

  // --- Channels ------------------------------------------------------------------------

  channelOf(trackId) {
    return this.trackChannels.get(trackId)
  }

  ensureChannel(ch) {
    while (this.synth.channelCount <= ch) this.synth.addNewChannel()
  }

  configure(ch, { program, isDrum, volume = 100 }) {
    const st = this.channelState.get(ch) ?? {}
    const cfg = `${isDrum}:${program}`
    this.ensureChannel(ch)
    if (st.cfg !== cfg) {
      this.synth.midiChannels[ch].setDrums(isDrum)
      this.synth.programChange(ch, program)
      st.cfg = cfg
    }
    if (st.volume !== volume) {
      this.synth.controllerChange(ch, CC_VOLUME, volume)
      st.volume = volume
    }
    this.channelState.set(ch, st)
  }

  setMuted(ch, muted) {
    const st = this.channelState.get(ch) ?? {}
    if (st.muted === muted) return
    // A muted SpessaSynth channel stops its voices and ignores (even already queued) note-ons.
    this.synth.midiChannels[ch].setSystemParameter('isMuted', muted)
    st.muted = muted
    this.channelState.set(ch, st)
  }

  /** Allocate/configure one channel per track; apply Mute/Solo (Mute wins) and volume. */
  syncTracks(tracks) {
    this.tracks = tracks
    this.audible = audibleTrackIds(tracks)
    for (const [id, ch] of this.trackChannels) {
      if (tracks.some((t) => t.id === id)) continue
      this.trackChannels.delete(id)
      if (this.synth) this.synth.controllerChange(ch, CC_ALL_SOUND_OFF, 0)
      this.freeChannels.push(ch)
    }
    for (const t of tracks) {
      if (!this.trackChannels.has(t.id)) {
        this.trackChannels.set(t.id, this.freeChannels.length ? this.freeChannels.shift() : this.nextExtra++)
      }
      if (this.synth) this.configure(this.trackChannels.get(t.id), t)
    }
    if (this.synth) {
      this.configure(CH_METRONOME, { program: 0, isDrum: true, volume: 110 })
      this.applyMutes()
    }
  }

  applyMutes() {
    for (const [id, ch] of this.trackChannels) this.setMuted(ch, this.draining || !this.audible.has(id))
    this.setMuted(CH_METRONOME, this.draining)
  }

  // --- Live playing and previews -------------------------------------------------------

  liveNoteOn(track, pitch, velocity, eventTimeStamp) {
    if (!this.ready) return null
    const cfg = `${track.isDrum}:${track.program}:${track.volume}`
    if (this.liveConfig !== cfg) {
      this.configure(CH_LIVE, track)
      this.liveConfig = cfg
    }
    this.liveCounts.set(pitch, (this.liveCounts.get(pitch) ?? 0) + 1)
    this.synth.noteOn(CH_LIVE, pitch, velocity)
    if (eventTimeStamp) record('keyToNoteOnMs', performance.now() - eventTimeStamp)
    return { channel: CH_LIVE, pitch }
  }

  /** The same pitch held by two keys (after an octave shift) is released by the last key. */
  liveNoteOff(pitch) {
    if (!this.synth) return
    const n = this.liveCounts.get(pitch) ?? 0
    if (n > 1) return this.liveCounts.set(pitch, n - 1)
    this.liveCounts.delete(pitch)
    this.synth.noteOff(CH_LIVE, pitch)
  }

  releaseLive() {
    this.liveCounts.clear()
    if (this.synth) this.synth.controllerChange(CH_LIVE, CC_ALL_NOTES_OFF, 0)
  }

  /** Temporary audition (chord preview, instrument preview). Never touches the project. */
  preview(pitches, instrument = { program: 0, isDrum: false }, seconds = 1.2) {
    if (!this.ready) return false
    const token = ++this.previewToken
    this.synth.controllerChange(CH_PREVIEW, CC_ALL_SOUND_OFF, 0)
    this.configure(CH_PREVIEW, { ...instrument, volume: 110 })
    for (const p of pitches) this.synth.noteOn(CH_PREVIEW, p, 90)
    setTimeout(() => {
      if (token === this.previewToken) for (const p of pitches) this.synth.noteOff(CH_PREVIEW, p)
    }, seconds * 1000)
    return true
  }

  /** Emergency "stop all sound": transport, live keys, previews. */
  panic() {
    this.stop()
    this.releaseLive()
    if (this.synth) this.synth.stopAll(true)
  }

  // --- Transport -----------------------------------------------------------------------

  get playing() {
    return !!this.scheduler
  }

  static collectNotes(project) {
    return project.tracks.flatMap((t) => trackNotes(t).map((n) => ({ ...n, trackId: t.id })))
  }

  play({ project, fromTick, countIn = false, metronome = false, recording = false, onAutoStop = null }) {
    if (!this.ready) return false
    if (this.scheduler) this.stop()
    const countInTicks = countIn ? ticksPerBar(project.timeSignature) : 0
    const tps = (project.quarterBpm * PPQ) / 60
    const start = Math.max(this.ctx.currentTime + START_DELAY, this.drainUntil + 0.08)
    const loop = project.loopRange?.enabled ? { start: project.loopRange.startTick, end: project.loopRange.endTick } : null
    this.scheduler = new TransportScheduler({
      anchorTime: start + countInTicks / tps, anchorTick: fromTick, bpm: project.quarterBpm,
      timeSignature: project.timeSignature, loop, countInTicks, metronome, stopAtLoopEnd: recording,
      notes: AudioEngine.collectNotes(project), sink: this.sink,
    })
    this.transport = { project, recording, onAutoStop, fromTick }
    this.tick()
    this.emit()
    return true
  }

  /** Keep the running transport in sync with edits; tempo/meter/loop changes re-anchor it. */
  updateProject(project) {
    this.syncTracks(project.tracks)
    if (!this.scheduler) return
    const prev = this.transport.project
    this.transport.project = project
    const loopKey = (p) => JSON.stringify(p.loopRange)
    if (!this.transport.recording && (prev.quarterBpm !== project.quarterBpm
      || prev.timeSignature.numerator !== project.timeSignature.numerator
      || prev.timeSignature.denominator !== project.timeSignature.denominator || loopKey(prev) !== loopKey(project))) {
      const at = Math.max(0, Math.round(this.positionTick()))
      this.play({ project, fromTick: at, metronome: this.scheduler.metronome })
      return
    }
    this.scheduler.setNotes(AudioEngine.collectNotes(project))
  }

  setMetronome(on) {
    if (this.scheduler) this.scheduler.metronome = on
  }

  /** Stop: release held transport notes now and mute track channels until queued events drain. */
  stop() {
    if (!this.scheduler) return null
    const now = this.ctx.currentTime
    const tick = this.scheduler.tickAt(now)
    this.scheduler.flush(now)
    this.drainUntil = Math.max(this.drainUntil, this.scheduler.scheduledUntil + 0.01)
    this.scheduler = null
    this.transport = null
    this.synth.controllerChange(CH_METRONOME, CC_ALL_SOUND_OFF, 0)
    this.draining = true
    this.applyMutes()
    this.emit()
    return tick
  }

  tick() {
    if (!this.ctx) return
    const t0 = performance.now()
    const now = this.ctx.currentTime
    if (this.draining && now >= this.drainUntil) {
      this.draining = false
      this.applyMutes()
    }
    if (this.scheduler && !this.draining) {
      this.scheduler.advance(now + LOOKAHEAD)
      const { loop } = this.scheduler
      if (this.transport.recording && loop && this.scheduler.tickAt(now) >= loop.end) {
        this.transport.onAutoStop?.(loop.end)
      }
      record('schedulerTickMs', performance.now() - t0)
    }
  }

  startTimer() {
    // A worker timer keeps scheduling steady when the main thread's timers are throttled.
    try {
      const src = 'let id;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}'
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))
      this.worker.onmessage = () => this.tick()
      this.worker.postMessage(TIMER_MS)
    } catch {
      this.interval = setInterval(() => this.tick(), TIMER_MS)
    }
  }

  /** Project tick being heard now (negative relative to the start during the count-in). */
  positionTick() {
    return this.scheduler ? this.scheduler.tickAt(this.ctx.currentTime) : null
  }

  countingIn() {
    return !!this.scheduler && this.ctx.currentTime < this.scheduler.anchorTime
  }

  /**
   * Map a DOM event timestamp to the AudioContext time being output at that moment
   * (getOutputTimestamp), so a recorded note lands where the player heard the beat.
   */
  eventContextTime(timeStamp) {
    const ts = this.ctx.getOutputTimestamp?.()
    if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (timeStamp - ts.performanceTime) / 1000
    return this.ctx.currentTime + (timeStamp - performance.now()) / 1000
  }

  tickForEvent(timeStamp) {
    return this.scheduler ? this.scheduler.tickAt(this.eventContextTime(timeStamp)) : null
  }

  level() {
    if (!this.analyser) return 0
    this.levelBuf ??= new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(this.levelBuf)
    let sum = 0
    for (const v of this.levelBuf) sum += v * v
    return Math.sqrt(sum / this.levelBuf.length)
  }

  info() {
    return {
      status: this.status, error: this.error, soundbank: this.soundbank, contextState: this.ctx?.state ?? null, processorUrl,
      sampleRate: this.ctx?.sampleRate ?? null, baseLatency: this.ctx?.baseLatency ?? null,
      outputLatency: this.ctx?.outputLatency ?? null, voiceCount: this.synth?.voiceCount ?? 0,
      channels: Object.fromEntries(this.trackChannels),
      coverage: this.coverage && { melodic: this.coverage.melodic.size, drumKit: this.coverage.drumKit, presets: this.coverage.presets },
    }
  }
}
