import { useEffect, useMemo, useRef, useState } from 'react'
import { eventSymbol, pitchName } from '../music/chords.js'
import { drumNoteName } from '../music/gm.js'
import * as P from '../music/project.js'
import { floorTick, NOTE_VALUES, noteValueTicks, PPQ, pulse, snapTick, ticksPerBar, ticksPerDenominatorBeat } from '../music/time.js'

const GUTTER = 72
const RULER_H = 22
const CHORD_H = 30
const ROMAN_H = 22
const HEAD_H = RULER_H + CHORD_H + ROMAN_H
const EDGE = 6

const localPoint = (e, el) => {
  const r = el.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

export default function Timeline({ project, selectedTrack, analysisTrack, selectedNoteIds, setSelectedNoteIds, playhead, seek,
  transport, gridId, setGridId, apply, monitor, chordSelection, setChordSelection, harmony, staleChords, liveTake,
  armedTrack, engine, keyboardVelocity, say }) {
  const ts = project.timeSignature
  const bar = ticksPerBar(ts)
  const beatTicks = ticksPerDenominatorBeat(ts)
  const pulseTicks = pulse(ts).ticks
  const [pxPerQuarter, setPxPerQuarter] = useState(56)
  const [showRef, setShowRef] = useState(true)
  const [drag, setDrag] = useState(null)
  const scrollRef = useRef(null)
  const headRef = useRef(null)
  const bodyRef = useRef(null)
  const headPlay = useRef(null)
  const bodyPlay = useRef(null)
  const k = pxPerQuarter / PPQ
  const grid = gridId === 'off' ? 1 : noteValueTicks(gridId)
  const snap = (t) => (gridId === 'off' ? Math.round(t) : snapTick(t, grid))
  const recording = transport === 'recording'

  const notes = useMemo(() => P.trackNotes(selectedTrack), [selectedTrack])
  const refNotes = useMemo(() => project.tracks.filter((t) => t.id !== selectedTrack.id)
    .flatMap((t) => P.trackNotes(t).map((n) => ({ ...n, trackId: t.id }))), [project.tracks, selectedTrack.id])
  const drum = selectedTrack.isDrum
  const [pMin, pMax] = drum ? [35, 81] : [21, 108]
  const rowH = drum ? 16 : 12
  const bodyH = (pMax - pMin + 1) * rowH
  const yOf = (pitch) => (pMax - pitch) * rowH
  const x = (t) => t * k

  const contentEnd = Math.max(
    ...project.tracks.map((t) => P.mainClip(t).lengthTick), ...project.chordTrack.map((e) => e.startTick + e.durationTick),
    project.loopRange.endTick, playhead, ...liveTake.map((n) => n.startTick + n.durationTick), 0)
  const viewTicks = Math.max(bar * 8, (Math.ceil(contentEnd / bar) + 2) * bar)
  const W = x(viewTicks)

  // Center the view on the selected track's notes (or middle C) when switching tracks.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pitches = notes.map((n) => n.pitch)
    const center = pitches.length ? (Math.min(...pitches) + Math.max(...pitches)) / 2 : drum ? 42 : 64
    el.scrollTop = Math.max(0, yOf(center) - (el.clientHeight - HEAD_H) / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrack.id])

  // Playhead follows the audio clock via direct DOM updates (no React re-render per frame).
  useEffect(() => {
    let raf
    const frame = () => {
      const tick = engine.positionTick()
      const t = tick == null ? playhead : Math.max(0, tick)
      const px = String(x(t))
      for (const el of [headPlay.current, bodyPlay.current]) {
        if (el) { el.setAttribute('x1', px); el.setAttribute('x2', px) }
      }
      const s = scrollRef.current
      if (tick != null && s && (x(t) > s.scrollLeft + s.clientWidth - GUTTER - 40 || x(t) < s.scrollLeft)) {
        s.scrollLeft = Math.max(0, x(t) - 80)
      }
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  })

  // --- Grid lines --------------------------------------------------------------------
  const lines = []
  const step = pxPerQuarter >= 80 ? Math.min(grid, beatTicks) : beatTicks
  for (let t = 0; t <= viewTicks; t += step) {
    const cls = t % bar === 0 ? 'grid-bar' : t % pulseTicks === 0 ? 'grid-beat' : 'grid-sub'
    lines.push(<line key={t} x1={x(t)} x2={x(t)} y1={0} y2={bodyH} className={cls} />)
  }

  // --- Note editing ------------------------------------------------------------------
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
    const p = localPoint(e, bodyRef.current)
    bodyRef.current.setPointerCapture(e.pointerId)
    const nearEnd = p.x > x(n.startTick + n.durationTick) - EDGE && n.durationTick * k > EDGE * 2
    setDrag({ kind: nearEnd ? 'resize' : 'move', ids, x0: p.x, y0: p.y, dt: 0, dp: 0 })
  }
  const onBodyMove = (e) => {
    if (!drag || (drag.kind !== 'move' && drag.kind !== 'resize')) return
    const p = localPoint(e, bodyRef.current)
    setDrag({ ...drag, dt: (p.x - drag.x0) / k, dp: drag.kind === 'move' ? -Math.round((p.y - drag.y0) / rowH) : 0 })
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
  const onBodyUp = () => {
    if (!drag) return
    if (drag.kind === 'move' || drag.kind === 'resize') {
      const changes = notes.filter((n) => drag.ids.has(n.id)).map((n) => [n, dragged(n)])
        .filter(([n, m]) => n.startTick !== m.startTick || n.pitch !== m.pitch || n.durationTick !== m.durationTick)
        .map(([, m]) => m)
      if (changes.length) {
        apply(drag.kind === 'move' ? `移动 ${changes.length} 个音符` : `改变 ${changes.length} 个音符时值`,
          (p) => P.updateNotes(p, selectedTrack.id, changes.map(({ id, pitch, startTick, durationTick }) => ({ id, pitch, startTick, durationTick }))))
      }
    }
    setDrag(null)
  }
  const onBodyDown = (e) => {
    if (e.button !== 0 || (e.target !== e.currentTarget && !e.target.classList.contains('bg'))) return
    if (!e.shiftKey) setSelectedNoteIds(new Set())
  }
  const onBodyDouble = (e) => {
    if (recording || e.target.classList.contains('note')) return
    const p = localPoint(e, bodyRef.current)
    const pitch = pMax - Math.floor(p.y / rowH)
    const startTick = gridId === 'off' ? Math.round(p.x / k) : floorTick(p.x / k, grid)
    apply('添加音符', (proj) => P.addNotes(proj, selectedTrack.id, [{ pitch, startTick, durationTick: grid === 1 ? PPQ / 4 : grid, velocity: keyboardVelocity }]))
  }

  // --- Ruler, chord lane -------------------------------------------------------------
  const chordAt = (t) => project.chordTrack.find((e) => e.startTick <= t && t < e.startTick + e.durationTick)
  const onHeadDown = (e) => {
    if (e.button !== 0) return
    const p = localPoint(e, headRef.current)
    const t = p.x / k
    headRef.current.setPointerCapture(e.pointerId)
    if (p.y < RULER_H) return setDrag({ kind: 'ruler', t0: t, t1: t })
    if (p.y < RULER_H + CHORD_H) {
      const ev = chordAt(t)
      if (ev && !recording) {
        setChordSelection({ type: 'event', id: ev.id })
        const nearEnd = p.x > x(ev.startTick + ev.durationTick) - EDGE
        return setDrag({ kind: nearEnd ? 'chord-resize' : 'chord-move', id: ev.id, t0: t, t1: t })
      }
      const s = harmony.suggestions.find((g) => g.startTick <= t && t < g.endTick)
      if (s) return setChordSelection({ type: 'suggestion', key: s.key })
      return setDrag({ kind: 'chord-range', t0: t, t1: t })
    }
    return undefined
  }
  const onHeadMove = (e) => {
    if (!drag || !['ruler', 'chord-move', 'chord-resize', 'chord-range'].includes(drag.kind)) return
    setDrag({ ...drag, t1: localPoint(e, headRef.current).x / k })
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
      if (moved) {
        const [a, b] = [drag.t0, drag.t1].sort((m, n) => m - n)
        const startTick = Math.max(0, floorTick(a, grid)), endTick = Math.max(startTick + grid, snap(b))
        monitor((p) => ({ ...p, loopRange: { startTick, endTick, enabled: true } }))
      } else seek(snap(drag.t0))
    } else if (drag.kind === 'chord-range') {
      let [a, b] = [drag.t0, drag.t1].sort((m, n) => m - n)
      if (!moved) { a = floorTick(a, bar); b = a + bar } else { a = floorTick(a, grid); b = Math.max(a + grid, snap(b)) }
      setChordSelection({ type: 'range', startTick: a, endTick: b })
    } else if ((drag.kind === 'chord-move' || drag.kind === 'chord-resize') && moved) {
      const ev = project.chordTrack.find((c) => c.id === drag.id)
      const next = chordDragged(ev)
      const conflicts = P.chordConflicts(project.chordTrack, next.startTick, next.startTick + next.durationTick, ev.id)
      apply(drag.kind === 'chord-move' ? `移动和弦 ${eventSymbol(ev)}` : `改变和弦时长 ${eventSymbol(ev)}`,
        (p) => P.updateChord(p, ev.id, { startTick: next.startTick, durationTick: next.durationTick }))
      if (conflicts.length) say(`已替换重叠部分：${conflicts.map((c) => eventSymbol(c.event)).join('、')}（可撤销）`)
    }
    setDrag(null)
  }

  const loop = project.loopRange
  const rulerDrag = drag?.kind === 'ruler' && Math.abs(drag.t1 - drag.t0) * k > 4 ? [drag.t0, drag.t1].sort((a, b) => a - b) : null
  const rangeSel = chordSelection?.type === 'range' ? chordSelection
    : drag?.kind === 'chord-range' ? { startTick: Math.min(drag.t0, drag.t1), endTick: Math.max(drag.t0, drag.t1) } : null
  const analysis = harmony.analysis
  const romanFor = (id) => analysis.chords[id]

  const barsCount = viewTicks / bar
  const keyRows = []
  for (let pitch = pMax; pitch >= pMin; pitch--) {
    const black = [1, 3, 6, 8, 10].includes(pitch % 12)
    const label = drum ? drumNoteName(pitch)?.zh ?? '' : pitch % 12 === 0 ? pitchName(pitch) : ''
    keyRows.push(
      <g key={pitch}>
        <rect x={0} y={yOf(pitch)} width={GUTTER} height={rowH} className={drum ? 'key-drum' : black ? 'key-black' : 'key-white'} />
        {label && <text x={4} y={yOf(pitch) + rowH - 3} className="key-label">{drum ? `${pitch} ${label}` : label}</text>}
      </g>)
  }

  return (
    <section className="timeline" aria-label="编辑区">
      <div className="timeline-toolbar">
        <span>当前片段：<strong>{selectedTrack.name}</strong>{selectedTrack.isDrum ? ' · 鼓' : ''}
          {armedTrack?.id === selectedTrack.id ? ' · 录音准备中' : ''}</span>
        <label>吸附
          <select value={gridId} onChange={(e) => setGridId(e.target.value)} aria-label="编辑网格">
            {NOTE_VALUES.filter((v) => v.ticks <= PPQ).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            <option value="off">关闭</option>
          </select>
        </label>
        <button type="button" disabled={recording || !notes.length || grid === 1}
          title="量化默认关闭；显式量化可撤销" onClick={() => apply(`量化到 ${gridId}`, (p) => P.quantizeNotes(p, selectedTrack.id,
            selectedNoteIds.size ? [...selectedNoteIds] : null, grid))}>
          量化{selectedNoteIds.size ? '选中' : '全部'}
        </button>
        <button type="button" aria-pressed={showRef} onClick={() => setShowRef(!showRef)}>显示参考轨</button>
        <span className="zoom">
          <button type="button" aria-label="缩小" onClick={() => setPxPerQuarter((z) => Math.max(16, z / 1.4))}>−</button>
          <button type="button" aria-label="放大" onClick={() => setPxPerQuarter((z) => Math.min(240, z * 1.4))}>+</button>
        </span>
        <span className="hint">单击选择 · 双击空白添加 · 拖动移动 · 拖右边缘改长度 · Delete 删除 · 时间尺拖动设循环 · 和弦行拖动选范围</span>
      </div>
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="tl-head" style={{ width: GUTTER + W }}>
          <div className="tl-corner" style={{ width: GUTTER, height: HEAD_H }}>
            <div style={{ height: RULER_H }}>小节</div>
            <div style={{ height: CHORD_H }}>和弦</div>
            <div style={{ height: ROMAN_H }} title={analysis.key ? '' : '调性证据不足时不显示级数'}>
              级数{analysis.key?.tentative ? '（推测）' : ''}
            </div>
          </div>
          <svg ref={headRef} width={W} height={HEAD_H} className="tl-head-svg"
            onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp}>
            <rect x={0} y={0} width={W} height={RULER_H} className="ruler-bg" />
            {loop && <rect x={x(loop.startTick)} y={0} width={x(loop.endTick - loop.startTick)} height={RULER_H}
              className={`loop-range ${loop.enabled ? 'on' : ''}`} />}
            {rulerDrag && <rect x={x(rulerDrag[0])} y={0} width={x(rulerDrag[1] - rulerDrag[0])} height={RULER_H} className="loop-range drag" />}
            {Array.from({ length: barsCount }, (_, i) => (
              <g key={i}>
                <line x1={x(i * bar)} x2={x(i * bar)} y1={0} y2={HEAD_H} className="grid-bar" />
                <text x={x(i * bar) + 3} y={15} className="bar-label">{i + 1}</text>
              </g>
            ))}
            <rect x={0} y={RULER_H} width={W} height={CHORD_H} className="chord-lane" />
            {rangeSel && <rect x={x(rangeSel.startTick)} y={RULER_H + 1} width={x(rangeSel.endTick - rangeSel.startTick)} height={CHORD_H - 2} className="chord-range" />}
            {harmony.suggestions.map((s) => {
              const selected = chordSelection?.type === 'suggestion' && chordSelection.key === s.key
              const top = s.detection.candidates[0]
              const label = top ? `${s.label}${s.detection.status === 'ambiguous' ? ' ?' : ''}` : '?'
              return (
                <g key={s.key} className={`chord suggestion ${top ? '' : 'unsupported'} ${selected ? 'selected' : ''}`}
                  data-testid="chord-suggestion" data-label={label}>
                  <title>{top ? `建议：${s.label}（${s.detection.status === 'ambiguous' ? '多种解释' : '明确匹配'}）——点击查看、采用` : s.detection.reason}</title>
                  <rect x={x(s.startTick) + 1} y={RULER_H + 3} width={Math.max(4, x(s.endTick - s.startTick) - 2)} height={CHORD_H - 6} rx={4} />
                  <text x={x(s.startTick) + 5} y={RULER_H + 19}>{label}</text>
                </g>
              )
            })}
            {project.chordTrack.map((raw) => {
              const ev = chordDragged(raw)
              const selected = chordSelection?.type === 'event' && chordSelection.id === ev.id
              const stale = staleChords.has(ev.id)
              const cls = ev.kind === 'no_chord' ? 'nc' : ev.status === 'suggested' ? 'suggested' : 'confirmed'
              return (
                <g key={ev.id} className={`chord ${cls} ${selected ? 'selected' : ''} ${stale ? 'stale' : ''}`} data-testid="chord-event"
                  data-label={eventSymbol(ev)}>
                  <title>{`${eventSymbol(ev)} · ${ev.source === 'manual' ? '手选' : ev.source === 'midi_detected' ? '识别后确认' : ev.source}${stale ? ' · 输入已变化，可重新分析' : ''}`}</title>
                  <rect x={x(ev.startTick) + 1} y={RULER_H + 2} width={Math.max(4, x(ev.durationTick) - 2)} height={CHORD_H - 4} rx={4} />
                  <text x={x(ev.startTick) + 5} y={RULER_H + 19}>{stale ? '⚠ ' : ''}{eventSymbol(ev)}</text>
                  <rect x={x(ev.startTick + ev.durationTick) - EDGE} y={RULER_H + 2} width={EDGE - 1} height={CHORD_H - 4} className="handle" />
                </g>
              )
            })}
            <rect x={0} y={RULER_H + CHORD_H} width={W} height={ROMAN_H} className="roman-lane" />
            {[...project.chordTrack.filter((e) => e.kind === 'chord').map((e) => ({ id: e.id, start: e.startTick })),
              ...harmony.suggestions.map((s) => ({ id: `sugg:${s.key}`, start: s.startTick, tentative: true }))].map(({ id, start, tentative }) => {
              const r = romanFor(id)
              if (!r) return null
              return (
                <text key={id} x={x(start) + 5} y={RULER_H + CHORD_H + 15}
                  className={`roman ${tentative || r.tentative || analysis.key?.tentative ? 'tentative' : ''}`} data-testid="roman"
                  data-display={r.display}>
                  <title>{[r.roman.text, `（${r.roman.number}）`, ...r.labels, ...r.alternatives.map((a) => `也可读作 ${a}`)].join(' ')}</title>
                  {r.display}
                </text>
              )
            })}
            <line ref={headPlay} y1={0} y2={HEAD_H} className="playhead" />
          </svg>
        </div>
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
              return (
                <rect key={n.id} data-testid="note" data-pitch={n.pitch} data-start={n.startTick}
                  x={x(n.startTick) + 0.5} y={yOf(n.pitch) + 1} width={Math.max(3, x(n.durationTick) - 1)} height={rowH - 2} rx={2}
                  className={`note ${selectedNoteIds.has(n.id) ? 'selected' : ''}`} style={{ opacity: 0.45 + n.velocity / 230 }}
                  onPointerDown={(e) => onNoteDown(e, raw)}>
                  <title>{`${drum ? drumNoteName(n.pitch)?.zh ?? n.pitch : pitchName(n.pitch)}（MIDI ${n.pitch}）· 力度 ${n.velocity}`}</title>
                </rect>
              )
            })}
            {liveTake.map((n, i) => (
              <rect key={`take${i}`} x={x(n.startTick)} y={yOf(n.pitch) + 1} width={Math.max(2, x(n.durationTick))} height={rowH - 2} className="note-take" />
            ))}
            <line ref={bodyPlay} y1={0} y2={bodyH} className="playhead" />
          </svg>
        </div>
      </div>
      {analysisTrack == null && <div className="timeline-note">选中的是鼓轨：鼓不参与音高和弦识别。选择一条音高轨查看和弦建议。</div>}
    </section>
  )
}
