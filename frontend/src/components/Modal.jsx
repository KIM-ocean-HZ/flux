import { useEffect, useRef } from 'react'

/** Blocking confirmation/error dialog. Musical typing is paused while it is open. */
export default function Modal({ title, lines = [], note, tone = 'info', actions = [], onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    d.showModal()
    return () => d.open && d.close()
  }, [])
  return (
    <dialog ref={ref} className={`modal modal-${tone}`} onClose={onClose} onCancel={onClose} aria-label={title}>
      <h3>{title}</h3>
      {lines.length > 0 && <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {note && <p className="muted">{note}</p>}
      <div className="row actions">
        {actions.map((a) => (
          <button key={a.label} type="button" className={a.primary ? 'primary' : ''} onClick={() => { onClose(); a.run() }}>{a.label}</button>
        ))}
        <button type="button" autoFocus onClick={onClose}>{actions.length ? '取消' : '关闭'}</button>
      </div>
    </dialog>
  )
}
