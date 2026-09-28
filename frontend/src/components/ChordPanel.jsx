import { useEffect, useMemo, useState } from 'react'
import { ALL_KEYS, keyLabel, sameKey } from '../music/analysis.js'
import {
  bassOptions, CHORD_TYPES, chordSymbol, chordToneSpellings, chordType, displaySpelling, eventSymbol, makeChord,
  ROOT_SPELLINGS, segmentChords,
} from '../music/chords.js'
import * as P from '../music/project.js'
import { parsePosition, pulse, ticksPerBar } from '../music/time.js'

const STATUS = { clear: '明确匹配', ambiguous: '多种解释', undetermined: '未确定', unsupported: '无法识别', empty: '无音' }
const DEGREE = { 3: '三音', 5: '五音', 7: '七音', 2: '二音', 4: '四音', 6: '六音', 9: '九音', 11: '十一音' }

function posText(tick, ts) {
  const bar = ticksPerBar(ts)
  const b = Math.floor(tick / bar)
  const beat = 1 + (tick - b * bar) / pulse(ts).ticks
  return `${b + 1}.${+beat.toFixed(3)}`
}

function KeySection({ project, analysis, apply, hasEvidence }) {
  const kc = project.keyContext
  const confirmed = kc?.status === 'confirmed'
  const cands = analysis.keyCandidates
  const topScore = cands[0]?.score ?? 0
  const confirm = (key, source) => apply(`确认调性 ${keyLabel(key)}`, (p) => P.setKeyContext(p, {
    tonicPc: key.tonicPc, tonicSpelling: key.tonicSpelling, mode: key.mode, source, status: 'confirmed',
  }))
  let line
  if (confirmed) line = `${keyLabel(kc)}（已确认 · ${kc.source === 'user' ? '手选' : '采纳推测'}）`
  else if (analysis.keyStatus === 'insufficient') line = '证据不足：暂不推测唯一调性（孤立和弦或音符太少）'
  else if (analysis.keyStatus === 'ambiguous') line = `推测：${keyLabel(cands[0])}／${keyLabel(cands[1])}（接近，可纠正）`
  else line = `推测：${keyLabel(cands[0])}（可纠正）`
  return (
    <section className="panel-section" aria-label="调性">
      <h3>调性</h3>
      <p data-testid="key-status">{line}</p>
      <div className="chips">
        {hasEvidence && cands.map((k) => (
          <button key={`${k.tonicPc}${k.mode}`} type="button" aria-pressed={confirmed && sameKey(k, kc)}
            onClick={() => confirm(k, 'inferred')} title="采纳并确认此调性（只改变分析，不移调）">
            {keyLabel(k)}{topScore - k.score < 0.1 && !sameKey(k, cands[0]) ? ' · 接近' : ''}
          </button>
        ))}
      </div>
      <div className="row">
        <select aria-label="手动选择调性" value={confirmed ? `${kc.tonicPc}:${kc.mode}` : ''}
          onChange={(e) => {
            if (!e.target.value) return
            const [pc, mode] = e.target.value.split(':')
            confirm(ALL_KEYS.find((k) => k.tonicPc === Number(pc) && k.mode === mode), 'user')
          }}>
          <option value="">手动选择调性…</option>
          {ALL_KEYS.map((k) => <option key={`${k.tonicPc}:${k.mode}`} value={`${k.tonicPc}:${k.mode}`}>{keyLabel(k)}</option>)}
        </select>
        {confirmed && <button type="button" onClick={() => apply('解除调性确认', (p) => P.setKeyContext(p, null))}>解除确认</button>}
      </div>
    </section>
  )
}

function ChordEditor({ project, initial, excludeId, onWrite, onDelete, onCopy, preview, onCancel, sourceNote }) {
  const ts = project.timeSignature
  const [root, setRoot] = useState(initial.chord?.rootSpelling ?? 'C')
  const [typeId, setTypeId] = useState(initial.chord ? chordType(initial.chord).id : 'maj')
  const [bass, setBass] = useState(initial.chord?.bassSpelling ?? '')
  const [nc, setNc] = useState(initial.kind === 'no_chord')
  const [startText, setStartText] = useState(posText(initial.startTick, ts))
  const [endText, setEndText] = useState(posText(initial.startTick + initial.durationTick, ts))
  const startTick = parsePosition(startText, ts)
  const endTick = parsePosition(endText, ts)
  const rangeOk = startTick != null && endTick != null && endTick > startTick
  const chord = makeChord(root, typeId, bass || null)
  const tones = chordToneSpellings(makeChord(root, typeId))
  const { tones: bassTones, others } = bassOptions(makeChord(root, typeId))
  const conflicts = rangeOk ? P.chordConflicts(project.chordTrack, startTick, endTick, excludeId) : []
  const typeTones = CHORD_TYPES.find((t) => t.id === typeId).tones
  const degreeOf = (s) => typeTones[chordToneSpellings(makeChord(root, typeId)).indexOf(s)]?.[1]
  const event = nc
    ? { kind: 'no_chord', startTick, durationTick: endTick - startTick }
    : { kind: 'chord', chord, startTick, durationTick: endTick - startTick }

  return (
    <div className="chord-editor" data-testid="chord-editor">
      <div className="row">
        <label>起点 <input value={startText} onChange={(e) => setStartText(e.target.value)} aria-label="和弦起点（小节.拍）" size={6} /></label>
        <label>终点 <input value={endText} onChange={(e) => setEndText(e.target.value)} aria-label="和弦终点（小节.拍，不含）" size={6} /></label>
        {!rangeOk && <span className="warn">范围无效</span>}
      </div>
      <fieldset disabled={nc}>
        <legend>根音</legend>
        <div className="root-grid">
          {ROOT_SPELLINGS.map((s) => (
            <button key={s} type="button" aria-pressed={root === s} onClick={() => { setRoot(s); setBass('') }}>{displaySpelling(s)}</button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={nc}>
        <legend>类型</legend>
        <div className="type-grid">
          {CHORD_TYPES.map((t) => (
            <button key={t.id} type="button" aria-pressed={typeId === t.id} onClick={() => { setTypeId(t.id); setBass('') }}
              title={chordToneSpellings(makeChord(root, t.id)).map(displaySpelling).join(' ')}>
              {t.label}<span className="muted"> {displaySpelling(root)}{t.suffix}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="row">
        <label>低音
          <select value={bass} disabled={nc} onChange={(e) => setBass(e.target.value)} aria-label="低音">
            <option value="">原位（根音 {displaySpelling(root)}）</option>
            <optgroup label="转位：和弦内音">
              {bassTones.map((s) => <option key={s} value={s}>{DEGREE[degreeOf(s)] ?? ''} {displaySpelling(s)}</option>)}
            </optgroup>
            <optgroup label="指定斜杠低音">
              {others.map((s) => <option key={s} value={s}>{displaySpelling(s)}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="nc"><input type="checkbox" checked={nc} onChange={(e) => setNc(e.target.checked)} /> N.C.（明确无和弦）</label>
      </div>
      <p className="chord-summary">
        <strong data-testid="editor-symbol">{nc ? 'N.C.' : chordSymbol(chord)}</strong>
        {!nc && <span className="muted"> = {tones.map(displaySpelling).join(' ')}{chord.bassPc != null ? `，低音 ${displaySpelling(chord.bassSpelling)}` : ''}</span>}
      </p>
      {sourceNote}
      {conflicts.length > 0 && (
        <div className="conflicts" role="alert">
          写入将替换：{conflicts.map((c) => `${eventSymbol(c.event)}（${posText(c.event.startTick, ts)}–${posText(c.event.startTick + c.event.durationTick, ts)}，${{ remove: '删除', split: '拆分', 'trim-end': '截短尾部', 'trim-start': '截短开头' }[c.action]}）`).join('；')}
        </div>
      )}
      <div className="row actions">
        <button type="button" disabled={nc} onClick={() => preview(chord)}>试听</button>
        <button type="button" className="primary" disabled={!rangeOk} onClick={() => onWrite(event)}>{excludeId ? '更新' : '写入和弦轨'}</button>
        {onCopy && <button type="button" onClick={onCopy}>复制到后面</button>}
        {onDelete && <button type="button" onClick={onDelete}>删除</button>}
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

export default function ChordPanel({ project, harmony, chordSelection, setChordSelection, staleChords, analysisTrack,
  analysisNotes, apply, writeChord, adoptSuggestion, adoptAllSuggestions, previewChord, defaultRange, say }) {
  const { analysis, suggestions } = harmony
  const ts = project.timeSignature
  const sel = chordSelection
  const selEvent = sel?.type === 'event' ? project.chordTrack.find((e) => e.id === sel.id) : null
  const selSuggestion = sel?.type === 'suggestion' ? suggestions.find((s) => s.key === sel.key) : null
  const [editingSuggestion, setEditingSuggestion] = useState(false)
  useEffect(() => setEditingSuggestion(false), [sel?.key])

  useEffect(() => {
    if (sel?.type === 'event' && !selEvent) setChordSelection(null)
    if (sel?.type === 'suggestion' && !selSuggestion) setChordSelection(null)
  }, [sel, selEvent, selSuggestion, setChordSelection])

  const stale = selEvent ? staleChords.get(selEvent.id) : null
  const reanalysis = useMemo(() => {
    if (!stale || !selEvent || !stale.track) return null
    const end = selEvent.startTick + selEvent.durationTick
    const inRange = P.trackNotes(stale.track).filter((n) => n.startTick < end && n.startTick + n.durationTick > selEvent.startTick)
    const segs = segmentChords(inRange, { key: analysis.key }).filter((s) => s.detection.candidates.length)
      .sort((a, b) => (b.endTick - b.startTick) - (a.endTick - a.startTick))
    return { segment: segs[0] ?? null, signature: stale.currentSignature, noteIds: inRange.map((n) => n.id) }
  }, [stale, selEvent, analysis.key])

  const suggestionCount = suggestions.filter((s) => s.detection.candidates.length).length
  const entry = selEvent ? analysis.chords[selEvent.id] : selSuggestion ? analysis.chords[`sugg:${selSuggestion.key}`] : null

  let body
  if (selSuggestion && !editingSuggestion) {
    const d = selSuggestion.detection
    body = (
      <div className="suggestion-box" data-testid="suggestion-box">
        <p><strong>{selSuggestion.label ?? '未识别'}</strong> · {STATUS[d.status]} · {posText(selSuggestion.startTick, ts)}–{posText(selSuggestion.endTick, ts)}
          <span className="muted">（识别建议，未确认前不进入生成控制）</span></p>
        {d.reason && <p className="warn">{d.reason}</p>}
        {entry && <p className="muted">级数：{entry.display} {entry.labels.join('；')}</p>}
        <ul className="candidates">
          {d.candidates.map((c) => (
            <li key={chordSymbol(c.chord)}>
              <span>{chordSymbol(c.chord)}{c.complete ? '' : '（省略五音）'}</span>
              <button type="button" onClick={() => previewChord(c.chord)}>试听</button>
              <button type="button" className="primary" onClick={() => adoptSuggestion(selSuggestion, c)}>采用</button>
            </li>
          ))}
        </ul>
        <div className="row actions">
          <button type="button" onClick={() => setEditingSuggestion(true)}>手动修改…</button>
          <button type="button" onClick={() => setChordSelection(null)}>关闭</button>
        </div>
      </div>
    )
  } else if (sel) {
    const initial = selEvent ?? (selSuggestion ? {
      startTick: selSuggestion.startTick, durationTick: selSuggestion.endTick - selSuggestion.startTick, kind: 'chord',
      chord: selSuggestion.detection.candidates[0]?.chord,
    } : { startTick: sel.startTick, durationTick: sel.endTick - sel.startTick, kind: 'chord' })
    const sourceNote = selEvent && (
      <div className="source-note">
        <span className="muted">来源：{selEvent.source === 'manual' ? '手选' : selEvent.source === 'midi_detected' ? 'MIDI 识别后确认' : selEvent.source} · 已确认，自动分析不会覆盖</span>
        {entry && <div>级数：<strong>{entry.display}</strong>{entry.alternatives.length ? `（也可读作 ${entry.alternatives.join('、')}）` : ''} {entry.labels.join('；')}</div>}
        {stale && (
          <div className="stale-box" role="alert" data-testid="stale-box">
            ⚠ 输入已变化，可重新分析。
            {reanalysis?.segment
              ? <> 当前识别：<strong>{reanalysis.segment.label}</strong>（{STATUS[reanalysis.segment.detection.status]}）</>
              : ' 此范围现在没有可识别的和弦。'}
            <div className="row">
              {reanalysis?.segment && (
                <button type="button" onClick={() => apply(`用新识别替换为 ${reanalysis.segment.label}`, (p) => P.updateChord(p, selEvent.id, {
                  kind: 'chord', chord: reanalysis.segment.detection.candidates[0].chord, source: 'midi_detected',
                  sourceSignature: reanalysis.signature, sourceNoteIds: reanalysis.noteIds,
                }))}>用新识别替换</button>
              )}
              <button type="button" onClick={() => apply('保留已确认和弦', (p) => P.updateChord(p, selEvent.id, { sourceSignature: reanalysis?.signature ?? null }))}>
                保留原和弦（标记已查看）</button>
            </div>
          </div>
        )}
      </div>
    )
    body = (
      <ChordEditor key={selEvent?.id ?? `${sel.type}:${sel.key ?? ''}:${sel.startTick}:${sel.endTick}`} project={project} initial={initial}
        excludeId={selEvent?.id ?? null} sourceNote={sourceNote} preview={previewChord}
        onCancel={() => setChordSelection(null)}
        onWrite={(event) => {
          if (selEvent) {
            apply(`修改和弦为 ${eventSymbol(event)}`, (p) => P.updateChord(p, selEvent.id, { ...event, source: 'manual', status: 'confirmed' }))
          } else {
            writeChord({ ...event, source: 'manual' }, `手选和弦 ${eventSymbol(event)}`)
            setChordSelection(null)
          }
        }}
        onDelete={selEvent ? () => { apply(`删除和弦 ${eventSymbol(selEvent)}`, (p) => P.deleteChord(p, selEvent.id)); setChordSelection(null) } : null}
        onCopy={selEvent ? () => {
          const at = selEvent.startTick + selEvent.durationTick
          const conflicts = P.chordConflicts(project.chordTrack, at, at + selEvent.durationTick)
          apply(`复制和弦 ${eventSymbol(selEvent)}`, (p) => P.copyChord(p, selEvent.id, at))
          if (conflicts.length) say(`复制时替换了：${conflicts.map((c) => eventSymbol(c.event)).join('、')}（可撤销）`)
        } : null}
      />
    )
  } else {
    body = (
      <div className="muted">
        <p>点和弦行里的虚线建议可采用；点已确认和弦可修改；在和弦行空白处拖动选择范围后手选根音＋类型。</p>
        <div className="row actions">
          <button type="button" onClick={adoptAllSuggestions} disabled={!suggestionCount}>采用全部建议（{suggestionCount}）</button>
          <button type="button" onClick={() => setChordSelection({ type: 'range', ...defaultRange() })}>手选和弦（当前小节）</button>
        </div>
      </div>
    )
  }

  return (
    <aside className="chord-panel" aria-label="和弦与调性">
      <KeySection project={project} analysis={analysis} apply={apply}
        hasEvidence={project.tracks.some((t) => !t.isDrum && P.mainClip(t).notes.length) || project.chordTrack.some((e) => e.chord)} />
      <section className="panel-section" aria-label="和弦">
        <h3>和弦 {analysisTrack ? <span className="muted">· 识别自「{analysisTrack.name}」</span> : <span className="muted">· 选中鼓轨时不识别</span>}</h3>
        {body}
      </section>
      <section className="panel-section" aria-label="进行分析">
        <h3>级数与进行 <span className="muted">· 分析 v{analysis.analysisVersion} · 输入 r{analysis.inputRevision}</span></h3>
        {!analysis.key && <p className="muted">调性证据不足时不给级数；可在上方手选调性。</p>}
        <ul className="progressions" data-testid="progressions">
          {analysis.progressions.map((p, i) => (
            <li key={i}><strong>{p.text}</strong> <span className="tag">{p.name}</span>
              <div className="muted">{posText(p.startTick, ts)}–{posText(p.endTick, ts)} · {p.detail}</div></li>
          ))}
          {analysis.modulationHints.map((h, i) => (
            <li key={`m${i}`} className="warn">{h.label} · {posText(h.startTick, ts)}–{posText(h.endTick, ts)}</li>
          ))}
        </ul>
        {staleChords.size > 0 && (
          <p className="warn">{staleChords.size} 个已确认和弦的来源音符已变化：
            {[...staleChords.keys()].map((id) => {
              const e = project.chordTrack.find((c) => c.id === id)
              return <button key={id} type="button" onClick={() => setChordSelection({ type: 'event', id })}>{eventSymbol(e)} 重新分析</button>
            })}
          </p>
        )}
        {analysisTrack && !analysisNotes.length && <p className="muted">「{analysisTrack.name}」还没有音符。</p>}
      </section>
    </aside>
  )
}
