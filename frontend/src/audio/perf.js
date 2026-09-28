// Small in-page timing log for verification (exposed as window.__flux.perf).

const MAX = 20000
const series = new Map()

export function record(name, value) {
  let list = series.get(name)
  if (!list) series.set(name, (list = []))
  list.push(value)
  if (list.length > MAX) list.splice(0, list.length - MAX)
}

export function summary() {
  const out = {}
  for (const [name, list] of series) {
    const s = [...list].sort((a, b) => a - b)
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
    out[name] = { count: s.length, p50: q(0.5), p95: q(0.95), max: s[s.length - 1], min: s[0] }
  }
  return out
}

export const reset = () => series.clear()
