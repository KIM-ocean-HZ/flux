import { useState } from 'react'
import PianoRoll from './PianoRoll.jsx'

// Same tune as research/sample_data.py, so the demo and the research pipeline
// share their default input. Times/durations are in beats.
const TWINKLE = [
  [60, 0, 1], [60, 1, 1], [67, 2, 1], [67, 3, 1],
  [69, 4, 1], [69, 5, 1], [67, 6, 2],
  [65, 8, 1], [65, 9, 1], [64, 10, 1], [64, 11, 1],
  [62, 12, 1], [62, 13, 1], [60, 14, 2],
].map(([pitch, time, duration]) => ({ pitch, time, duration, velocity: 80 }))

export default function App() {
  const [notes, setNotes] = useState(TWINKLE)
  const [ghosts, setGhosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const suggest = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error(`backend returned ${res.status}`)
      const data = await res.json()
      setGhosts(data.ghosts)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const accept = () => {
    setNotes([...notes, ...ghosts])
    setGhosts([])
  }

  const reject = () => setGhosts([])

  return (
    <div className="app">
      <header>
        <h1>FLUX</h1>
        <p className="tagline">Draw a melody, then ask for ghost accompaniment.</p>
      </header>

      <div className="toolbar">
        <button onClick={suggest} disabled={loading || notes.length === 0}>
          {loading ? 'Thinking…' : ghosts.length ? 'Regenerate' : 'Suggest'}
        </button>
        <button onClick={accept} disabled={ghosts.length === 0}>Accept</button>
        <button onClick={reject} disabled={ghosts.length === 0}>Reject</button>
        <button onClick={() => { setNotes([]); setGhosts([]) }} disabled={notes.length === 0 && ghosts.length === 0}>
          Clear
        </button>
        <span className="hint">click grid = add note · click note = delete</span>
        {error && <span className="error">{error}</span>}
      </div>

      <PianoRoll
        notes={notes}
        ghosts={ghosts}
        onAddNote={(n) => setNotes([...notes, n])}
        onRemoveNote={(i) => setNotes(notes.filter((_, j) => j !== i))}
      />
    </div>
  )
}
