// Undo/redo over whole-project snapshots. Monitoring state (mute/solo/volume, loop range,
// loaded sound bank) is carried forward so undo only reverts musical edits. `revision`
// only increases, so a restored snapshot still reads as a new input version.

const LIMIT = 200

export const initHistory = (project) => ({ past: [], present: project, future: [], lastLabel: null })

function carryMonitoring(from, to) {
  if (from.id !== to.id) return { ...to, revision: Math.max(to.revision, from.revision + 1) }
  const byId = new Map(from.tracks.map((t) => [t.id, t]))
  return {
    ...to,
    loopRange: from.loopRange,
    soundbanks: from.soundbanks,
    revision: from.revision + 1,
    tracks: to.tracks.map((t) => {
      const cur = byId.get(t.id)
      return cur ? { ...t, mute: cur.mute, solo: cur.solo, volume: cur.volume, soundbankId: cur.soundbankId } : t
    }),
  }
}

export function historyReducer(state, action) {
  switch (action.type) {
    case 'apply': {
      const next = action.fn(state.present)
      if (next === state.present) return state
      return {
        past: [...state.past, { project: state.present, label: action.label }].slice(-LIMIT),
        present: { ...next, revision: state.present.revision + 1 },
        future: [],
        lastLabel: action.label,
      }
    }
    case 'load': // open/import/new: undoable, keeps the loaded file exactly (including its revision)
      return {
        past: [...state.past, { project: state.present, label: action.label }].slice(-LIMIT),
        present: action.project,
        future: [],
        lastLabel: action.label,
      }
    case 'monitor': // not undoable, no revision change
      return { ...state, present: action.fn(state.present) }
    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return {
        past: state.past.slice(0, -1),
        present: carryMonitoring(state.present, prev.project),
        future: [{ project: state.present, label: prev.label }, ...state.future],
        lastLabel: `撤销：${prev.label}`,
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        past: [...state.past, { project: state.present, label: next.label }],
        present: carryMonitoring(state.present, next.project),
        future: state.future.slice(1),
        lastLabel: `重做：${next.label}`,
      }
    }
    default:
      throw new Error(`unknown history action ${action.type}`)
  }
}
