// Message lookup. Pure modules return message descriptors ({ key, params }) instead of display
// text; the interface translates them in the current language. A param may itself be a
// descriptor (e.g. a key name inside a sentence) and is translated first.

import { MESSAGES } from './messages.js'

export const LANGS = ['zh', 'en']
export const DEFAULT_LANG = 'zh'

export const m = (key, params) => (params ? { key, params } : { key })

/**
 * `msg` is a descriptor, a catalog key, or plain text (user data or text that is already
 * translated), which is returned unchanged.
 */
export function translate(lang, msg, params) {
  if (msg == null) return ''
  if (typeof msg === 'object') return translate(lang, msg.key, msg.params)
  const entry = (MESSAGES[lang] ?? MESSAGES[DEFAULT_LANG])[msg]
  if (entry === undefined) return msg
  const values = {}
  for (const [k, v] of Object.entries(params ?? {})) values[k] = v != null && typeof v === 'object' ? translate(lang, v) : v
  return typeof entry === 'function' ? entry(values) : entry.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`))
}
