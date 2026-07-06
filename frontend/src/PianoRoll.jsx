const PITCH_MAX = 84 // C6 (top row)
const PITCH_MIN = 48 // C3 (bottom row)
const BEATS = 16
const CELL_W = 44
const CELL_H = 16
const LABEL_W = 36

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const pitchToY = (pitch) => (PITCH_MAX - pitch) * CELL_H
const isBlackKey = (pitch) => [1, 3, 6, 8, 10].includes(pitch % 12)

export default function PianoRoll({ notes, ghosts, onAddNote, onRemoveNote }) {
  const width = LABEL_W + BEATS * CELL_W
  const height = (PITCH_MAX - PITCH_MIN + 1) * CELL_H

  const handleGridClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - LABEL_W
    const y = e.clientY - rect.top
    if (x < 0) return
    const time = Math.floor(x / CELL_W)
    const pitch = PITCH_MAX - Math.floor(y / CELL_H)
    if (pitch < PITCH_MIN || pitch > PITCH_MAX || time >= BEATS) return
    onAddNote({ pitch, time, duration: 1, velocity: 80 })
  }

  const rows = []
  for (let p = PITCH_MIN; p <= PITCH_MAX; p++) rows.push(p)

  return (
    <svg width={width} height={height} className="piano-roll" onClick={handleGridClick}>
      {/* row backgrounds: shade black-key rows for orientation */}
      {rows.map((p) => (
        <rect key={p} x={LABEL_W} y={pitchToY(p)} width={BEATS * CELL_W} height={CELL_H}
              className={isBlackKey(p) ? 'row-black' : 'row-white'} />
      ))}

      {/* beat grid lines, heavier every 4 beats */}
      {Array.from({ length: BEATS + 1 }, (_, b) => (
        <line key={b} x1={LABEL_W + b * CELL_W} y1={0} x2={LABEL_W + b * CELL_W} y2={height}
              className={b % 4 === 0 ? 'grid-bar' : 'grid-beat'} />
      ))}

      {/* pitch labels on C rows */}
      {rows.filter((p) => p % 12 === 0).map((p) => (
        <text key={p} x={4} y={pitchToY(p) + CELL_H - 4} className="pitch-label">
          {NOTE_NAMES[p % 12]}{Math.floor(p / 12) - 1}
        </text>
      ))}

      {/* ghost suggestions: translucent, non-interactive */}
      {ghosts.map((n, i) => (
        <rect key={`g${i}`} x={LABEL_W + n.time * CELL_W + 1} y={pitchToY(n.pitch) + 1}
              width={n.duration * CELL_W - 2} height={CELL_H - 2} rx={3} className="note-ghost" />
      ))}

      {/* committed notes: solid, click to delete */}
      {notes.map((n, i) => (
        <rect key={`n${i}`} x={LABEL_W + n.time * CELL_W + 1} y={pitchToY(n.pitch) + 1}
              width={n.duration * CELL_W - 2} height={CELL_H - 2} rx={3} className="note"
              onClick={(e) => { e.stopPropagation(); onRemoveNote(i) }} />
      ))}
    </svg>
  )
}
