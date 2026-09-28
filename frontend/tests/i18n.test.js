import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MESSAGES } from '../src/i18n/messages.js'
import { LANGS, m, translate } from '../src/i18n/translate.js'
import { CHORD_TYPES } from '../src/music/chords.js'
import { NOTE_VALUES } from '../src/music/time.js'

const SRC = resolve(__dirname, '../src')
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? files(p) : /\.jsx?$/.test(f) ? [p] : []
})
const sources = files(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }))
const keys = Object.keys(MESSAGES.zh)
const namespaces = new Set(keys.map((k) => k.split('.')[0]))

// Keys built with template literals, by family.
const FAMILIES = [
  ...CHORD_TYPES.map((t) => `chordType.${t.id}`),
  ...NOTE_VALUES.map((v) => `noteValue.${v.id}`),
  ...Array.from({ length: 12 }, (_, i) => `interval.${i}`),
  ...['clear', 'ambiguous', 'undetermined', 'unsupported', 'empty'].map((s) => `detect.status.${s}`),
  ...['off', 'starting', 'needs-soundbank', 'loading', 'ready', 'error'].map((s) => `audio.status.${s}`),
  ...['audition', 'record', 'step'].map((s) => `kb.mode.${s}`),
  ...[2, 3, 4, 5, 6, 7, 9, 11].map((d) => `degree.${d}`),
  ...['remove', 'split', 'trim-end', 'trim-start'].map((a) => `editor.action.${a}`),
  ...LANGS.map((l) => `lang.${l}`),
]

describe('message catalog', () => {
  it('has every key in both languages and no duplicate definitions', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual([...keys].sort())
    const catalog = readFileSync(join(SRC, 'i18n/messages.js'), 'utf8')
    const defined = [...catalog.matchAll(/^\s+'([^']+)': \[/gm)].map((x) => x[1])
    expect(defined.length).toBe(new Set(defined).size)
    for (const lang of LANGS) {
      for (const k of keys) expect(MESSAGES[lang][k], `${lang} ${k}`).toBeTruthy()
    }
  })

  it('defines every key the code refers to, and nothing unused', () => {
    const used = new Set(FAMILIES)
    for (const { text } of sources) {
      for (const [, lit] of text.matchAll(/'([a-z][a-zA-Z0-9]*(?:\.[\w\-/]+)+)'/g)) {
        if (namespaces.has(lit.split('.')[0])) used.add(lit)
      }
    }
    expect([...used].filter((k) => !(k in MESSAGES.zh)), 'missing').toEqual([])
    expect(keys.filter((k) => !used.has(k)), 'unused').toEqual([])
  })

  it('keeps Chinese text only in the catalog and the bilingual GM table', () => {
    const cjk = /[㐀-鿿＀-￯　-〿]/
    const offenders = sources.filter(({ path, text }) => !['i18n/messages.js', 'music/gm.js'].includes(path)
      && text.split('\n').some((line) => cjk.test(line) && !line.trim().startsWith('//')))
    expect(offenders.map((o) => o.path)).toEqual([])
  })
})

describe('translate', () => {
  it('fills params, translates nested descriptors and passes plain text through', () => {
    const msg = m('analysis.borrowedLabel', { source: m('key.minor', { tonic: 'C' }) })
    expect(translate('zh', msg)).toBe('借用和弦（来自 C 小调）')
    expect(translate('en', msg)).toBe('Borrowed chord (from C minor)')
    expect(translate('en', 'label.deleteNotes', { n: 1 })).toBe('Delete 1 note')
    expect(translate('en', 'label.deleteNotes', { n: 3 })).toBe('Delete 3 notes')
    expect(translate('en', '我的旋律')).toBe('我的旋律')
    expect(translate('en', null)).toBe('')
  })
})
