import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/I18n.jsx'

/**
 * Blocking confirmation/error dialog. Musical typing is paused while it is open. Title, lines,
 * note and action labels may be message descriptors.
 */
export default function Modal({ title, lines = [], note, tone = 'info', actions = [], onClose }) {
  const { t } = useI18n()
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    d.showModal()
    return () => d.open && d.close()
  }, [])
  return (
    <dialog ref={ref} className={`modal modal-${tone}`} onClose={onClose} onCancel={onClose} aria-label={t(title)}>
      <h3>{t(title)}</h3>
      {lines.length > 0 && <ul>{lines.map((l, i) => <li key={i}>{t(l)}</li>)}</ul>}
      {note && <p className="muted">{t(note)}</p>}
      <div className="row actions">
        {actions.map((a, i) => (
          <button key={i} type="button" className={a.primary ? 'primary' : ''} onClick={() => { onClose(); a.run() }}>{t(a.label)}</button>
        ))}
        <button type="button" autoFocus onClick={onClose}>{actions.length ? t('common.cancel') : t('common.close')}</button>
      </div>
    </dialog>
  )
}
