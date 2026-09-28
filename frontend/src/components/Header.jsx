import { useRef } from 'react'
import { useI18n } from '../i18n/I18n.jsx'
import { LANGS } from '../i18n/translate.js'

function FileButton({ label, accept, onFile, title, disabled }) {
  const ref = useRef(null)
  return (
    <>
      <button type="button" title={title} disabled={disabled} onClick={() => ref.current.click()}>{label}</button>
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => {
        const f = e.target.files[0]
        e.target.value = ''
        if (f) onFile(f)
      }} />
    </>
  )
}

export default function Header({ project, history, dispatch, onRename, engine, onNew, onExample, onOpen, onSave,
  onImportMidi, onExportMidi, soundbankMismatch, onUseCurrentSoundbank, recording }) {
  const { t, lang, setLang } = useI18n()
  const status = engine.status
  const suspended = engine.ctx && engine.ctx.state !== 'running'
  const sb = engine.soundbank
  const coverage = engine.coverage
  const bankAction = sb ? t('audio.changeBank') : t('audio.chooseBank')
  return (
    <header className="header">
      <div className="brand">FLUX</div>
      <input className="project-name" aria-label={t('header.projectName')} value={project.name}
        onChange={(e) => onRename(e.target.value)} />
      <div className="group">
        <button type="button" disabled={!history.past.length || recording} onClick={() => dispatch({ type: 'undo' })}
          title={history.past.length ? t('header.undoTitle', { label: history.past[history.past.length - 1].label }) : t('header.nothingToUndo')}>{t('header.undo')}</button>
        <button type="button" disabled={!history.future.length || recording} onClick={() => dispatch({ type: 'redo' })}
          title={history.future.length ? t('header.redoTitle', { label: history.future[0].label }) : t('header.nothingToRedo')}>{t('header.redo')}</button>
      </div>
      <div className="group">
        <button type="button" disabled={recording} onClick={onNew}>{t('header.new')}</button>
        <button type="button" disabled={recording} onClick={onExample} title={t('header.exampleTitle')}>{t('header.example')}</button>
        <FileButton label={t('header.open')} accept=".json,application/json" onFile={onOpen} disabled={recording} />
        <button type="button" onClick={onSave} title={t('header.saveTitle')}>{t('header.save')}</button>
        <FileButton label={t('header.importMidi')} accept=".mid,.midi,audio/midi" onFile={onImportMidi} disabled={recording} />
        <button type="button" onClick={onExportMidi} title={t('header.exportTitle')}>{t('header.exportMidi')}</button>
      </div>
      <div className="audio-status" data-status={status}>
        {status === 'off' || status === 'error' || suspended ? (
          <button type="button" className="primary" onClick={() => engine.enable()}>
            {status === 'error' ? t('audio.retry') : suspended ? t('audio.resume') : t('audio.enable')}
          </button>
        ) : null}
        <span className={`status-dot status-${suspended ? 'error' : status}`} aria-hidden="true" />
        <span className="status-text" data-testid="audio-status">
          {suspended ? t('audio.suspended', { state: engine.ctx.state }) : t(`audio.status.${status}`)}
          {sb && status === 'ready' ? ` · ${sb.name}` : ''}
          {coverage && status === 'ready' ? ` · GM ${coverage.melodic.size}/128${coverage.drumKit ? t('audio.plusDrums') : t('audio.noDrums')}` : ''}
        </span>
        {engine.synth && (
          <FileButton label={bankAction} accept=".sf2,.sf3,.dls" onFile={(f) => engine.loadSoundbankFile(f)} title={t('audio.bankTitle')} />
        )}
        <select className="lang" aria-label={t('header.language')} value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
        </select>
      </div>
      {engine.error && <div className="banner banner-error" role="alert">{t(engine.error)}</div>}
      {soundbankMismatch && (
        <div className="banner banner-warn" role="alert">
          {t('audio.mismatch', {
            name: soundbankMismatch.name, mb: (soundbankMismatch.byteLength / 1e6).toFixed(1), sha: soundbankMismatch.sha256?.slice(0, 12),
          })}
          {sb ? t('audio.mismatchLoaded', { name: sb.name }) : t('audio.mismatchNone')}
          {t(sb ? 'audio.relocateOr' : 'audio.relocate', { action: bankAction })}
          {sb && <button type="button" onClick={onUseCurrentSoundbank}>{t('audio.useCurrent')}</button>}
        </div>
      )}
    </header>
  )
}
