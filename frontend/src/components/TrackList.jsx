import { instrumentLabel, instrumentName } from '../music/gm.js'
import { keyLabel } from '../music/analysis.js'
import * as P from '../music/project.js'

export default function TrackList({ project, selectedTrackId, armedTrackId, onSelect, onArm, onPickInstrument, onAddTrack,
  apply, monitor, engine, harmony, recording }) {
  const audible = P.audibleTrackIds(project.tracks)
  const key = harmony.analysis.key
  const confirmed = project.chordTrack.filter((e) => e.status === 'confirmed').length
  return (
    <aside className="tracks" aria-label="轨道">
      <div className="track chord-track-row">
        <div className="track-title">和弦轨</div>
        <div className="track-sub">
          {key ? `${keyLabel(key)}${key.tentative ? '（推测）' : '（已确认）'}` : '调性未定'} · {confirmed} 个已确认
        </div>
        <div className="track-sub muted">控制轨，默认不发声、不导出为音符</div>
      </div>
      <ul className="track-list">
        {project.tracks.map((t) => {
          const selected = t.id === selectedTrackId
          const armed = t.id === armedTrackId
          const covered = !engine.coverage || (t.isDrum ? engine.coverage.drumKit : engine.coverage.melodic.has(t.program))
          return (
            <li key={t.id} className={`track ${selected ? 'selected' : ''} ${audible.has(t.id) ? '' : 'silent'}`}
              aria-current={selected ? 'true' : undefined}>
              <div className="track-head">
                <button type="button" className="track-select" onClick={() => onSelect(t.id)}
                  aria-label={`选择轨道 ${t.name}`} aria-pressed={selected}>{selected ? '▸' : '▹'}</button>
                <input className="track-name" aria-label="轨道名称" value={t.name}
                  onFocus={() => onSelect(t.id)}
                  onChange={(e) => monitor((p) => P.renameTrack(p, t.id, e.target.value))} />
              </div>
              <button type="button" className="instrument" onClick={() => onPickInstrument(t.id)}
                title={instrumentLabel(t)} disabled={recording}>
                {instrumentName(t)}{t.isDrum ? '' : ` · ${t.program + 1}`}{covered ? '' : ' ⚠ 音源缺此音色'}
              </button>
              <div className="track-controls">
                <button type="button" className="m" aria-pressed={t.mute} aria-label={`静音 ${t.name}`}
                  title="静音（Mute 优先于 Solo）" onClick={() => monitor((p) => P.setTrackMix(p, t.id, { mute: !t.mute }))}>M</button>
                <button type="button" className="s" aria-pressed={t.solo} aria-label={`独奏 ${t.name}`}
                  title="独奏（可多轨同时独奏）" onClick={() => monitor((p) => P.setTrackMix(p, t.id, { solo: !t.solo }))}>S</button>
                <button type="button" className="r" aria-pressed={armed} aria-label={`录音准备 ${t.name}`} disabled={recording}
                  title="录音准备：同一时间只有一条轨" onClick={() => onArm(t.id)}>R</button>
                <input type="range" min="0" max="127" value={t.volume} aria-label={`音量 ${t.name}`}
                  onChange={(e) => monitor((p) => P.setTrackMix(p, t.id, { volume: Number(e.target.value) }))} />
                <button type="button" className="delete" aria-label={`删除轨道 ${t.name}`} title="删除轨道（可撤销）"
                  disabled={recording || project.tracks.length === 1}
                  onClick={() => apply(`删除轨道 ${t.name}`, (p) => P.deleteTrack(p, t.id))}>×</button>
              </div>
              <div className="track-sub muted">{P.mainClip(t).notes.length} 个音符{t.isDrum ? ' · 鼓（不参与和弦识别）' : ''}</div>
            </li>
          )
        })}
      </ul>
      <button type="button" className="add-track" onClick={onAddTrack} disabled={recording}>+ 添加轨道</button>
    </aside>
  )
}
