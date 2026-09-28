import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18n.jsx'
import { DRUM_KIT, drumKitMatches, GM_FAMILIES, INSTRUMENT_PRESETS, searchPrograms } from '../music/gm.js'

const AUDITION = [60, 64, 67]
const DRUM_AUDITION = [36, 38, 42]

export default function InstrumentPicker({ track, engine, onChoose, onClose }) {
  const { t, lang } = useI18n()
  const zh = lang === 'zh'
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
        {missing(inst) && <span className="warn"> ⚠ {t('picker.missing')}</span>}
      </button>
      <button type="button" className="audition" onClick={() => audition(inst)} disabled={!engine.ready}
        aria-label={t('picker.audition', { label })} title={engine.ready ? t('picker.auditionTitle') : t('picker.enableFirst')}>▶</button>
    </li>
  )

  return (
    <dialog ref={ref} className="picker" onClose={onClose} onCancel={onClose} aria-label={t('picker.label')}>
      <div className="picker-head">
        <strong>{t('picker.title', { name: track.name })}</strong>
        <input type="search" autoFocus placeholder={t('picker.searchPlaceholder')} aria-label={t('picker.search')}
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" onClick={onClose}>{t('common.close')}</button>
      </div>
      {!query && (
        <section>
          <h4>{t('picker.presets')}</h4>
          <ul className="preset-row">
            {INSTRUMENT_PRESETS.map((p) => <Row key={p.label} inst={p} label={zh ? p.label : p.en}
              sub={p.isDrum ? 'Drums' : `#${p.program + 1}`} />)}
          </ul>
        </section>
      )}
      <section className="catalog">
        <h4>{t('picker.catalog')}{query && t('picker.results', { n: results.length })}</h4>
        {GM_FAMILIES.map((f) => {
          const items = results.filter((p) => p.family === f)
          if (!items.length) return null
          return (
            <div key={f.index} className="family">
              <h5>{zh ? `${f.zh} · ${f.en}` : f.en}</h5>
              <ul>
                {items.map((p) => <Row key={p.program} inst={{ program: p.program, isDrum: false }}
                  label={`${p.display}. ${p[lang]}`} sub={zh ? p.en : ''} />)}
              </ul>
            </div>
          )
        })}
        {drumKitMatches(query) && (
          <div className="family">
            <h5>{t('picker.drumFamily')}</h5>
            <ul><Row inst={{ program: DRUM_KIT.program, isDrum: true }} label={DRUM_KIT[lang]} sub={zh ? DRUM_KIT.en : ''} /></ul>
          </div>
        )}
      </section>
    </dialog>
  )
}
