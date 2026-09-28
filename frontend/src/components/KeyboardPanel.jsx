import { chordSymbol, pitchName } from '../music/chords.js'
import { romanNumeral, keyLabel } from '../music/analysis.js'
import { KEY_LABELS, KEY_OFFSETS } from '../music/keyboard.js'
import { formatPosition, NOTE_VALUES } from '../music/time.js'

const WHITE = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']
// Black keys sit after these white-key indexes.
const BLACK = [['KeyW', 0], ['KeyE', 1], ['KeyT', 3], ['KeyY', 4], ['KeyU', 5], ['KeyO', 7], ['KeyP', 8]]
const STEP_VALUES = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/4T', '1/8T', '1/16T']
const STATUS = { clear: '明确匹配', ambiguous: '多种解释', undetermined: '未确定', unsupported: '无法识别' }
const MODES = [['audition', '试听'], ['record', '实时录音'], ['step', '步进']]

export default function KeyboardPanel({ kb, keyboardOn, setKeyboardOn, inputMode, setInputMode, stepValueId, setStepValueId,
  target, engine, liveChord, harmony, onWriteChord, onRest, onManualChord, onPanic, transport, playhead, project }) {
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
    <section className={`keyboard-panel ${keyboardOn ? 'on' : ''}`} aria-label="电脑键盘">
      <div className="kb-bar">
        <button type="button" className={keyboardOn ? 'primary' : ''} aria-pressed={keyboardOn} onClick={() => setKeyboardOn(!keyboardOn)}
          title="开启后字母键演奏；Esc 退出">电脑键盘 {keyboardOn ? '开' : '关'}</button>
        <div className="group" role="radiogroup" aria-label="输入模式">
          {MODES.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={inputMode === id} disabled={transport !== 'stopped'}
              onClick={() => setInputMode(id)}>{label}</button>
          ))}
        </div>
        <span>目标轨：<strong data-testid="kb-target">{target.name}</strong></span>
        <span>八度 <strong>{pitchName(kb.base)}</strong>（A = MIDI {kb.base}）<span className="muted"> Z/X</span></span>
        <span>力度 <strong>{kb.velocity}</strong><span className="muted"> C/V</span></span>
        {inputMode === 'step' && (
          <span className="step">
            时值 <select value={stepValueId} onChange={(e) => setStepValueId(e.target.value)} aria-label="步进时值">
              {NOTE_VALUES.filter((v) => STEP_VALUES.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <button type="button" onClick={onRest}>休止／前进一步</button>
            <span className="muted">光标 {formatPosition(playhead, project.timeSignature)}</span>
          </span>
        )}
        {inputMode === 'record' && transport === 'stopped' && <span className="muted">按红色录音键开始；未录音时只试听</span>}
        <button type="button" onClick={onPanic} title="停止播放、释放所有键和预览">停止全部声音</button>
        {!engine.ready && <span className="warn">声音未就绪：键盘仍会显示和弦，但不会发声</span>}
      </div>
      {keyboardOn && (
        <>
          <div className="live-chord" data-testid="live-chord" aria-live="polite">
            当前和弦：
            {d && d.status !== 'empty' ? (
              <>
                <strong data-testid="live-chord-symbol" className={liveChord.active ? '' : 'stale'}>
                  {top ? chordSymbol(top.chord) : d.reason}
                </strong>
                <span className="muted"> · {STATUS[d.status]}{liveChord.active ? '' : ' · 刚才'}</span>
                {top && key && <span> · {keyLabel(key)} {romanNumeral(top.chord, key).text}{key.tentative ? '（暂定）' : ''}</span>}
                {d.candidates.length > 1 && <span className="muted"> · 备选 {d.candidates.slice(1, 4).map((c) => chordSymbol(c.chord)).join(' / ')}</span>}
                <span className="muted"> · 音：{d.pitches.map((p) => pitchName(p)).join(' ')}</span>
                {top && <button type="button" onClick={() => onWriteChord(top)} title="写入选区；无选区时写入当前小节">写入选区</button>}
              </>
            ) : <span className="muted">弹两个以上的音显示和弦（只预览，不写入项目）</span>}
            <button type="button" onClick={onManualChord}>手选和弦</button>
          </div>
          <div className="piano" aria-label="屏幕琴键（可点击）">
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
            白键 A S D F G H J K L ; '，黑键 W E T Y U O P（Logic Musical Typing 键位，按物理位置）。
            输入框、下拉和对话框获得焦点时不发声。延音（Tab）需要保存 CC64，本阶段未开放。
            {held.size > 0 && ` 按下：${[...held].map((p) => pitchName(p)).join(' ')}`}
          </p>
        </>
      )}
    </section>
  )
}
