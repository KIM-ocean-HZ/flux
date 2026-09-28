import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/I18n.jsx'
import { m } from '../i18n/translate.js'
import { ALL_KEYS, keyLabel, sameKey } from '../music/analysis.js'
import {
  bassOptions, CHORD_TYPES, chordSymbol, chordToneSpellings, chordType, displaySpelling, eventSymbol, makeChord,
  ROOT_SPELLINGS, segmentChords,
} from '../music/chords.js'
import * as P from '../music/project.js'
import { parsePosition, pulse, ticksPerBar } from '../music/time.js'

function posText(tick, ts) {
  const bar = ticksPerBar(ts)
  const b = Math.floor(tick / bar)
  const beat = 1 + (tick - b * bar) / pulse(ts).ticks
  return `${b + 1}.${+beat.toFixed(3)}`
}

function KeySection({ project, analysis, apply, hasEvidence }) {
  const { t } = useI18n()
  const kc = project.keyContext
  const confirmed = kc?.status === 'confirmed'
  const cands = analysis.keyCandidates
  const topScore = cands[0]?.score ?? 0
  const confirm = (key, source) => apply(m('label.confirmKey', { key: keyLabel(key) }), (p) => P.setKeyContext(p, {
    tonicPc: key.tonicPc, tonicSpelling: key.tonicSpelling, mode: key.mode, source, status: 'confirmed',
  }))
  let line
  if (confirmed) line = t('key.confirmedLine', { key: keyLabel(kc), how: m(kc.source === 'user' ? 'key.byHand' : 'key.adopted') })
  else if (analysis.keyStatus === 'insufficient') line = t('key.insufficient')
  else if (analysis.keyStatus === 'ambiguous') line = t('key.inferredClose', { a: keyLabel(cands[0]), b: keyLabel(cands[1]) })
  else line = t('key.inferred', { key: keyLabel(cands[0]) })
  return (
    <section className="panel-section" aria-label={t('key.title')}>
      <h3>{t('key.title')}</h3>
      <p data-testid="key-status">{line}</p>
      <div className="chips">
        {hasEvidence && cands.map((k) => (
          <button key={`${k.tonicPc}${k.mode}`} type="button" aria-pressed={confirmed && sameKey(k, kc)}
            onClick={() => confirm(k, 'inferred')} title={t('key.adoptTitle')}>
            {t(keyLabel(k))}{topScore - k.score < 0.1 && !sameKey(k, cands[0]) ? t('key.closeSuffix') : ''}
          </button>
        ))}
      </div>
      <div className="row">
        <select aria-label={t('key.manualAria')} value={confirmed ? `${kc.tonicPc}:${kc.mode}` : ''}
          onChange={(e) => {
            if (!e.target.value) return
            const [pc, mode] = e.target.value.split(':')
            confirm(ALL_KEYS.find((k) => k.tonicPc === Number(pc) && k.mode === mode), 'user')
          }}>
          <option value="">{t('key.manualPlaceholder')}</option>
          {ALL_KEYS.map((k) => <option key={`${k.tonicPc}:${k.mode}`} value={`${k.tonicPc}:${k.mode}`}>{t(keyLabel(k))}</option>)}
        </select>
        {confirmed && <button type="button" onClick={() => apply(m('label.unconfirmKey'), (p) => P.setKeyContext(p, null))}>{t('key.unconfirm')}</button>}
      </div>
    </section>
  )
}

function ChordEditor({ project, initial, excludeId, onWrite, onDelete, onCopy, preview, onCancel, sourceNote }) {
  const { t } = useI18n()
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
  const typeTones = CHORD_TYPES.find((ct) => ct.id === typeId).tones
  const degreeOf = (s) => typeTones[chordToneSpellings(makeChord(root, typeId)).indexOf(s)]?.[1]
  const event = nc
    ? { kind: 'no_chord', startTick, durationTick: endTick - startTick }
    : { kind: 'chord', chord, startTick, durationTick: endTick - startTick }

  return (
    <div className="chord-editor" data-testid="chord-editor">
      <div className="row">
        <label>{t('editor.start')} <input value={startText} onChange={(e) => setStartText(e.target.value)} aria-label={t('editor.startAria')} size={6} /></label>
        <label>{t('editor.end')} <input value={endText} onChange={(e) => setEndText(e.target.value)} aria-label={t('editor.endAria')} size={6} /></label>
        {!rangeOk && <span className="warn">{t('editor.badRange')}</span>}
      </div>
      <fieldset disabled={nc}>
        <legend>{t('editor.root')}</legend>
        <div className="root-grid">
          {ROOT_SPELLINGS.map((s) => (
            <button key={s} type="button" aria-pressed={root === s} onClick={() => { setRoot(s); setBass('') }}>{displaySpelling(s)}</button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={nc}>
        <legend>{t('editor.type')}</legend>
        <div className="type-grid">
          {CHORD_TYPES.map((ct) => (
            <button key={ct.id} type="button" aria-pressed={typeId === ct.id} onClick={() => { setTypeId(ct.id); setBass('') }}
              title={chordToneSpellings(makeChord(root, ct.id)).map(displaySpelling).join(' ')}>
              {t(`chordType.${ct.id}`)}<span className="muted"> {displaySpelling(root)}{ct.suffix}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="row">
        <label>{t('editor.bass')}
          <select value={bass} disabled={nc} onChange={(e) => setBass(e.target.value)} aria-label={t('editor.bass')}>
            <option value="">{t('editor.rootPosition', { root: displaySpelling(root) })}</option>
            <optgroup label={t('editor.inversions')}>
              {bassTones.map((s) => <option key={s} value={s}>{t(`degree.${degreeOf(s)}`)} {displaySpelling(s)}</option>)}
            </optgroup>
            <optgroup label={t('editor.slashBass')}>
              {others.map((s) => <option key={s} value={s}>{displaySpelling(s)}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="nc"><input type="checkbox" checked={nc} onChange={(e) => setNc(e.target.checked)} /> {t('editor.nc')}</label>
      </div>
      <p className="chord-summary">
        <strong data-testid="editor-symbol">{nc ? 'N.C.' : chordSymbol(chord)}</strong>
        {!nc && <span className="muted"> = {tones.map(displaySpelling).join(' ')}{chord.bassPc != null ? t('editor.bassSuffix', { bass: displaySpelling(chord.bassSpelling) }) : ''}</span>}
      </p>
      {sourceNote}
      {conflicts.length > 0 && (
        <div className="conflicts" role="alert">
          {t('editor.willReplace')}{conflicts.map((c) => t('editor.conflict', {
            symbol: eventSymbol(c.event), start: posText(c.event.startTick, ts), end: posText(c.event.startTick + c.event.durationTick, ts),
            action: m(`editor.action.${c.action}`),
          })).join(t('sep.clause'))}
        </div>
      )}
      <div className="row actions">
        <button type="button" disabled={nc} onClick={() => preview(chord)}>{t('chord.preview')}</button>
        <button type="button" className="primary" disabled={!rangeOk} onClick={() => onWrite(event)}>{excludeId ? t('editor.update') : t('editor.write')}</button>
        {onCopy && <button type="button" onClick={onCopy}>{t('editor.copyAfter')}</button>}
        {onDelete && <button type="button" onClick={onDelete}>{t('editor.delete')}</button>}
        <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}

export default function ChordPanel({ project, harmony, chordSelection, setChordSelection, staleChords, analysisTrack,
  analysisNotes, apply, writeChord, adoptSuggestion, adoptAllSuggestions, previewChord, defaultRange, chordsToTrack, say }) {
  const { t } = useI18n()
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
  const status = (s) => t(`detect.status.${s}`)
  const list = (items) => items.join(t('sep.list'))
  // Range for "chord track → MIDI": a range selection, or the selected chord event.
  const range = sel?.type === 'range' ? sel
    : selEvent ? { startTick: selEvent.startTick, endTick: selEvent.startTick + selEvent.durationTick } : null

  let body
  if (selSuggestion && !editingSuggestion) {
    const d = selSuggestion.detection
    body = (
      <div className="suggestion-box" data-testid="suggestion-box">
        <p><strong>{selSuggestion.label ?? t('chord.unrecognised')}</strong> · {status(d.status)} · {posText(selSuggestion.startTick, ts)}–{posText(selSuggestion.endTick, ts)}
          <span className="muted">{t('chord.suggestionNote')}</span></p>
        {d.reason && <p className="warn">{t(d.reason)}</p>}
        {entry && <p className="muted">{t('chord.numeral')}{entry.display} {entry.labels.map((l) => t(l)).join(t('sep.clause'))}</p>}
        <ul className="candidates">
          {d.candidates.map((c) => (
            <li key={chordSymbol(c.chord)}>
              <span>{chordSymbol(c.chord)}{c.complete ? '' : t('chord.no5')}</span>
              <button type="button" onClick={() => previewChord(c.chord)}>{t('chord.preview')}</button>
              <button type="button" className="primary" onClick={() => adoptSuggestion(selSuggestion, c)}>{t('chord.adopt')}</button>
            </li>
          ))}
        </ul>
        <div className="row actions">
          <button type="button" onClick={() => setEditingSuggestion(true)}>{t('chord.editManually')}</button>
          <button type="button" onClick={() => setChordSelection(null)}>{t('common.close')}</button>
        </div>
      </div>
    )
  } else if (sel) {
    const initial = selEvent ?? (selSuggestion ? {
      startTick: selSuggestion.startTick, durationTick: selSuggestion.endTick - selSuggestion.startTick, kind: 'chord',
      chord: selSuggestion.detection.candidates[0]?.chord,
    } : { startTick: sel.startTick, durationTick: sel.endTick - sel.startTick, kind: 'chord' })
    const source = selEvent && (selEvent.source === 'manual' ? t('chord.source.manual') : selEvent.source === 'midi_detected' ? t('chord.source.detected') : selEvent.source)
    const sourceNote = selEvent && (
      <div className="source-note">
        <span className="muted">{t('chord.sourceLine', { source })}</span>
        {entry && <div>{t('chord.numeral')}<strong>{entry.display}</strong>{entry.alternatives.length ? t('chord.alsoReadsList', { list: list(entry.alternatives) }) : ''} {entry.labels.map((l) => t(l)).join(t('sep.clause'))}</div>}
        {stale && (
          <div className="stale-box" role="alert" data-testid="stale-box">
            {t('chord.staleHead')}
            {reanalysis?.segment
              ? <> {t('chord.nowDetected')}<strong>{reanalysis.segment.label}</strong>{t('chord.statusParen', { status: m(`detect.status.${reanalysis.segment.detection.status}`) })}</>
              : t('chord.nothingNow')}
            <div className="row">
              {reanalysis?.segment && (
                <button type="button" onClick={() => apply(m('label.replaceWithDetection', { symbol: reanalysis.segment.label }), (p) => P.updateChord(p, selEvent.id, {
                  kind: 'chord', chord: reanalysis.segment.detection.candidates[0].chord, source: 'midi_detected',
                  sourceSignature: reanalysis.signature, sourceNoteIds: reanalysis.noteIds,
                }))}>{t('chord.replaceWithDetection')}</button>
              )}
              <button type="button" onClick={() => apply(m('label.keepChord'), (p) => P.updateChord(p, selEvent.id, { sourceSignature: reanalysis?.signature ?? null }))}>
                {t('chord.keepChord')}</button>
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
            apply(m('label.changeChord', { symbol: eventSymbol(event) }), (p) => P.updateChord(p, selEvent.id, { ...event, source: 'manual', status: 'confirmed' }))
          } else {
            writeChord({ ...event, source: 'manual' }, m('label.manualChord', { symbol: eventSymbol(event) }))
            setChordSelection(null)
          }
        }}
        onDelete={selEvent ? () => { apply(m('label.deleteChordSymbol', { symbol: eventSymbol(selEvent) }), (p) => P.deleteChord(p, selEvent.id)); setChordSelection(null) } : null}
        onCopy={selEvent ? () => {
          const at = selEvent.startTick + selEvent.durationTick
          const conflicts = P.chordConflicts(project.chordTrack, at, at + selEvent.durationTick)
          apply(m('label.copyChord', { symbol: eventSymbol(selEvent) }), (p) => P.copyChord(p, selEvent.id, at))
          if (conflicts.length) say(m('notice.copyReplaced', { list: list(conflicts.map((c) => eventSymbol(c.event))) }))
        } : null}
      />
    )
  } else {
    body = (
      <div className="muted">
        <p>{t('chord.help')}</p>
        <div className="row actions">
          <button type="button" onClick={adoptAllSuggestions} disabled={!suggestionCount}>{t('chord.adoptAll', { n: suggestionCount })}</button>
          <button type="button" onClick={() => setChordSelection({ type: 'range', ...defaultRange() })}>{t('chord.manualThisBar')}</button>
        </div>
      </div>
    )
  }

  return (
    <aside className="chord-panel" aria-label={t('chordPanel.label')}>
      <KeySection project={project} analysis={analysis} apply={apply}
        hasEvidence={project.tracks.some((tr) => !tr.isDrum && P.mainClip(tr).notes.length) || project.chordTrack.some((e) => e.chord)} />
      <section className="panel-section" aria-label={t('chord.title')}>
        <h3>{t('chord.title')} {analysisTrack
          ? <span className="muted">{t('chord.detectedFrom', { name: analysisTrack.name })}</span>
          : <span className="muted">{t('chord.drumSelected')}</span>}</h3>
        {body}
        <div className="row">
          <button type="button" onClick={() => chordsToTrack(range)} title={t('chord.toMidiTitle')} data-testid="chords-to-midi">
            {range ? t('chord.toMidiRange', { start: posText(range.startTick, ts), end: posText(range.endTick, ts) }) : t('chord.toMidiAll')}
          </button>
        </div>
      </section>
      <section className="panel-section" aria-label={t('progression.title')}>
        <h3>{t('progression.title')} <span className="muted">{t('progression.version', { version: analysis.analysisVersion, revision: analysis.inputRevision })}</span></h3>
        {!analysis.key && <p className="muted">{t('progression.noKey')}</p>}
        <ul className="progressions" data-testid="progressions">
          {analysis.runs.map((r, i) => (
            <li key={`r${i}`} data-testid="progression-run"><strong>{r.text}</strong> <span className="tag">{t('progression.whole')}</span>
              <div className="muted">{posText(r.startTick, ts)}–{posText(r.endTick, ts)} · {r.numbers}
                {analysis.key?.tentative ? t('progression.inKeyInferred', { key: keyLabel(analysis.key) }) : t('progression.inKey', { key: keyLabel(analysis.key) })}</div></li>
          ))}
          {analysis.progressions.map((p, i) => (
            <li key={i}><strong>{p.text}</strong> <span className="tag">{t(p.name)}</span>
              <div className="muted">{posText(p.startTick, ts)}–{posText(p.endTick, ts)} · {t(p.detail)}</div></li>
          ))}
          {analysis.modulationHints.map((h, i) => (
            <li key={`m${i}`} className="warn">{t(h.label)} · {posText(h.startTick, ts)}–{posText(h.endTick, ts)}</li>
          ))}
        </ul>
        {analysis.runs.length > 0 && !analysis.progressions.length && <p className="muted" data-testid="no-named-progression">{t('progression.noNamed')}</p>}
        {staleChords.size > 0 && (
          <p className="warn">{t('progression.staleCount', { n: staleChords.size })}
            {[...staleChords.keys()].map((id) => {
              const e = project.chordTrack.find((c) => c.id === id)
              return <button key={id} type="button" onClick={() => setChordSelection({ type: 'event', id })}>{t('progression.reanalyse', { symbol: eventSymbol(e) })}</button>
            })}
          </p>
        )}
        {analysisTrack && !analysisNotes.length && <p className="muted">{t('progression.noNotes', { name: analysisTrack.name })}</p>}
      </section>
    </aside>
  )
}
