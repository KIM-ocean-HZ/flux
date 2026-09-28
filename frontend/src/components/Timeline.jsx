import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18n.jsx'
import { m } from '../i18n/translate.js'
import { keyLabel } from '../music/analysis.js'
import { eventSymbol, pitchName } from '../music/chords.js'
import { drumNoteName } from '../music/gm.js'
import * as P from '../music/project.js'
import { floorTick, NOTE_VALUES, noteValueTicks, PPQ, pulse, snapTick, ticksPerBar, ticksPerDenominatorBeat } from '../music/time.js'
import TrackHeader from './TrackHeader.jsx'

// Arrange view (ruler/loop bar, playhead bar, chord and numeral lanes, one row per track) above
// the piano roll of the selected track. Both panes share the left gutter width and scroll
// horizontally together, so every lane lines up with the same ticks.
const GUTTER = 220
const RULER_H = 22
const PLAY_H = 16
const CHORD_H = 30
const ROMAN_H = 22
const CHORD_Y = RULER_H + PLAY_H
const ROMAN_Y = CHORD_Y + CHORD_H
const HEAD_H = ROMAN_Y + ROMAN_H
const TRACK_H = 52
const KEYS_W = 56
const EDGE = 6
const PREVIEW_SECONDS = 0.35

const localPoint = (e, el) => {
  const r = el.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

export default function Timeline({ project, selectedTrack, analysisTrack, selectedNoteIds, setSelectedNoteIds, playhead, seek,
  transport, gridId, setGridId, apply, monitor, chordSelection, setChordSelection, harmony, staleChords, liveTake,
  armedTrack, engine, keyboardVelocity, say, onSelectTrack, onArm, onPickInstrument, onAddTrack }) {
  const { t, lang } = useI18n()
  const ts = project.timeSignature
  const bar = ticksPerBar(ts)
  const beatTicks = ticksPerDenominatorBeat(ts)
  const pulseTicks = pulse(ts).ticks
  const [pxPerQuarter, setPxPerQuarter] = useState(56)
  const [showRef, setShowRef] = useState(true)
  const [rollOpen, setRollOpen] = useState(true)
  const [drag, setDrag] = useState(null)
  const arrangeRef = useRef(null)
  const scrollRef = useRef(null)
  const headRef = useRef(null)
  const lanesRef = useRef(null)
  const bodyRef = useRef(null)
  const headPlay = useRef(null)
  const lanesPlay = useRef(null)
  const bodyPlay = useRef(null)
  const k = pxPerQuarter / PPQ
  const grid = gridId === 'off' ? 1 : noteValueTicks(gridId)
  const snap = (tk) => (gridId === 'off' ? Math.round(tk) : snapTick(tk, grid))
  const recording = transport === 'recording'

  const notes = useMemo(() => P.trackNotes(selectedTrack), [selectedTrack])
  const refNotes = useMemo(() => project.tracks.filter((tr) => tr.id !== selectedTrack.id)
    .flatMap((tr) => P.trackNotes(tr).map((n) => ({ ...n, trackId: tr.id }))), [project.tracks, selectedTrack.id])
  const drum = selectedTrack.isDrum
  const [pMin, pMax] = drum ? [35, 81] : [21, 108]
  const rowH = drum ? 16 : 12
  const bodyH = (pMax - pMin + 1) * rowH
  const yOf = (pitch) => (pMax - pitch) * rowH
  const x = (tk) => tk * k
  const audible = P.audibleTrackIds(project.tracks)
  const lanesH = project.tracks.length * TRACK_H

  const contentEnd = Math.max(
    ...project.tracks.map((tr) => P.mainClip(tr).lengthTick), ...project.chordTrack.map((e) => e.startTick + e.durationTick),
    project.loopRange.endTick, playhead, ...liveTake.map((n) => n.startTick + n.durationTick), 0)
  const viewTicks = Math.max(bar * 8, (Math.ceil(contentEnd / bar) + 2) * bar)
  const W = x(viewTicks)

  // Center the piano roll on the selected track's notes (or middle C) when switching tracks or
  // reopening it; a reopened roll starts at the arrange view's horizontal position.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pitches = notes.map((n) => n.pitch)
    const center = pitches.length ? (Math.min(...pitches) + Math.max(...pitches)) / 2 : drum ? 42 : 64
    el.scrollTop = Math.max(0, yOf(center) - el.clientHeight / 2)
    el.scrollLeft = arrangeRef.current?.scrollLeft ?? 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrack.id, rollOpen])

  // Playhead follows the audio clock via direct DOM updates (no React re-render per frame).
  useEffect(() => {
    let raf
    const frame = () => {
      const tick = engine.positionTick()
      const tk = tick == null ? playhead : Math.max(0, tick)
      const px = String(x(tk))
      for (const el of [headPlay.current, lanesPlay.current, bodyPlay.current]) {
        if (el) { el.setAttribute('x1', px); el.setAttribute('x2', px) }
      }
      const s = scrollRef.current ?? arrangeRef.current
      if (tick != null && s && (x(tk) > s.scrollLeft + s.clientWidth - GUTTER - 40 || x(tk) < s.scrollLeft)) {
        s.scrollLeft = Math.max(0, x(tk) - 80)
      }
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  })

  // Copy only horizontal moves: a vertical scroll of one pane must not push its (possibly not
  // yet synced) horizontal position onto the other.
  const lastLeft = useRef(0)
  const syncScroll = (from, to) => () => {
    const a = from.current, b = to.current
    if (!a || !b || a.scrollLeft === lastLeft.current) return
    lastLeft.current = a.scrollLeft
    b.scrollLeft = a.scrollLeft
  }

  // --- Grid lines --------------------------------------------------------------------
  const lines = []
  const step = pxPerQuarter >= 80 ? Math.min(grid, beatTicks) : beatTicks
  for (let tk = 0; tk <= viewTicks; tk += step) {
    const cls = tk % bar === 0 ? 'grid-bar' : tk % pulseTicks === 0 ? 'grid-beat' : 'grid-sub'
    lines.push(<line key={tk} x1={x(tk)} x2={x(tk)} y1={0} y2={bodyH} className={cls} />)
  }
  const barsCount = viewTicks / bar

  // --- Note editing ------------------------------------------------------------------
  const previewPitch = (pitch) => engine.preview([pitch], selectedTrack, PREVIEW_SECONDS)

  const onNoteDown = (e, n) => {
    e.stopPropagation()
    if (recording || e.button !== 0) return
    let ids = selectedNoteIds
    if (e.shiftKey) {
      ids = new Set(ids)
      if (ids.has(n.id)) ids.delete(n.id)
      else ids.add(n.id)
    } else if (!ids.has(n.id)) ids = new Set([n.id])
    setSelectedNoteIds(ids)
    previewPitch(n.pitch)
    const p = localPoint(e, bodyRef.current)
    bodyRef.current.setPointerCapture(e.pointerId)
    const nearEnd = p.x > x(n.startTick + n.durationTick) - EDGE && n.durationTick * k > EDGE * 2
    setDrag({ kind: nearEnd ? 'resize' : 'move', ids, x0: p.x, y0: p.y, dt: 0, dp: 0, pitch: n.pitch })
  }
  const onBodyMove = (e) => {
    if (!drag) return
    const p = localPoint(e, bodyRef.current)
    if (drag.kind === 'marquee') return setDrag({ ...drag, x1: p.x, y1: p.y })
    if (drag.kind !== 'move' && drag.kind !== 'resize') return undefined
    const dp = drag.kind === 'move' ? -Math.round((p.y - drag.y0) / rowH) : 0
    if (dp !== drag.dp) previewPitch(Math.min(pMax, Math.max(pMin, drag.pitch + dp)))
    return setDrag({ ...drag, dt: (p.x - drag.x0) / k, dp })
  }
  const dragged = (n) => {
    if (!drag || !drag.ids?.has(n.id) || (drag.kind !== 'move' && drag.kind !== 'resize')) return n
    if (drag.kind === 'move') {
      const dt = gridId === 'off' ? Math.round(drag.dt) : Math.round(drag.dt / grid) * grid
      return { ...n, startTick: Math.max(0, n.startTick + dt), pitch: Math.min(pMax, Math.max(pMin, n.pitch + drag.dp)) }
    }
    const end = Math.max(n.startTick + Math.min(grid, n.durationTick), snap(n.startTick + n.durationTick + drag.dt))
    return { ...n, durationTick: end - n.startTick }
  }
  const marquee = drag?.kind === 'marquee' && (Math.abs(drag.x1 - drag.x0) > 3 || Math.abs(drag.y1 - drag.y0) > 3)
    ? { x0: Math.min(drag.x0, drag.x1), x1: Math.max(drag.x0, drag.x1), y0: Math.min(drag.y0, drag.y1), y1: Math.max(drag.y0, drag.y1) }
    : null
  const onBodyUp = () => {
    if (!drag) return
    if (drag.kind === 'move' || drag.kind === 'resize') {
      const changes = notes.filter((n) => drag.ids.has(n.id)).map((n) => [n, dragged(n)])
        .filter(([n, mv]) => n.startTick !== mv.startTick || n.pitch !== mv.pitch || n.durationTick !== mv.durationTick)
        .map(([, mv]) => mv)
      if (changes.length) {
        apply(m(drag.kind === 'move' ? 'label.moveNotes' : 'label.resizeNotes', { n: changes.length }),
          (p) => P.updateNotes(p, selectedTrack.id, changes.map(({ id, pitch, startTick, durationTick }) => ({ id, pitch, startTick, durationTick }))))
      }
    } else if (drag.kind === 'marquee') {
      // Logic-style rubber band: every note the rectangle touches; Shift adds to the selection.
      if (marquee) {
        const hits = notes.filter((n) => x(n.startTick) < marquee.x1 && x(n.startTick + n.durationTick) > marquee.x0
          && yOf(n.pitch) < marquee.y1 && yOf(n.pitch) + rowH > marquee.y0).map((n) => n.id)
        setSelectedNoteIds(drag.additive ? new Set([...selectedNoteIds, ...hits]) : new Set(hits))
      } else if (!drag.additive) setSelectedNoteIds(new Set())
    }
    setDrag(null)
  }
  const onBodyDown = (e) => {
    if (e.button !== 0 || (e.target !== e.currentTarget && !e.target.classList.contains('bg'))) return
    const p = localPoint(e, bodyRef.current)
    bodyRef.current.setPointerCapture(e.pointerId)
    setDrag({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: e.shiftKey })
  }
  const onBodyDouble = (e) => {
    if (recording || e.target.classList.contains('note')) return
    const p = localPoint(e, bodyRef.current)
    const pitch = pMax - Math.floor(p.y / rowH)
    const startTick = gridId === 'off' ? Math.round(p.x / k) : floorTick(p.x / k, grid)
    apply(m('label.addNote'), (proj) => P.addNotes(proj, selectedTrack.id, [{ pitch, startTick, durationTick: grid === 1 ? PPQ / 4 : grid, velocity: keyboardVelocity }]))
  }

  // --- Ruler (loop), playhead bar, chord lane ----------------------------------------------
  const chordAt = (tk) => project.chordTrack.find((e) => e.startTick <= tk && tk < e.startTick + e.durationTick)
  const onHeadDown = (e) => {
    if (e.button !== 0) return
    const p = localPoint(e, headRef.current)
    const tk = p.x / k
    headRef.current.setPointerCapture(e.pointerId)
    if (p.y < RULER_H) return setDrag({ kind: 'ruler', t0: tk, t1: tk })
    if (p.y < CHORD_Y) {
      if (transport === 'stopped') seek(snap(tk))
      return setDrag({ kind: 'scrub', t0: tk, t1: tk })
    }
    if (p.y < CHORD_Y + CHORD_H) {
      // Shift-drag always selects a range, even across existing chords.
      if (e.shiftKey) return setDrag({ kind: 'chord-range', t0: tk, t1: tk })
      const ev = chordAt(tk)
      if (ev && !recording) {
        setChordSelection({ type: 'event', id: ev.id })
        const nearEnd = p.x > x(ev.startTick + ev.durationTick) - EDGE
        return setDrag({ kind: nearEnd ? 'chord-resize' : 'chord-move', id: ev.id, t0: tk, t1: tk })
      }
      const s = harmony.suggestions.find((g) => g.startTick <= tk && tk < g.endTick)
      if (s) return setChordSelection({ type: 'suggestion', key: s.key })
      return setDrag({ kind: 'chord-range', t0: tk, t1: tk })
    }
    return undefined
  }
  const onHeadMove = (e) => {
    if (!drag || !['ruler', 'scrub', 'chord-move', 'chord-resize', 'chord-range'].includes(drag.kind)) return
    const t1 = Math.max(0, localPoint(e, headRef.current).x / k)
    if (drag.kind === 'scrub' && transport === 'stopped') seek(snap(t1))
    setDrag({ ...drag, t1 })
  }
  const chordDragged = (ev) => {
    if (!drag || drag.id !== ev.id) return ev
    const d = snap(drag.t1 - drag.t0)
    if (drag.kind === 'chord-move') return { ...ev, startTick: Math.max(0, ev.startTick + d) }
    return { ...ev, durationTick: Math.max(grid === 1 ? PPQ / 4 : grid, ev.durationTick + d) }
  }
  const onHeadUp = () => {
    if (!drag) return
    const moved = Math.abs(drag.t1 - drag.t0) * k > 4
    if (drag.kind === 'ruler') {
      // The bar ruler only sets the loop; locating is the playhead bar's job.
      if (moved) {
        const [a, b] = [drag.t0, drag.t1].sort((p, q) => p - q)
        const startTick = Math.max(0, floorTick(a, grid)), endTick = Math.max(startTick + grid, snap(b))
        monitor((p) => ({ ...p, loopRange: { startTick, endTick, enabled: true } }))
      }
    } else if (drag.kind === 'scrub') {
      if (transport === 'playing') seek(snap(drag.t1))
    } else if (drag.kind === 'chord-range') {
      let [a, b] = [drag.t0, drag.t1].sort((p, q) => p - q)
      if (!moved) { a = floorTick(a, bar); b = a + bar } else { a = floorTick(a, grid); b = Math.max(a + grid, snap(b)) }
      setChordSelection({ type: 'range', startTick: a, endTick: b })
    } else if ((drag.kind === 'chord-move' || drag.kind === 'chord-resize') && moved) {
      const ev = project.chordTrack.find((c) => c.id === drag.id)
      const next = chordDragged(ev)
      const conflicts = P.chordConflicts(project.chordTrack, next.startTick, next.startTick + next.durationTick, ev.id)
      apply(m(drag.kind === 'chord-move' ? 'label.moveChord' : 'label.resizeChord', { symbol: eventSymbol(ev) }),
        (p) => P.updateChord(p, ev.id, { startTick: next.startTick, durationTick: next.durationTick }))
      if (conflicts.length) say(m('notice.replacedOverlap', { list: conflicts.map((c) => eventSymbol(c.event)).join(t('sep.list')) }))
    }
    setDrag(null)
  }

  const onLanesDown = (e) => {
    if (e.button !== 0) return
    const row = project.tracks[Math.floor(localPoint(e, lanesRef.current).y / TRACK_H)]
    if (row) onSelectTrack(row.id)
  }
  // Like Logic: double-clicking a track's clip opens it in the piano roll.
  const onLanesDouble = (e) => {
    const row = project.tracks[Math.floor(localPoint(e, lanesRef.current).y / TRACK_H)]
    if (!row) return
    onSelectTrack(row.id)
    setRollOpen(true)
  }
  const toggleRoll = () => {
    // Hidden notes must not stay selected (Delete would remove them unseen).
    if (rollOpen) setSelectedNoteIds(new Set())
    setRollOpen(!rollOpen)
  }

  const loop = project.loopRange
  const rulerDrag = drag?.kind === 'ruler' && Math.abs(drag.t1 - drag.t0) * k > 4 ? [drag.t0, drag.t1].sort((a, b) => a - b) : null
  const rangeSel = chordSelection?.type === 'range' ? chordSelection
    : drag?.kind === 'chord-range' ? { startTick: Math.min(drag.t0, drag.t1), endTick: Math.max(drag.t0, drag.t1) } : null
  const analysis = harmony.analysis
  const key = analysis.key
  const romanFor = (id) => analysis.chords[id]
  const confirmedCount = project.chordTrack.filter((e) => e.status === 'confirmed').length

  const keyRows = []
  for (let pitch = pMax; pitch >= pMin; pitch--) {
    const black = [1, 3, 6, 8, 10].includes(pitch % 12)
    const label = drum ? drumNoteName(pitch)?.[lang] ?? '' : pitch % 12 === 0 ? pitchName(pitch) : ''
    keyRows.push(
      <g key={pitch}>
        <rect x={GUTTER - KEYS_W} y={yOf(pitch)} width={KEYS_W} height={rowH} className={drum ? 'key-drum' : black ? 'key-black' : 'key-white'} />
        {label && <text x={drum ? 6 : GUTTER - KEYS_W - 6} y={yOf(pitch) + rowH - 3} textAnchor={drum ? 'start' : 'end'} className="key-label">
          {drum ? `${pitch} ${label}` : label}</text>}
      </g>)
  }

  // Mini notes of one track, scaled into its row.
  const laneNotes = (tr, rowNotes, cls) => {
    if (!rowNotes.length) return null
    const y0 = project.tracks.indexOf(tr) * TRACK_H
    const pitches = rowNotes.map((n) => n.pitch)
    const lo = Math.min(...pitches) - 2, hi = Math.max(...pitches) + 2
    const inner = TRACK_H - 20
    const h = Math.max(2, Math.min(5, inner / (hi - lo + 1)))
    return rowNotes.map((n, i) => (
      <rect key={`${cls}${n.id ?? i}`} className={cls} x={x(n.startTick)} y={y0 + 16 + ((hi - n.pitch) / (hi - lo)) * (inner - h)}
        width={Math.max(1.5, x(n.durationTick))} height={h} />
    ))
  }

  return (
    <section className={`timeline ${rollOpen ? '' : 'roll-closed'}`} aria-label={t('timeline.label')}>
      <div className="timeline-toolbar">
        <span>{t('timeline.editing')}<strong>{selectedTrack.name}</strong>{selectedTrack.isDrum ? t('timeline.drumSuffix') : ''}
          {armedTrack?.id === selectedTrack.id ? t('timeline.armedSuffix') : ''}</span>
        <label>{t('timeline.grid')}
          <select value={gridId} onChange={(e) => setGridId(e.target.value)} aria-label={t('timeline.gridAria')}>
            {NOTE_VALUES.filter((v) => v.ticks <= PPQ).map((v) => <option key={v.id} value={v.id}>{t(`noteValue.${v.id}`)}</option>)}
            <option value="off">{t('timeline.gridOff')}</option>
          </select>
        </label>
        <button type="button" disabled={recording || !notes.length || grid === 1}
          title={t('timeline.quantizeTitle')} onClick={() => apply(m('label.quantize', { grid: gridId }), (p) => P.quantizeNotes(p, selectedTrack.id,
            selectedNoteIds.size ? [...selectedNoteIds] : null, grid))}>
          {selectedNoteIds.size ? t('timeline.quantizeSelected') : t('timeline.quantizeAll')}
        </button>
        <button type="button" aria-pressed={rollOpen} onClick={toggleRoll} title={t('timeline.rollTitle')} data-testid="roll-toggle">{t('timeline.roll')}</button>
        <button type="button" aria-pressed={showRef} disabled={!rollOpen} onClick={() => setShowRef(!showRef)}>{t('timeline.showRef')}</button>
        <span className="zoom">
          <button type="button" aria-label={t('timeline.zoomOut')} onClick={() => setPxPerQuarter((z) => Math.max(16, z / 1.4))}>−</button>
          <button type="button" aria-label={t('timeline.zoomIn')} onClick={() => setPxPerQuarter((z) => Math.min(240, z * 1.4))}>+</button>
        </span>
        <span className="hint">{t('timeline.hint')}</span>
      </div>

      <div className="arrange-scroll" ref={arrangeRef} onScroll={syncScroll(arrangeRef, scrollRef)}>
        <div className="tl-head" style={{ width: GUTTER + W }}>
          <div className="tl-corner" style={{ width: GUTTER, height: HEAD_H }}>
            <div style={{ height: RULER_H }}>{t('timeline.barsLoop')}</div>
            <div style={{ height: PLAY_H }}>{t('timeline.playheadBar')}</div>
            <div style={{ height: CHORD_H }}>{t('timeline.chords')}<span className="muted">&nbsp;· {t('timeline.confirmedCount', { n: confirmedCount })}</span></div>
            <div style={{ height: ROMAN_H }} title={key ? '' : t('timeline.noKeyTitle')}>
              {t('timeline.romans')}{key && <span className="muted">&nbsp;· {t(keyLabel(key))}{key.tentative ? t('timeline.inferred') : ''}</span>}
            </div>
          </div>
          <svg ref={headRef} width={W} height={HEAD_H} className="tl-head-svg"
            onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp}>
            <rect x={0} y={0} width={W} height={RULER_H} className="ruler-bg" />
            {loop && <rect x={x(loop.startTick)} y={0} width={x(loop.endTick - loop.startTick)} height={RULER_H}
              className={`loop-range ${loop.enabled ? 'on' : ''}`} />}
            {rulerDrag && <rect x={x(rulerDrag[0])} y={0} width={x(rulerDrag[1] - rulerDrag[0])} height={RULER_H} className="loop-range drag" />}
            <rect x={0} y={RULER_H} width={W} height={PLAY_H} className="playbar-bg" data-testid="playhead-bar" />
            {Array.from({ length: barsCount }, (_, i) => (
              <g key={i}>
                <line x1={x(i * bar)} x2={x(i * bar)} y1={0} y2={HEAD_H} className="grid-bar" />
                <text x={x(i * bar) + 3} y={15} className="bar-label">{i + 1}</text>
              </g>
            ))}
            <rect x={0} y={CHORD_Y} width={W} height={CHORD_H} className="chord-lane" />
            {rangeSel && <rect x={x(rangeSel.startTick)} y={CHORD_Y + 1} width={x(rangeSel.endTick - rangeSel.startTick)} height={CHORD_H - 2} className="chord-range" />}
            {harmony.suggestions.map((s) => {
              const selected = chordSelection?.type === 'suggestion' && chordSelection.key === s.key
              const top = s.detection.candidates[0]
              const label = top ? `${s.label}${s.detection.status === 'ambiguous' ? ' ?' : ''}` : '?'
              return (
                <g key={s.key} className={`chord suggestion ${top ? '' : 'unsupported'} ${selected ? 'selected' : ''}`}
                  data-testid="chord-suggestion" data-label={label}>
                  <title>{top ? t('timeline.suggestionTitle', { label: s.label, status: m(`detect.status.${s.detection.status}`) }) : t(s.detection.reason)}</title>
                  <rect x={x(s.startTick) + 1} y={CHORD_Y + 3} width={Math.max(4, x(s.endTick - s.startTick) - 2)} height={CHORD_H - 6} rx={4} />
                  <text x={x(s.startTick) + 5} y={CHORD_Y + 19}>{label}</text>
                </g>
              )
            })}
            {project.chordTrack.map((raw) => {
              const ev = chordDragged(raw)
              const selected = chordSelection?.type === 'event' && chordSelection.id === ev.id
              const stale = staleChords.has(ev.id)
              const cls = ev.kind === 'no_chord' ? 'nc' : ev.status === 'suggested' ? 'suggested' : 'confirmed'
              const source = ev.source === 'manual' ? t('chord.source.manual') : ev.source === 'midi_detected' ? t('chord.source.detectedShort') : ev.source
              return (
                <g key={ev.id} className={`chord ${cls} ${selected ? 'selected' : ''} ${stale ? 'stale' : ''}`} data-testid="chord-event"
                  data-label={eventSymbol(ev)}>
                  <title>{`${eventSymbol(ev)} · ${source}${stale ? t('timeline.staleSuffix') : ''}`}</title>
                  <rect x={x(ev.startTick) + 1} y={CHORD_Y + 2} width={Math.max(4, x(ev.durationTick) - 2)} height={CHORD_H - 4} rx={4} />
                  <text x={x(ev.startTick) + 5} y={CHORD_Y + 19}>{stale ? '⚠ ' : ''}{eventSymbol(ev)}</text>
                  <rect x={x(ev.startTick + ev.durationTick) - EDGE} y={CHORD_Y + 2} width={EDGE - 1} height={CHORD_H - 4} className="handle" />
                </g>
              )
            })}
            <rect x={0} y={ROMAN_Y} width={W} height={ROMAN_H} className="roman-lane" />
            {[...project.chordTrack.filter((e) => e.kind === 'chord').map((e) => ({ id: e.id, start: e.startTick })),
              ...harmony.suggestions.map((s) => ({ id: `sugg:${s.key}`, start: s.startTick, tentative: true }))].map(({ id, start, tentative }) => {
              const r = romanFor(id)
              if (!r) return null
              return (
                <text key={id} x={x(start) + 5} y={ROMAN_Y + 15}
                  className={`roman ${tentative || r.tentative || key?.tentative ? 'tentative' : ''}`} data-testid="roman"
                  data-display={r.display}>
                  <title>{[r.roman.text, t('timeline.romanNumber', { number: r.roman.number }), ...r.labels.map((l) => t(l)),
                    ...r.alternatives.map((a) => t('chord.alsoReads', { alt: a }))].join(' ')}</title>
                  {r.display}
                </text>
              )
            })}
            {drag?.kind === 'scrub' && transport === 'playing' && (
              <line x1={x(drag.t1)} x2={x(drag.t1)} y1={RULER_H} y2={HEAD_H} className="scrub" />
            )}
            <line ref={headPlay} y1={0} y2={HEAD_H} className="playhead" />
          </svg>
        </div>
        <div className="arrange-body" style={{ width: GUTTER + W }}>
          <div className="track-heads" style={{ width: GUTTER }}>
            {project.tracks.map((tr) => (
              <TrackHeader key={tr.id} track={tr} height={TRACK_H} selected={tr.id === selectedTrack.id} armed={tr.id === armedTrack?.id}
                audible={audible.has(tr.id)} canDelete={project.tracks.length > 1} onSelect={onSelectTrack} onArm={onArm}
                onPickInstrument={onPickInstrument} apply={apply} monitor={monitor} engine={engine} recording={recording} />
            ))}
            <button type="button" className="add-track" onClick={onAddTrack} disabled={recording}>{t('track.add')}</button>
          </div>
          <svg ref={lanesRef} width={W} height={lanesH} className="lanes" onPointerDown={onLanesDown} onDoubleClick={onLanesDouble}>
            {project.tracks.map((tr, i) => (
              <rect key={tr.id} className={`lane-bg ${tr.id === selectedTrack.id ? 'selected' : ''}`} x={0} y={i * TRACK_H} width={W} height={TRACK_H} />
            ))}
            {Array.from({ length: barsCount }, (_, i) => <line key={i} x1={x(i * bar)} x2={x(i * bar)} y1={0} y2={lanesH} className="grid-bar" />)}
            {project.tracks.map((tr, i) => {
              const clip = P.mainClip(tr)
              if (!clip.notes.length) return null
              return (
                <g key={tr.id} className={`clip ${tr.id === selectedTrack.id ? 'selected' : ''} ${audible.has(tr.id) ? '' : 'silent'}`}
                  data-testid="clip" data-track-id={tr.id}>
                  <rect className="clip-box" x={x(clip.startTick) + 0.5} y={i * TRACK_H + 3} width={Math.max(4, x(clip.lengthTick) - 1)} height={TRACK_H - 6} rx={4} />
                  <text className="clip-label" x={x(clip.startTick) + 5} y={i * TRACK_H + 14}>{tr.name}</text>
                  {laneNotes(tr, P.trackNotes(tr), 'mini-note')}
                </g>
              )
            })}
            {armedTrack && project.tracks.includes(armedTrack) && laneNotes(armedTrack, liveTake, 'mini-take')}
            <line ref={lanesPlay} y1={0} y2={lanesH} className="playhead" />
          </svg>
        </div>
      </div>

      {rollOpen && (
        <div className="timeline-scroll" ref={scrollRef} onScroll={syncScroll(scrollRef, arrangeRef)}>
          <div className="tl-body" style={{ width: GUTTER + W }}>
            <svg className="tl-keys" width={GUTTER} height={bodyH}>{keyRows}</svg>
            <svg ref={bodyRef} width={W} height={bodyH} className="roll"
              onPointerDown={onBodyDown} onPointerMove={onBodyMove} onPointerUp={onBodyUp} onDoubleClick={onBodyDouble}>
              <rect className="bg" x={0} y={0} width={W} height={bodyH} />
              {!drum && Array.from({ length: pMax - pMin + 1 }, (_, i) => pMax - i).filter((p) => [1, 3, 6, 8, 10].includes(p % 12))
                .map((p) => <rect key={p} className="bg row-black" x={0} y={yOf(p)} width={W} height={rowH} />)}
              {lines}
              {loop.enabled && <rect x={x(loop.startTick)} y={0} width={x(loop.endTick - loop.startTick)} height={bodyH} className="loop-shade" />}
              {showRef && refNotes.map((n) => n.pitch >= pMin && n.pitch <= pMax && (
                <rect key={`${n.trackId}${n.id}`} x={x(n.startTick)} y={yOf(n.pitch) + 2} width={Math.max(2, x(n.durationTick))}
                  height={rowH - 4} className="note-ref" />))}
              {notes.map((raw) => {
                const n = dragged(raw)
                const name = drum ? drumNoteName(n.pitch)?.[lang] ?? n.pitch : pitchName(n.pitch)
                return (
                  <rect key={n.id} data-testid="note" data-pitch={n.pitch} data-start={n.startTick}
                    x={x(n.startTick) + 0.5} y={yOf(n.pitch) + 1} width={Math.max(3, x(n.durationTick) - 1)} height={rowH - 2} rx={2}
                    className={`note ${selectedNoteIds.has(n.id) ? 'selected' : ''}`} style={{ opacity: 0.45 + n.velocity / 230 }}
                    onPointerDown={(e) => onNoteDown(e, raw)}>
                    <title>{t('timeline.noteTitle', { name, pitch: n.pitch, velocity: n.velocity })}</title>
                  </rect>
                )
              })}
              {armedTrack?.id === selectedTrack.id && liveTake.map((n, i) => (
                <rect key={`take${i}`} x={x(n.startTick)} y={yOf(n.pitch) + 1} width={Math.max(2, x(n.durationTick))} height={rowH - 2} className="note-take" />
              ))}
              {marquee && <rect className="marquee" data-testid="marquee" x={marquee.x0} y={marquee.y0}
                width={marquee.x1 - marquee.x0} height={marquee.y1 - marquee.y0} />}
              <line ref={bodyPlay} y1={0} y2={bodyH} className="playhead" />
            </svg>
          </div>
        </div>
      )}
      {analysisTrack == null && <div className="timeline-note">{t('timeline.drumNote')}</div>}
    </section>
  )
}
