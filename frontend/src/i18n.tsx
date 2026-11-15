import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Area, Bounds, Status } from './explore/api'
import { messages } from './messages'
import type { MessageKey } from './messages'

type Language = 'vi' | 'en'
const storageKey = 'hoalich-language'
const regionNames: Readonly<Record<string, string>> = {
  TrungDuMienNuiPhiaBac: 'Northern Midlands and Mountains',
  DongBangSongHong: 'Red River Delta',
  BacTrungBo: 'North Central Coast',
  DuyenHaiNamTrungBo: 'South Central Coast',
  TayNguyenKTXH: 'Central Highlands',
  DongNamBo: 'Southeast',
  DongBangSongCuuLong: 'Mekong Delta',
}

function formatters(language: Language) {
  const locale = language === 'vi' ? 'vi-VN' : 'en-GB'
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const detections = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const differences = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
  const dates = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: '2-digit', month: language === 'vi' ? '2-digit' : 'short', year: 'numeric' })
  const months = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long' })
  const shortMonths = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' })
  const weekdays = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' })

  function t(key: MessageKey, values: Record<string, string | number> = {}) {
    return messages[key][language === 'vi' ? 0 : 1].replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder))
  }

  function monthLabel(month: number, year?: number) {
    if (language === 'vi') return `Tháng ${month}${year == null ? '' : '/' + year}`
    return months.format(Date.UTC(2000, month - 1)) + (year == null ? '' : ' ' + year)
  }

  return {
    t,
    number: (value: number) => numbers.format(value),
    detectionCount: (value: number) => detections.format(value),
    detectionLabel: (value: number | null, status: Status) => value != null && status === 'AVAILABLE'
      ? t(Math.round(value) === 1 ? 'singleDetection' : 'detectionCount', { count: detections.format(value) }) : t(status),
    detectionDifference: (value: number) => differences.format(value).replace('-', '−'),
    valueLabel: (value: number | null, status: Status) => value != null && status === 'AVAILABLE' ? detections.format(value) : t(status),
    dateLabel: (date: string) => dates.format(new Date(date + 'T00:00:00Z')),
    monthLabel,
    shortMonth: (month: number) => language === 'vi' ? 'T' + month : shortMonths.format(Date.UTC(2000, month - 1)),
    weekdayLabels: Array.from({ length: 7 }, (_, index) => weekdays.format(Date.UTC(2024, 0, index + 1))),
    boundsLabel: ({ west, east, south, north }: Bounds) =>
      `${numbers.format(west)}° – ${numbers.format(east)}° ${t('east')} · ${numbers.format(south)}° – ${numbers.format(north)}° ${t('north')}`,
    areaLabel: (area?: Area) => {
      if (!area) return t('drawnArea')
      if (area.type === 'national') return t('national')
      return (language === 'en' ? regionNames[area.id] : undefined) ?? area.name ?? area.id
    },
  }
}

const translations = { vi: formatters('vi'), en: formatters('en') }
const LocaleContext = createContext({ language: 'vi' as Language, toggleLanguage: () => {} })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem(storageKey) === 'en' ? 'en' : 'vi'
    } catch {
      return 'vi'
    }
  })

  useEffect(() => {
    document.documentElement.lang = language
    try {
      localStorage.setItem(storageKey, language)
    } catch {
      // The language still applies for this visit when storage is unavailable.
    }
  }, [language])

  return <LocaleContext.Provider value={{ language, toggleLanguage: () => setLanguage((current) => current === 'vi' ? 'en' : 'vi') }}>
    {children}
  </LocaleContext.Provider>
}

export function useI18n() {
  const preference = useContext(LocaleContext)
  return { ...translations[preference.language], ...preference }
}

export function LanguageSwitch() {
  const { t, language, toggleLanguage } = useI18n()
  return <button className="language-switch quiet" type="button" aria-label={t('language')} onClick={toggleLanguage}>
    <span className={language === 'vi' ? 'current-language' : undefined}>VI</span>
    <span aria-hidden="true"> / </span>
    <span className={language === 'en' ? 'current-language' : undefined}>EN</span>
  </button>
}
