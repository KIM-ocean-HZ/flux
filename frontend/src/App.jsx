import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AudioEngine } from './audio/engine.js'
import * as perf from './audio/perf.js'
import ChordPanel from './components/ChordPanel.jsx'
import Header from './components/Header.jsx'
import InstrumentPicker from './components/InstrumentPicker.jsx'
import KeyboardPanel from './components/KeyboardPanel.jsx'
import Modal from './components/Modal.jsx'
import Timeline from './components/Timeline.jsx'
import Transport from './components/Transport.jsx'
import { useI18n } from './i18n/I18n.jsx'
import { m, translate } from './i18n/translate.js'
import { analyzeHarmony } from './music/analysis.js'
import { chordSymbol, detectChord, eventSymbol, notesSignature, segmentChords, voiceChord } from './music/chords.js'
import { historyReducer, initHistory } from './music/history.js'
import { isEditableTarget, MusicalTyping, StepGroup, TakeRecorder } from './music/keyboard.js'
import { exportMidi, importMidi, planExport } from './music/midi.js'
import * as P from './music/project.js'
import { floorTick, noteValueTicks, PPQ, ticksPerBar } from './music/time.js'

const engine = new AudioEngine()
const LIVE_CHORD_WINDOW_MS = 80
const SUGGESTION_GRID = PPQ / 4

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const safeName = (name) => (name || 'flux').replace(/[\\/:*?"<>|]+/g, '_')
// Local time stamp so repeated saves/exports of one project never share a file name
// (a second save within the same second gets -2, -3, …).
let lastStamp = null
let sameSecond = 0
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  const s = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  sameSecond = s === lastStamp ? sameSecond + 1 : 1
  lastStamp = s
  return sameSecond > 1 ? `${s}-${sameSecond}` : s
}

export default function App() {
  const { lang } = useI18n()
  const [history, dispatch] = useReducer(historyReducer, null, () => initHistory(P.createProject(lang)))
  const project = history.present
  const apply = useCallback((label, fn) => dispatch({ type: 'apply', label, fn }), [])
  const monitor = useCallback((fn) => dispatch({ type: 'monitor', fn }), [])

  const [, bumpEngine] = useReducer((n) => n + 1, 0)
  const [selectedTrackId, setSelectedTrackId] = useState(project.tracks[0].id)
  const [armedTrackId, setArmedTrackId] = useState(project.tracks[0].id)
  const [selectedNoteIds, setSelectedNoteIds] = useState(new Set())
  const [playhead, setPlayhead] = useState(0)
  const [transport, setTransport] = useState('stopped') // stopped | playing | recording
  const [metronome, setMetronome] = useState(false)
  const [countIn, setCountIn] = useState(true)
  const [gridId, setGridId] = useState('1/16')
  const [inputMode, setInputMode] = useState('audition')
  const [stepValueId, setStepValueId] = useState('1/8')
  const [keyboardOn, setKeyboardOn] = useState(false)
  const [, bumpKeyboard] = useReducer((n) => n + 1, 0)
  const [liveChord, setLiveChord] = useState(null)
  const [chordSelection, setChordSelection] = useState(null)
  const [picker, setPicker] = useState(null)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [liveTake, setLiveTake] = useState([])

  const playStartRef = useRef(0)
  const takeRef = useRef(null)
  const stepGroupRef = useRef(new StepGroup())
  const chordTimerRef = useRef(null)
  const state = useRef({})
  const selectedTrack = P.findTrack(project, selectedTrackId) ?? project.tracks[0]
  const armedTrack = P.findTrack(project, armedTrackId) ?? null
  const inputTarget = armedTrack ?? selectedTrack
  Object.assign(state.current, { project, inputTarget, inputMode, transport, stepValueId, playhead, armedTrack })

  const say = useCallback((text, tone = 'info') => setNotice({ text, tone, at: Date.now() }), [])
  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  // Keep selection/arm valid when tracks change (undo, open, delete).
  useEffect(() => {
    if (!P.findTrack(project, selectedTrackId)) setSelectedTrackId(project.tracks[0].id)
    if (armedTrackId && !P.findTrack(project, armedTrackId)) setArmedTrackId(null)
  }, [project, selectedTrackId, armedTrackId])

  useEffect(() => engine.subscribe(bumpEngine), [])
  useEffect(() => { engine.updateProject(project) }, [project])

  // Record which sound bank the project's tracks use (identifier only, never a machine path).
  useEffect(() => {
    const sb = engine.soundbank
    if (!sb || !project.tracks.some((t) => !t.soundbankId)) return
    monitor((p) => ({
      ...p,
      soundbanks: p.soundbanks.some((s) => s.id === sb.id) ? p.soundbanks : [...p.soundbanks, { ...sb }],
      tracks: p.tracks.map((t) => (t.soundbankId ? t : { ...t, soundbankId: sb.id })),
    }))
  }, [engine.soundbank, project.tracks, monitor])

  // --- Harmony: time-bounded detection on the selected pitched track + context analysis ----
  const analysisTrack = selectedTrack && !selectedTrack.isDrum ? selectedTrack : null
  const analysisNotes = useMemo(() => (analysisTrack ? P.trackNotes(analysisTrack) : []), [analysisTrack])
  const pitchedNotes = useMemo(() => project.tracks.filter((t) => !t.isDrum).flatMap(P.trackNotes), [project.tracks])
  const harmony = useMemo(() => {
    const t0 = performance.now()
    const suggestFrom = (segs) => {
      const out = []
      for (const s of segs) {
        if (!['clear', 'ambiguous', 'unsupported'].includes(s.detection.status)) continue
        const startTick = Math.round(s.startTick / SUGGESTION_GRID) * SUGGESTION_GRID
        const endTick = Math.max(startTick + SUGGESTION_GRID, Math.round(s.endTick / SUGGESTION_GRID) * SUGGESTION_GRID)
        if (project.chordTrack.some((e) => e.startTick < endTick && e.startTick + e.durationTick > startTick)) continue
        if (out.some((o) => o.startTick < endTick && o.endTick > startTick)) continue
        out.push({ ...s, startTick, endTick, key: `${startTick}-${endTick}-${s.label}` })
      }
      return out
    }
    const run = (key) => {
      const segs = segmentChords(analysisNotes, { key })
      const suggestions = suggestFrom(segs)
      const tentative = suggestions.filter((s) => s.detection.candidates.length).map((s) => ({
        id: `sugg:${s.key}`, startTick: s.startTick, durationTick: s.endTick - s.startTick, kind: 'chord',
        chord: s.detection.candidates[0].chord, tentative: true,
      }))
      const chords = [...project.chordTrack.filter((e) => e.status === 'confirmed'), ...tentative]
        .sort((a, b) => a.startTick - b.startTick)
      const analysis = analyzeHarmony({ chords, notes: pitchedNotes, timeSignature: project.timeSignature, keyContext: project.keyContext, revision: project.revision })
      return { suggestions, analysis }
    }
    const confirmedKey = project.keyContext?.status === 'confirmed' ? project.keyContext : null
    let result = run(confirmedKey)
    // Without a confirmed key, re-rank chord interpretations once by the inferred key.
    if (!confirmedKey && result.analysis.key) result = run(result.analysis.key)
    perf.record('chordAnalysisMs', performance.now() - t0)
    perf.record('chordAnalysisNotes', analysisNotes.length)
    return result
  }, [analysisNotes, pitchedNotes, project.chordTrack, project.keyContext, project.timeSignature, project.revision])

  const staleChords = useMemo(() => {
    const out = new Map()
    for (const e of project.chordTrack) {
      if (!e.sourceTrackId || e.sourceSignature == null) continue
      const t = P.findTrack(project, e.sourceTrackId)
      const sig = t ? notesSignature(P.trackNotes(t), e.startTick, e.startTick + e.durationTick) : null
      if (sig !== e.sourceSignature) out.set(e.id, { currentSignature: sig, track: t })
    }
    return out
  }, [project])

  // --- Computer keyboard -------------------------------------------------------------
  const kbRef = useRef(null)
  if (!kbRef.current) {
    kbRef.current = new MusicalTyping({
      onChange: bumpKeyboard,
      isBlocked: () => !!document.querySelector('dialog[open]'),
      noteOn: (pitch, velocity, timeStamp) => {
        const s = state.current
        const target = s.inputTarget
        engine.liveNoteOn(target, pitch, velocity, timeStamp)
        const voice = { pitch, trackId: target.id }
        if (takeRef.current) takeRef.current.noteOn(voice, pitch, velocity, engine.tickForEvent(timeStamp ?? performance.now()))
        if (s.inputMode === 'step' && s.transport === 'stopped') stepGroupRef.current.down(voice, pitch, velocity)
        return voice
      },
      noteOff: ({ pitch, voice }, timeStamp) => {
        engine.liveNoteOff(pitch)
        if (takeRef.current) takeRef.current.noteOff(voice, engine.tickForEvent(timeStamp ?? performance.now()))
        const group = stepGroupRef.current.up(voice)
        if (group) commitStep(group)
      },
    })
  }
  const kb = kbRef.current

  const commitStep = (group) => {
    const s = state.current
    const step = noteValueTicks(s.stepValueId)
    const at = s.playhead
    apply(m('label.stepInput'), (p) => P.addNotes(p, s.inputTarget.id, group.map((g) => ({ ...g, startTick: at, durationTick: step }))))
    setPlayhead(at + step)
  }

  const releaseKeys = useCallback(() => {
    stepGroupRef.current.reset()
    kb.releaseAll()
    engine.releaseLive()
  }, [kb])

  // Global key handling is registered once; the handler reads the latest render through a ref.
  const keyHandlerRef = useRef(null)
  keyHandlerRef.current = (e) => {
    if (kb.keyDown(e)) return
    if (e.code === 'Escape' && kb.enabled && !document.querySelector('dialog[open]')) {
      setKeyboardOn(false)
      return
    }
    if (isEditableTarget(e.target) || document.querySelector('dialog[open]')) return
    const mod = e.metaKey || e.ctrlKey
    if (e.code === 'Space' && !mod && !e.altKey) {
      // Space: play from the playhead / pause / stop recording. preventDefault keeps a focused
      // button from also clicking and the page from scrolling.
      e.preventDefault()
      if (e.repeat) return
      const t = state.current.transport
      if (t === 'recording') stopTransport(true)
      else if (t === 'playing') stopTransport(false)
      else play()
    } else if (mod && e.code === 'KeyZ') {
      e.preventDefault()
      if (state.current.transport === 'recording') return
      dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
    } else if (!mod && (e.code === 'Delete' || e.code === 'Backspace')) {
      e.preventDefault()
      deleteSelection()
    }
  }
  useEffect(() => {
    const onDown = (e) => keyHandlerRef.current(e)
    const onUp = (e) => {
      kb.keyUp(e)
      if (e.code === 'Space' && !isEditableTarget(e.target) && !document.querySelector('dialog[open]')) e.preventDefault()
    }
    const onBlur = () => releaseKeys()
    const onVisibility = () => { if (document.hidden) releaseKeys() }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      releaseKeys()
    }
  }, [kb, releaseKeys])

  useEffect(() => {
    kb.setEnabled(keyboardOn)
    if (!keyboardOn) engine.releaseLive()
  }, [keyboardOn, kb])
  // Changing the input target or mode releases everything held.
  useEffect(() => releaseKeys(), [inputTarget.id, inputMode, releaseKeys])

  // Live chord display: update once the held set has been stable for ~80 ms (display only).
  const heldKey = kb.heldPitches().slice().sort((a, b) => a - b).join(',')
  const effectiveKey = harmony.analysis.key
  useEffect(() => {
    clearTimeout(chordTimerRef.current)
    chordTimerRef.current = setTimeout(() => {
      const fired = performance.now()
      const pitches = heldKey ? heldKey.split(',').map(Number) : []
      if (!pitches.length) {
        setLiveChord((c) => (c ? { ...c, active: false, fired: null } : c))
        return
      }
      const detection = detectChord(pitches, { key: effectiveKey })
      setLiveChord({ detection, pitches, active: true, fired })
    }, LIVE_CHORD_WINDOW_MS)
    return () => clearTimeout(chordTimerRef.current)
  }, [heldKey, effectiveKey])
  useEffect(() => {
    if (liveChord?.fired) perf.record('liveChordUpdateMs', performance.now() - liveChord.fired)
  }, [liveChord])

  // --- Transport -----------------------------------------------------------------------
  const finishTake = useCallback((stopTick) => {
    const take = takeRef.current
    takeRef.current = null
    setLiveTake([])
    if (!take) return
    const notes = take.finish(stopTick)
    const target = state.current.armedTrack
    if (notes.length && target) {
      apply(m('label.recordTake', { n: notes.length }), (p) => P.addNotes(p, target.id, notes))
      say(m('notice.recorded', { n: notes.length, name: target.name }))
    }
  }, [apply, say])

  const stopTransport = useCallback((returnToStart = true, autoStopTick = null) => {
    // Close the take at the stop position first, so keys still held end exactly there.
    const tick = engine.positionTick()
    if (state.current.transport === 'recording') finishTake(autoStopTick ?? Math.max(0, Math.round(tick ?? 0)))
    releaseKeys()
    engine.stop()
    setTransport('stopped')
    setPlayhead(returnToStart ? playStartRef.current : Math.max(0, Math.round(tick ?? state.current.playhead)))
  }, [finishTake, releaseKeys])

  const play = (fromTick = playhead) => {
    if (!engine.ready) return say(m('notice.enableFirst'), 'warn')
    playStartRef.current = fromTick
    engine.play({ project, fromTick, metronome })
    setTransport('playing')
  }

  const record = () => {
    if (!engine.ready) return say(m('notice.enableFirst'), 'warn')
    if (!armedTrack) return say(m('notice.armFirst'), 'warn')
    if (transport !== 'stopped') stopTransport(false)
    releaseKeys()
    playStartRef.current = playhead
    takeRef.current = new TakeRecorder(playhead)
    setInputMode('record')
    setKeyboardOn(true)
    engine.play({ project, fromTick: playhead, countIn, metronome, recording: true,
      onAutoStop: (tick) => stopTransport(true, tick) })
    setTransport('recording')
  }

  useEffect(() => {
    if (transport !== 'recording') return undefined
    const id = setInterval(() => {
      const tick = engine.positionTick()
      if (takeRef.current && tick != null) setLiveTake(takeRef.current.snapshot(Math.round(tick)))
    }, 100)
    return () => clearInterval(id)
  }, [transport])

  useEffect(() => engine.setMetronome(metronome), [metronome])

  const seek = (tick) => {
    const t = Math.max(0, Math.round(tick))
    if (transport === 'playing') play(t)
    else if (transport === 'stopped') setPlayhead(t)
  }

  // --- Editing -------------------------------------------------------------------------
  function deleteSelection() {
    if (state.current.transport === 'recording') return
    if (selectedNoteIds.size) {
      apply(m('label.deleteNotes', { n: selectedNoteIds.size }), (p) => P.deleteNotes(p, selectedTrack.id, [...selectedNoteIds]))
      setSelectedNoteIds(new Set())
    } else if (chordSelection?.type === 'event') {
      apply(m('label.deleteChord'), (p) => P.deleteChord(p, chordSelection.id))
      setChordSelection(null)
    }
  }

  const addTrack = () => {
    let id
    apply(m('label.addTrack'), (p) => {
      const r = P.addTrack(p, { name: translate(lang, 'project.trackN', { n: p.tracks.length + 1 }), program: 0, soundbankId: engine.soundbank?.id ?? null })
      id = r.trackId
      return r.project
    })
    setTimeout(() => id && setSelectedTrackId(id))
  }

  const loadProject = (next, label) => {
    if (transport !== 'stopped') stopTransport(false)
    releaseKeys()
    dispatch({ type: 'load', project: next, label })
    setSelectedTrackId(next.tracks[0].id)
    setArmedTrackId(next.tracks.find((t) => !t.isDrum)?.id ?? next.tracks[0].id)
    setSelectedNoteIds(new Set())
    setChordSelection(null)
    setPlayhead(0)
  }

  const openProjectFile = async (file) => {
    const result = P.parseProjectFile(await file.text(), lang)
    if (!result.ok) {
      setModal({ title: m('modal.cannotOpen', { file: file.name }), lines: result.errors, tone: 'error', note: m('modal.projectUnchanged') })
      return
    }
    loadProject(result.project, m('label.openProject', { file: file.name }))
    say(m('notice.opened', { file: file.name }))
  }

  const saveProject = () => download(`${safeName(project.name)}-${stamp()}.flux.json`, P.serializeProject(project), 'application/json')

  const importMidiFile = async (file) => {
    const result = importMidi(new Uint8Array(await file.arrayBuffer()), { name: file.name.replace(/\.midi?$/i, ''), lang })
    if (!result.ok) {
      setModal({ title: m('modal.cannotImport', { file: file.name }), lines: result.errors, tone: 'error', note: m('modal.projectUnchanged') })
      return
    }
    const summary = m('notice.importSummary', { tracks: result.stats.tracks, notes: result.stats.notes, ppq: result.stats.sourcePpq })
    const doImport = () => {
      loadProject(result.project, m('label.importMidi', { file: file.name }))
      say(m('notice.imported', { file: file.name, summary }))
    }
    if (!result.limitations.length) {
      doImport()
      if (result.notices.length) say(result.notices)
      return
    }
    setModal({
      title: m('modal.importLoses', { file: file.name }), lines: [...result.limitations, ...result.notices], tone: 'warn',
      note: m('modal.importNote', { summary }),
      actions: [{ label: m('modal.importAnyway'), primary: true, run: doImport }],
    })
  }

  const exportMidiFile = () => {
    const plan = planExport(project)
    if (!plan.ok) {
      setModal({ title: m('modal.cannotExport'), lines: plan.errors, tone: 'error' })
      return
    }
    const doExport = () => download(`${safeName(project.name)}-${stamp()}.mid`, exportMidi(project, plan), 'audio/midi')
    if (!plan.warnings.length) return doExport()
    setModal({ title: m('modal.confirmExport'), lines: plan.warnings, tone: 'warn', actions: [{ label: m('modal.exportAnyway'), primary: true, run: doExport }] })
  }

  // --- Chords --------------------------------------------------------------------------
  const writeChord = (event, label) => {
    const sourceTrack = analysisTrack
    apply(label, (p) => P.placeChord(p, {
      status: 'confirmed',
      ...(sourceTrack && event.source !== 'midi_detected' ? {
        sourceTrackId: sourceTrack.id,
        sourceSignature: notesSignature(P.trackNotes(sourceTrack), event.startTick, event.startTick + event.durationTick),
      } : {}),
      ...event,
    }))
  }

  const adoptSuggestion = (s, candidate = s.detection.candidates[0]) => {
    if (!candidate) return
    writeChord({
      startTick: s.startTick, durationTick: s.endTick - s.startTick, kind: 'chord', chord: candidate.chord,
      source: 'midi_detected', sourceTrackId: analysisTrack.id, sourceNoteIds: s.noteIds,
      sourceSignature: notesSignature(analysisNotes, s.startTick, s.endTick),
    }, m('label.adoptSuggestion', { symbol: chordSymbol(candidate.chord) }))
    setChordSelection(null)
  }

  const adoptAllSuggestions = () => {
    const list = harmony.suggestions.filter((s) => s.detection.candidates.length)
    if (!list.length) return
    apply(m('label.adoptAll', { n: list.length }), (p) => list.reduce((q, s) => P.placeChord(q, {
      startTick: s.startTick, durationTick: s.endTick - s.startTick, kind: 'chord', chord: s.detection.candidates[0].chord,
      source: 'midi_detected', status: 'confirmed', sourceTrackId: analysisTrack.id, sourceNoteIds: s.noteIds,
      sourceSignature: notesSignature(analysisNotes, s.startTick, s.endTick),
    }), p))
  }

  const defaultChordRange = () => {
    if (chordSelection?.type === 'range') return chordSelection
    const bar = ticksPerBar(project.timeSignature)
    const start = floorTick(playhead, bar)
    return { startTick: start, endTick: start + bar }
  }

  const writeLiveChord = (candidate) => {
    const { startTick, endTick } = defaultChordRange()
    writeChord({ startTick, durationTick: endTick - startTick, kind: 'chord', chord: candidate.chord, source: 'midi_detected' },
      m('label.writeChord', { symbol: chordSymbol(candidate.chord) }))
    say(m('notice.chordWritten', { symbol: chordSymbol(candidate.chord), start: startTick / PPQ, end: endTick / PPQ }))
  }

  const previewChord = (chord) => {
    if (!engine.preview(voiceChord(chord), analysisTrack ?? { program: 0, isDrum: false })) say(m('notice.noSoundPreview'), 'warn')
  }

  // Explicit "chord track → new MIDI track": block chords from confirmed chords only, optionally
  // limited to the selected range. The chord track itself never sounds or exports.
  const chordsToTrack = (range) => {
    const bounds = range ? { startTick: range.startTick, endTick: range.endTick } : {}
    const notes = P.chordTrackNotes(project.chordTrack, bounds)
    if (!notes.length) return say(m(range ? 'notice.noChordsInRange' : 'notice.noConfirmedChords'), 'warn')
    const n = project.chordTrack.filter((e) => e.status === 'confirmed' && e.kind === 'chord'
      && e.startTick < (bounds.endTick ?? Infinity) && e.startTick + e.durationTick > (bounds.startTick ?? 0)).length
    const name = translate(lang, 'project.chordTrackName')
    let id
    apply(m('label.chordsToTrack', { n }), (p) => {
      const r = P.addTrack(p, { name, program: 0, soundbankId: engine.soundbank?.id ?? null })
      id = r.trackId
      return P.addNotes(r.project, id, notes)
    })
    setTimeout(() => id && setSelectedTrackId(id))
    say(m('notice.chordsToTrack', { n, name }))
    return undefined
  }

  // --- Verification hook (read-only state + perf) --------------------------------------
  useEffect(() => {
    window.__flux = {
      engine, perf, project, history: { past: history.past.length, future: history.future.length },
      harmony, liveChord, selectedTrackId, armedTrackId, playhead, transport, lang, selectedNoteIds: [...selectedNoteIds],
      symbols: () => project.chordTrack.map(eventSymbol),
    }
  })

  const soundbankMismatch = engine.soundbank
    ? project.soundbanks.find((s) => project.tracks.some((t) => t.soundbankId === s.id) && s.id !== engine.soundbank.id)
    : project.soundbanks.find((s) => project.tracks.some((t) => t.soundbankId === s.id))

  const layoutProps = {
    project, selectedTrack, analysisTrack, selectedNoteIds, setSelectedNoteIds, playhead, seek, transport,
    gridId, apply, monitor, chordSelection, setChordSelection, harmony, staleChords, liveTake, armedTrack, engine,
    inputMode, keyboardVelocity: kb.velocity, say,
  }

  return (
    <div className="app">
      <Header
        project={project} history={history} dispatch={dispatch} engine={engine}
        onRename={(name) => monitor((p) => P.renameProject(p, name))}
        onNew={() => loadProject(P.createProject(lang), m('label.newProject'))}
        onExample={() => loadProject(P.createExampleProject(lang), m('label.loadExample'))}
        onOpen={openProjectFile} onSave={saveProject} onImportMidi={importMidiFile} onExportMidi={exportMidiFile}
        soundbankMismatch={soundbankMismatch}
        onUseCurrentSoundbank={() => apply(m('label.useCurrentSoundbank'), (p) => ({
          ...p, soundbanks: [...p.soundbanks.filter((s) => s.id !== engine.soundbank.id), { ...engine.soundbank }],
          tracks: p.tracks.map((t) => ({ ...t, soundbankId: engine.soundbank.id })),
        }))}
        recording={transport === 'recording'}
      />
      <Transport
        project={project} transport={transport} engine={engine} playhead={playhead}
        onPlay={() => play()} onPause={() => stopTransport(false)} onStop={() => stopTransport(true)}
        onToStart={() => (transport === 'playing' ? play(0) : transport === 'stopped' && setPlayhead(0))}
        onRecord={record} canRecord={!!armedTrack}
        metronome={metronome} setMetronome={setMetronome} countIn={countIn} setCountIn={setCountIn}
        apply={apply} monitor={monitor} say={say}
      />
      <main className="workspace">
        <Timeline {...layoutProps} setGridId={setGridId}
          onSelectTrack={(id) => { if (id !== selectedTrack.id) setSelectedNoteIds(new Set()); setSelectedTrackId(id) }}
          onArm={(id) => setArmedTrackId((cur) => (cur === id ? null : id))}
          onPickInstrument={(id) => setPicker(id)} onAddTrack={addTrack} />
        <ChordPanel
          project={project} harmony={harmony} chordSelection={chordSelection} setChordSelection={setChordSelection}
          staleChords={staleChords} analysisTrack={analysisTrack} analysisNotes={analysisNotes} apply={apply}
          writeChord={writeChord} adoptSuggestion={adoptSuggestion} adoptAllSuggestions={adoptAllSuggestions}
          previewChord={previewChord} defaultRange={defaultChordRange} chordsToTrack={chordsToTrack} say={say}
        />
      </main>
      <KeyboardPanel
        kb={kb} keyboardOn={keyboardOn} setKeyboardOn={setKeyboardOn} inputMode={inputMode} setInputMode={setInputMode}
        stepValueId={stepValueId} setStepValueId={setStepValueId} target={inputTarget} engine={engine}
        liveChord={liveChord} harmony={harmony} onWriteChord={writeLiveChord}
        onRest={() => setPlayhead((t) => t + noteValueTicks(stepValueId))}
        onManualChord={() => setChordSelection({ type: 'range', ...defaultChordRange(), manual: true })}
        onPanic={() => { releaseKeys(); engine.panic(); setTransport('stopped') }}
        transport={transport} playhead={playhead} project={project}
      />
      {picker && P.findTrack(project, picker) && (
        <InstrumentPicker
          track={P.findTrack(project, picker)} engine={engine} onClose={() => setPicker(null)}
          onChoose={(inst) => {
            apply(m('label.changeInstrument'), (p) => P.setTrackInstrument(p, picker, inst))
            setPicker(null)
          }}
        />
      )}
      {modal && <Modal {...modal} onClose={() => setModal(null)} />}
      {notice && (
        <div className={`notice notice-${notice.tone}`} role="status">
          {[].concat(notice.text).map((x) => translate(lang, x)).join(translate(lang, 'sep.clause'))}
        </div>
      )}
    </div>
  )
}
