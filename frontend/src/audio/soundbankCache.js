// Per-browser convenience: remember the last chosen sound bank so a refresh does not require
// picking the file again. Storage may be unavailable (private mode, blocked site data); every
// call degrades to "nothing cached".

const DB = 'flux-soundbanks'
const STORE = 'banks'
const KEY = 'last'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  }))
}

export async function cacheSoundbank(record) {
  try {
    await run('readwrite', (s) => s.put(record, KEY))
    return true
  } catch {
    return false
  }
}

export async function loadCachedSoundbank() {
  try {
    return (await run('readonly', (s) => s.get(KEY))) ?? null
  } catch {
    return null
  }
}

export async function clearCachedSoundbank() {
  try {
    await run('readwrite', (s) => s.delete(KEY))
  } catch {
    // nothing cached is the same outcome
  }
}
