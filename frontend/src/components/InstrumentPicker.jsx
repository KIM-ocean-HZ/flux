import { useEffect, useMemo, useRef, useState } from 'react'
import { DRUM_KIT, drumKitMatches, GM_FAMILIES, INSTRUMENT_PRESETS, searchPrograms } from '../music/gm.js'

const AUDITION = [60, 64, 67]
const DRUM_AUDITION = [36, 38, 42]

export default function InstrumentPicker({ track, engine, onChoose, onClose }) {
  const ref = useRef(null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const d = ref.current
    d.showModal()
    return () => d.open && d.close()
  }, [])
  const results = useMemo(() => searchPrograms(query), [query])
  const current = (inst) => inst.isDrum === track.isDrum && (inst.isDrum || inst.program === track.program)
  const missing = (inst) => engine.coverage && (inst.isDrum ? !engine.coverage.drumKit : !engine.coverage.melodic.has(inst.program))
  const audition = (inst) => engine.preview(inst.isDrum ? DRUM_AUDITION : AUDITION, inst, 0.8)

  const Row = ({ inst, label, sub }) => (
    <li className={current(inst) ? 'current' : ''}>
      <button type="button" className="choose" onClick={() => onChoose(inst)} aria-pressed={current(inst)}>
        <span>{label}</span><span className="muted">{sub}</span>
        {missing(inst) && <span className="warn"> ⚠ 当前音源缺此音色</span>}
      </button>
      <button type="button" className="audition" onClick={() => audition(inst)} disabled={!engine.ready}
        aria-label={`试听 ${label}`} title={engine.ready ? '短试听（不改项目）' : '先启用声音'}>▶</button>
    </li>
  )

  return (
    <dialog ref={ref} className="picker" onClose={onClose} onCancel={onClose} aria-label="选择音色">
      <div className="picker-head">
        <strong>「{track.name}」音色</strong>
        <input type="search" autoFocus placeholder="搜索：钢琴 / bass / 34 / 铺底…" aria-label="搜索音色"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" onClick={onClose}>关闭</button>
      </div>
      {!query && (
        <section>
          <h4>常用</h4>
          <ul className="preset-row">
            {INSTRUMENT_PRESETS.map((p) => <Row key={p.label} inst={p} label={p.label}
              sub={p.isDrum ? 'Drums' : `#${p.program + 1}`} />)}
          </ul>
        </section>
      )}
      <section className="catalog">
        <h4>全部 MIDI 乐器（GM 128 + 鼓组）{query && ` · ${results.length} 个结果`}</h4>
        {GM_FAMILIES.map((f) => {
          const items = results.filter((p) => p.family === f)
          if (!items.length) return null
          return (
            <div key={f.index} className="family">
              <h5>{f.zh} · {f.en}</h5>
              <ul>
                {items.map((p) => <Row key={p.program} inst={{ program: p.program, isDrum: false }}
                  label={`${p.display}. ${p.zh}`} sub={p.en} />)}
              </ul>
            </div>
          )
        })}
        {drumKitMatches(query) && (
          <div className="family">
            <h5>鼓组 · Drums（独立 isDrum，导出到第 10 通道）</h5>
            <ul><Row inst={{ program: DRUM_KIT.program, isDrum: true }} label={DRUM_KIT.zh} sub={DRUM_KIT.en} /></ul>
          </div>
        )}
      </section>
    </dialog>
  )
}
