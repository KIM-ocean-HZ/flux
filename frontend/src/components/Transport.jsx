import { useEffect, useRef, useState } from 'react'
import * as P from '../music/project.js'
import { BPM_MAX, BPM_MIN, formatPosition, isValidBpm, TS_DENOMINATORS, TS_NUMERATORS, TS_PRESETS, ticksPerBar } from '../music/time.js'

export default function Transport({ project, transport, engine, playhead, onPlay, onPause, onStop, onToStart, onRecord,
  canRecord, metronome, setMetronome, countIn, setCountIn, apply, monitor, say }) {
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
          : engine.countingIn() ? formatPosition(tick - (engine.transport?.fromTick ?? 0), ts) : formatPosition(Math.max(0, tick), ts)
      }
      if (meterRef.current) meterRef.current.style.width = `${Math.min(100, engine.level() * 400)}%`
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [engine, playhead, ts])

  const commitBpm = () => {
    const bpm = Number(bpmText)
    if (!isValidBpm(bpm)) {
      say(`速度须在 ${BPM_MIN}–${BPM_MAX} 之间`, 'warn')
      setBpmText(String(project.quarterBpm))
      return
    }
    if (bpm !== project.quarterBpm) apply(`速度 ${bpm}`, (p) => P.setTempo(p, bpm))
  }
  const setTs = (next) => {
    if (next.numerator === ts.numerator && next.denominator === ts.denominator) return
    apply(`拍号 ${next.numerator}/${next.denominator}`, (p) => P.setTimeSignature(p, next))
    say('已有音符与和弦的 tick 位置保持不变，小节线按新拍号重新计算')
  }
  const setLoop = (patch) => monitor((p) => ({ ...p, loopRange: { ...p.loopRange, ...patch } }))

  return (
    <div className="transport" role="toolbar" aria-label="运输控制">
      <div className="group">
        <button type="button" onClick={onToStart} title="回到开头" aria-label="回到开头" disabled={locked}>⏮</button>
        {transport === 'playing'
          ? <button type="button" onClick={onPause} aria-label="暂停" title="暂停（停在当前位置）">⏸</button>
          : <button type="button" onClick={onPlay} aria-label="播放" title="播放" disabled={locked}>▶</button>}
        <button type="button" onClick={onStop} aria-label="停止" title="停止并回到起播点">■</button>
        <button type="button" className={`record ${locked ? 'active' : ''}`} onClick={locked ? onStop : onRecord}
          aria-pressed={locked} aria-label="录音" disabled={!canRecord && !locked}
          title={canRecord ? '录音到已准备（R）的轨道；一小节倒数可关' : '先点某条轨道的 R 准备录音'}>● 录音</button>
      </div>
      <div className="position" aria-live="off"><span ref={posRef} data-testid="position">1.1.1</span></div>
      <label className="field">♩ =
        <input type="number" min={BPM_MIN} max={BPM_MAX} step="1" value={bpmText} disabled={locked} aria-label="速度（四分音符 BPM）"
          onChange={(e) => setBpmText(e.target.value)} onBlur={commitBpm}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      </label>
      <div className="field ts" aria-label="拍号">
        <select value={ts.numerator} disabled={locked} aria-label="拍号分子" onChange={(e) => setTs({ ...ts, numerator: Number(e.target.value) })}>
          {TS_NUMERATORS.map((n) => <option key={n}>{n}</option>)}
        </select>
        /
        <select value={ts.denominator} disabled={locked} aria-label="拍号分母" onChange={(e) => setTs({ ...ts, denominator: Number(e.target.value) })}>
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
          title="范围循环；在时间尺上拖动可设置范围。录音到循环尾自动停止。">循环</button>
        <label className="field small">
          <input type="number" min="1" value={+(loop.startTick / bar + 1).toFixed(2)} aria-label="循环起点小节"
            onChange={(e) => {
              const start = (Math.max(1, Math.round(Number(e.target.value))) - 1) * bar
              if (start < loop.endTick) setLoop({ startTick: start })
            }} />–
          <input type="number" min="2" value={+(loop.endTick / bar + 1).toFixed(2)} aria-label="循环终点小节（不含）"
            onChange={(e) => {
              const end = (Math.max(2, Math.round(Number(e.target.value))) - 1) * bar
              if (end > loop.startTick) setLoop({ endTick: end })
            }} />
        </label>
        <button type="button" aria-pressed={metronome} onClick={() => setMetronome(!metronome)}>节拍器</button>
        <button type="button" aria-pressed={countIn} onClick={() => setCountIn(!countIn)} title="录音前一小节倒数">倒数</button>
      </div>
      <div className="meter" title="输出电平（来自音频图，不代表耳机／扬声器实际发声）"><div ref={meterRef} /></div>
    </div>
  )
}
