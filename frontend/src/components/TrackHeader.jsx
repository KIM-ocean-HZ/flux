import { useI18n } from '../i18n/I18n.jsx'
import { m } from '../i18n/translate.js'
import { instrumentLabel, instrumentName } from '../music/gm.js'
import * as P from '../music/project.js'

/** Row head of one track in the arrange view: select, name, instrument, M/S/R, volume, delete. */
export default function TrackHeader({ track: t, selected, armed, audible, canDelete, onSelect, onArm, onPickInstrument,
  apply, monitor, engine, recording, height }) {
  const { t: tr, lang } = useI18n()
  const covered = !engine.coverage || (t.isDrum ? engine.coverage.drumKit : engine.coverage.melodic.has(t.program))
  return (
    <div className={`track ${selected ? 'selected' : ''} ${audible ? '' : 'silent'}`} style={{ height }}
      aria-current={selected ? 'true' : undefined}>
      <div className="track-head">
        <button type="button" className="track-select" onClick={() => onSelect(t.id)}
          aria-label={tr('track.select', { name: t.name })} aria-pressed={selected}>{selected ? '▸' : '▹'}</button>
        <input className="track-name" aria-label={tr('track.name')} value={t.name}
          onFocus={() => onSelect(t.id)}
          onChange={(e) => monitor((p) => P.renameTrack(p, t.id, e.target.value))} />
        <div className="track-controls">
          <button type="button" className="m" aria-pressed={t.mute} aria-label={tr('track.mute', { name: t.name })}
            title={tr('track.muteTitle')} onClick={() => monitor((p) => P.setTrackMix(p, t.id, { mute: !t.mute }))}>M</button>
          <button type="button" className="s" aria-pressed={t.solo} aria-label={tr('track.solo', { name: t.name })}
            title={tr('track.soloTitle')} onClick={() => monitor((p) => P.setTrackMix(p, t.id, { solo: !t.solo }))}>S</button>
          <button type="button" className="r" aria-pressed={armed} aria-label={tr('track.arm', { name: t.name })} disabled={recording}
            title={tr('track.armTitle')} onClick={() => onArm(t.id)}>R</button>
        </div>
      </div>
      <div className="track-head">
        <button type="button" className="instrument" onClick={() => onPickInstrument(t.id)}
          title={`${instrumentLabel(t, lang)}${t.isDrum ? ` · ${tr('track.drumHint')}` : ''}`} disabled={recording}>
          {instrumentName(t, lang)}{t.isDrum ? '' : ` · ${t.program + 1}`}{covered ? '' : ` ⚠ ${tr('track.missingInBank')}`}
        </button>
        <input type="range" min="0" max="127" value={t.volume} aria-label={tr('track.volume', { name: t.name })}
          onChange={(e) => monitor((p) => P.setTrackMix(p, t.id, { volume: Number(e.target.value) }))} />
        <button type="button" className="delete" aria-label={tr('track.delete', { name: t.name })} title={tr('track.deleteTitle')}
          disabled={recording || !canDelete}
          onClick={() => apply(m('label.deleteTrack', { name: t.name }), (p) => P.deleteTrack(p, t.id))}>×</button>
      </div>
    </div>
  )
}
