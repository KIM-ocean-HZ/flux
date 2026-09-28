import { useRef } from 'react'

const STATUS_TEXT = {
  off: '声音未启用', starting: '正在启动音频…', 'needs-soundbank': '需要选择音源文件', loading: '正在载入音源…',
  ready: '声音就绪', error: '音频启动失败',
}

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
  const status = engine.status
  const suspended = engine.ctx && engine.ctx.state !== 'running'
  const sb = engine.soundbank
  const coverage = engine.coverage
  return (
    <header className="header">
      <div className="brand">FLUX</div>
      <input className="project-name" aria-label="项目名称" value={project.name}
        onChange={(e) => onRename(e.target.value)} />
      <div className="group">
        <button type="button" disabled={!history.past.length || recording} onClick={() => dispatch({ type: 'undo' })}
          title={history.past.length ? `撤销：${history.past[history.past.length - 1].label}（⌘Z）` : '没有可撤销的操作'}>撤销</button>
        <button type="button" disabled={!history.future.length || recording} onClick={() => dispatch({ type: 'redo' })}
          title={history.future.length ? `重做：${history.future[0].label}（⇧⌘Z）` : '没有可重做的操作'}>重做</button>
      </div>
      <div className="group">
        <button type="button" disabled={recording} onClick={onNew}>新建</button>
        <button type="button" disabled={recording} onClick={onExample} title="载入《小星星》示例旋律（可撤销）">载入示例</button>
        <FileButton label="打开项目" accept=".json,application/json" onFile={onOpen} disabled={recording} />
        <button type="button" onClick={onSave} title="下载项目 JSON（含和弦轨、调性与音源标识）">保存项目</button>
        <FileButton label="导入 MIDI" accept=".mid,.midi,audio/midi" onFile={onImportMidi} disabled={recording} />
        <button type="button" onClick={onExportMidi}>导出 MIDI</button>
      </div>
      <div className="audio-status" data-status={status}>
        {status === 'off' || status === 'error' || suspended ? (
          <button type="button" className="primary" onClick={() => engine.enable()}>
            {status === 'error' ? '重试启用声音' : suspended ? '恢复声音' : '启用声音'}
          </button>
        ) : null}
        <span className={`status-dot status-${suspended ? 'error' : status}`} aria-hidden="true" />
        <span className="status-text" data-testid="audio-status">
          {suspended ? `音频已暂停（${engine.ctx.state}）` : STATUS_TEXT[status]}
          {sb && status === 'ready' ? ` · ${sb.name}` : ''}
          {coverage && status === 'ready' ? ` · GM ${coverage.melodic.size}/128${coverage.drumKit ? ' + 鼓组' : ' · 缺鼓组'}` : ''}
        </span>
        {engine.synth && (
          <FileButton label={sb ? '更换音源' : '选择音源文件'} accept=".sf2,.sf3,.dls"
            onFile={(f) => engine.loadSoundbankFile(f)} title="本地 SF2／SF3／DLS 音色文件；项目只记录文件名、大小与哈希" />
        )}
      </div>
      {engine.error && <div className="banner banner-error" role="alert">{engine.error}</div>}
      {soundbankMismatch && (
        <div className="banner banner-warn" role="alert">
          此项目的轨道使用音源「{soundbankMismatch.name}」（{(soundbankMismatch.byteLength / 1e6).toFixed(1)} MB，SHA-256 {soundbankMismatch.sha256?.slice(0, 12)}…），
          {sb ? `当前载入的是「${sb.name}」。` : '当前尚未载入。'}
          请用“{sb ? '更换音源' : '选择音源文件'}”重新定位该文件{sb ? '，或' : '。'}
          {sb && <button type="button" onClick={onUseCurrentSoundbank}>改用当前音源</button>}
        </div>
      )}
    </header>
  )
}
