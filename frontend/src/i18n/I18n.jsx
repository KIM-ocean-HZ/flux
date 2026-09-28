import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LANG, LANGS, translate } from './translate.js'

const STORAGE_KEY = 'flux.lang'
const I18nContext = createContext(null)

// The choice is a per-browser convenience; without storage it lasts for this page only.
function loadLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LANGS.includes(saved) ? saved : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

function saveLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage unavailable (private mode, blocked site data): keep the in-memory choice.
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(loadLang)
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])
  const setLang = useCallback((next) => {
    saveLang(next)
    setLangState(next)
  }, [])
  const value = useMemo(() => ({ lang, setLang, t: (msg, params) => translate(lang, msg, params) }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
