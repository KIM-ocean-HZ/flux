import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18n.jsx'
import { m } from '../i18n/translate.js'
import * as P from '../music/project.js'
import {
  BPM_MAX, BPM_MIN, countInPulses, formatPosition, isValidBpm, TS_DENOMINATORS, TS_NUMERATORS, TS_PRESETS, ticksPerBar,
} from '../music/time.js'

export default function Transport({ project, transport, engine, playhead, onPlay, onPause, onStop, onToStart, onRecord,
  canRecord, metronome, setMetronome, countIn, setCountIn, apply, monitor, say }) {
  const { t } = useI18n()
  const posRef = useRef(null)
  const meterRef = useRef(null)
  const [bpmText, setBpmText] = useState(String(project.quarterBpm))
  const locked = transport === 'recording'
  const ts = project.timeSignature
  const bar = ticksPerBar(ts)
  const loop = project.loopRange

  useEffect(() => setBpmText(String(Math.round(project.quarterBpm * 100) / 100)), [project.quarterBpm])

  // Position text and level meter follow the audio clock without React re-renders.
  useEffect(() => {
    let raf
    const frame = () => {
      const tick = engine.positionTick()
      if (posRef.current) {
        posRef.current.textContent = tick == null ? formatPosition(playhead, ts)
          : engine.countingIn() ? t('transport.countIn', { n: countInPulses(tick - (engine.transport?.fromTick ?? 0), ts) })
            : formatPosition(Math.max(0, tick), ts)
      }
      if (meterRef.current) meterRef.current.style.width = `${Math.min(100, engine.level() * 400)}%`
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [engine, playhead, ts, t])

  const commitBpm = () => {
    const bpm = Number(bpmText)
    if (!isValidBpm(bpm)) {
      say(m('notice.bpmRange', { min: BPM_MIN, max: BPM_MAX }), 'warn')
      setBpmText(String(project.quarterBpm))
      return
    }
    if (bpm !== project.quarterBpm) apply(m('label.tempo', { bpm }), (p) => P.setTempo(p, bpm))
  }
  const setTs = (next) => {
    if (next.numerator === ts.numerator && next.denominator === ts.denominator) return
    apply(m('label.meter', { ts: `${next.numerator}/${next.denominator}` }), (p) => P.setTimeSignature(p, next))
    say(m('notice.meterKeepsTicks'))
  }
  const setLoop = (patch) => monitor((p) => ({ ...p, loopRange: { ...p.loopRange, ...patch } }))

  return (
    <div className="transport" role="toolbar" aria-label={t('transport.label')}>
      <div className="group">
        <button type="button" onClick={onToStart} title={t('transport.toStart')} aria-label={t('transport.toStart')} disabled={locked}>⏮</button>
        {transport === 'playing'
          ? <button type="button" onClick={onPause} aria-label={t('transport.pause')} title={t('transport.pauseTitle')}>⏸</button>
          : <button type="button" onClick={onPlay} aria-label={t('transport.play')} title={t('transport.playTitle')} disabled={locked}>▶</button>}
        <button type="button" onClick={onStop} aria-label={t('transport.stop')} title={t('transport.stopTitle')}>■</button>
        <button type="button" className={`record ${locked ? 'active' : ''}`} onClick={locked ? onStop : onRecord}
          aria-pressed={locked} aria-label={t('transport.record')} disabled={!canRecord && !locked}
          title={canRecord ? t('transport.recordTitle') : t('notice.armFirst')}>● {t('transport.record')}</button>
      </div>
      <div className="position" aria-live="off"><span ref={posRef} data-testid="position">1.1.1</span></div>
      <label className="field">♩ =
        <input type="number" min={BPM_MIN} max={BPM_MAX} step="1" value={bpmText} disabled={locked} aria-label={t('transport.bpmAria')}
          onChange={(e) => setBpmText(e.target.value)} onBlur={commitBpm}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      </label>
      <div className="field ts" aria-label={t('transport.meter')}>
        <select value={ts.numerator} disabled={locked} aria-label={t('transport.numerator')} onChange={(e) => setTs({ ...ts, numerator: Number(e.target.value) })}>
          {TS_NUMERATORS.map((n) => <option key={n}>{n}</option>)}
        </select>
        /
        <select value={ts.denominator} disabled={locked} aria-label={t('transport.denominator')} onChange={(e) => setTs({ ...ts, denominator: Number(e.target.value) })}>
          {TS_DENOMINATORS.map((d) => <option key={d}>{d}</option>)}
        </select>
        {TS_PRESETS.map((pr) => (
          <button key={`${pr.numerator}/${pr.denominator}`} type="button" disabled={locked}
            aria-pressed={pr.numerator === ts.numerator && pr.denominator === ts.denominator}
            onClick={() => setTs(pr)}>{pr.numerator}/{pr.denominator}</button>
        ))}
      </div>
      <div className="group">
        <button type="button" aria-pressed={loop.enabled} onClick={() => setLoop({ enabled: !loop.enabled })}
          title={t('transport.loopTitle')}>{t('transport.loop')}</button>
        <label className="field small">
          <input type="number" min="1" value={+(loop.startTick / bar + 1).toFixed(2)} aria-label={t('transport.loopStart')}
            onChange={(e) => {
              const start = (Math.max(1, Math.round(Number(e.target.value))) - 1) * bar
              if (start < loop.endTick) setLoop({ startTick: start })
            }} />–
          <input type="number" min="2" value={+(loop.endTick / bar + 1).toFixed(2)} aria-label={t('transport.loopEnd')}
            onChange={(e) => {
              const end = (Math.max(2, Math.round(Number(e.target.value))) - 1) * bar
              if (end > loop.startTick) setLoop({ endTick: end })
            }} />
        </label>
        <button type="button" aria-pressed={metronome} onClick={() => setMetronome(!metronome)}>{t('transport.metronome')}</button>
        <button type="button" aria-pressed={countIn} onClick={() => setCountIn(!countIn)} title={t('transport.countInTitle')}>{t('transport.countInButton')}</button>
      </div>
      <div className="meter" title={t('transport.meterTitle')}><div ref={meterRef} /></div>
    </div>
  )
}
