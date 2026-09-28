import { useI18n } from '../i18n/I18n.jsx'
import { chordSymbol, pitchName } from '../music/chords.js'
import { romanNumeral, keyLabel } from '../music/analysis.js'
import { KEY_LABELS, KEY_OFFSETS } from '../music/keyboard.js'
import { formatPosition, NOTE_VALUES } from '../music/time.js'

const WHITE = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']
// Black keys sit after these white-key indexes.
const BLACK = [['KeyW', 0], ['KeyE', 1], ['KeyT', 3], ['KeyY', 4], ['KeyU', 5], ['KeyO', 7], ['KeyP', 8]]
const STEP_VALUES = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/4T', '1/8T', '1/16T']
const MODES = ['audition', 'record', 'step']

export default function KeyboardPanel({ kb, keyboardOn, setKeyboardOn, inputMode, setInputMode, stepValueId, setStepValueId,
  target, engine, liveChord, harmony, onWriteChord, onRest, onManualChord, onPanic, transport, playhead, project }) {
  const { t } = useI18n()
  const held = new Set(kb.heldPitches())
  const key = harmony.analysis.key
  const d = liveChord?.detection
  const top = d?.candidates?.[0]
  const press = (code) => (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    kb.press(code, e.timeStamp)
  }
  const release = (code) => (e) => kb.release(code, e.timeStamp)

  const keyButton = (code, black) => {
    const pitch = kb.base + KEY_OFFSETS[code]
    const down = [...kb.pressed.keys()].includes(code)
    return (
      <button key={code} type="button" tabIndex={-1} className={`pkey ${black ? 'black' : 'white'} ${down ? 'down' : ''}`}
        data-code={code} aria-label={`${KEY_LABELS[code]} · ${pitchName(pitch)} · MIDI ${pitch}`}
        onPointerDown={press(code)} onPointerUp={release(code)} onPointerCancel={release(code)} onLostPointerCapture={release(code)}>
        <span className="letter">{KEY_LABELS[code]}</span>
        <span className="pname">{target.isDrum ? pitch : pitchName(pitch)}</span>
      </button>
    )
  }

  return (
    <section className={`keyboard-panel ${keyboardOn ? 'on' : ''}`} aria-label={t('kb.label')}>
      <div className="kb-bar">
        <button type="button" className={keyboardOn ? 'primary' : ''} aria-pressed={keyboardOn} onClick={() => setKeyboardOn(!keyboardOn)}
          title={t('kb.toggleTitle')}>{keyboardOn ? t('kb.on') : t('kb.off')}</button>
        <div className="group" role="radiogroup" aria-label={t('kb.modeAria')}>
          {MODES.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={inputMode === id} disabled={transport !== 'stopped'}
              onClick={() => setInputMode(id)}>{t(`kb.mode.${id}`)}</button>
          ))}
        </div>
        <span>{t('kb.target')}<strong data-testid="kb-target">{target.name}</strong></span>
        <span>{t('kb.octave')} <strong>{pitchName(kb.base)}</strong>{t('kb.octaveBase', { base: kb.base })}<span className="muted"> Z/X</span></span>
        <span>{t('kb.velocity')} <strong>{kb.velocity}</strong><span className="muted"> C/V</span></span>
        {inputMode === 'step' && (
          <span className="step">
            {t('kb.stepValue')} <select value={stepValueId} onChange={(e) => setStepValueId(e.target.value)} aria-label={t('kb.stepValueAria')}>
              {NOTE_VALUES.filter((v) => STEP_VALUES.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{t(`noteValue.${v.id}`)}</option>)}
            </select>
            <button type="button" onClick={onRest}>{t('kb.rest')}</button>
            <span className="muted">{t('kb.cursor', { position: formatPosition(playhead, project.timeSignature) })}</span>
          </span>
        )}
        {inputMode === 'record' && transport === 'stopped' && <span className="muted">{t('kb.recordHint')}</span>}
        <button type="button" onClick={onPanic} title={t('kb.panicTitle')}>{t('kb.panic')}</button>
        {!engine.ready && <span className="warn">{t('kb.notReady')}</span>}
      </div>
      {keyboardOn && (
        <>
          <div className="live-chord" data-testid="live-chord" aria-live="polite">
            {t('kb.liveChord')}
            {d && d.status !== 'empty' ? (
              <>
                <strong data-testid="live-chord-symbol" className={liveChord.active ? '' : 'stale'}>
                  {top ? chordSymbol(top.chord) : t(d.reason)}
                </strong>
                <span className="muted"> · {t(`detect.status.${d.status}`)}{liveChord.active ? '' : t('kb.justNow')}</span>
                {top && key && <span> · {t(keyLabel(key))} {romanNumeral(top.chord, key).text}{key.tentative ? t('kb.tentative') : ''}</span>}
                {d.candidates.length > 1 && <span className="muted">{t('kb.alternatives', { list: d.candidates.slice(1, 4).map((c) => chordSymbol(c.chord)).join(' / ') })}</span>}
                <span className="muted">{t('kb.notes', { list: d.pitches.map((p) => pitchName(p)).join(' ') })}</span>
                {top && <button type="button" onClick={() => onWriteChord(top)} title={t('kb.writeTitle')}>{t('kb.write')}</button>}
              </>
            ) : <span className="muted">{t('kb.liveHint')}</span>}
            <button type="button" onClick={onManualChord}>{t('kb.manualChord')}</button>
          </div>
          <div className="piano" aria-label={t('kb.pianoAria')}>
            <div className="whites">{WHITE.map((c) => keyButton(c, false))}</div>
            <div className="blacks">
              {BLACK.map(([c, after]) => (
                <div key={c} className="black-slot" style={{ left: `${(after + 1) * (100 / WHITE.length)}%` }}>
                  {keyButton(c, true)}
                </div>
              ))}
            </div>
          </div>
          <p className="muted kb-help">
            {t('kb.help')}
            {held.size > 0 && t('kb.held', { list: [...held].map((p) => pitchName(p)).join(' ') })}
          </p>
        </>
      )}
    </section>
  )
}
