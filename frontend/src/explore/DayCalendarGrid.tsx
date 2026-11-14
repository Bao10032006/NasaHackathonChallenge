import { useRef, useState, type KeyboardEvent } from 'react'
import type { DailyCalendarValue } from '../api/types'
import { Icon } from '../components/Icon'
import { Card, CoverageChip, ErrorNote, PeakLabel, ServedByBadge, UpdatingNote } from '../components/ui'
import { formatDate } from '../lib/format'
import { MONTH_NAMES } from '../lib/labels'
import { DARK_TEXT_CLASS, ORIGIN_BADGE, ZERO_COLOR, activityScale, compactValue, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { dayCalendarMonth, useAppState, useDispatch } from '../state/AppState'
import { dayCalendarRequest } from './requests'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function dayLabel(value: DailyCalendarValue, peak: boolean): string {
  if (value.valueStatus !== 'AVAILABLE' || value.value === null) {
    return `${formatDate(value.date)}: ngoài phạm vi dữ liệu, không chọn được`
  }
  const origin = value.origin ? `, ${ORIGIN_BADGE[value.origin].label}` : ''
  return `${formatDate(value.date)}: ${readableValue(value.value)} snpp_eq${value.value === 0 ? ' (không có phát hiện)' : ''}${origin}${peak ? ', ngày nổi bật' : ''}`
}

/**
 * Month grid with one cell per civil day (28–31, leap day included). Outside-range days stay visible
 * and focusable (aria-disabled) but never trigger an exact-date query; zero days remain selectable.
 * Keyboard: one tab stop; ←/→ previous/next day, ↑/↓ previous/next week, Home/End first/last day,
 * Enter/Space selects.
 */
export function DayCalendarGrid() {
  const state = useAppState()
  const dispatch = useDispatch()
  const { filters } = state
  const month = dayCalendarMonth(filters)
  const days = useApi(dayCalendarRequest(state))
  const { data, stale } = currentOrPrevious(days)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  if (month === null) {
    return (
      <Card id="day-calendar" title="Lịch chi tiết theo ngày">
        <p className="muted">Chọn một tháng trên biểu đồ 12 tháng hoặc ở bộ lọc để mở lịch ngày.</p>
      </Card>
    )
  }

  const values = data?.values ?? []
  const available = values.filter((value) => value.valueStatus === 'AVAILABLE' && value.value !== null)
  const scale = activityScale(Math.max(0, ...available.map((value) => value.value as number)))
  const firstWeekday = data ? (new Date(`${values[0].date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0
  const peakDate = data?.summary.peakDate?.date ?? null
  const selectedDate = filters.timeMode === 'date' ? filters.date : null
  const selectedIndex = values.findIndex((value) => value.date === selectedDate)
  const peakIndex = values.findIndex((value) => value.date === peakDate)
  const tabIndexDay = focusIndex !== null && focusIndex < values.length
    ? focusIndex
    : selectedIndex >= 0 ? selectedIndex : peakIndex >= 0 ? peakIndex : 0

  function focusDay(index: number) {
    const next = Math.max(0, Math.min(values.length - 1, index))
    setFocusIndex(next)
    buttons.current[next]?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowLeft: index - 1, ArrowRight: index + 1, ArrowUp: index - 7, ArrowDown: index + 7, Home: 0, End: values.length - 1,
    }
    if (event.key in moves) {
      event.preventDefault()
      focusDay(moves[event.key])
    }
  }

  return (
    <Card
      id="day-calendar"
      title={`Lịch ngày · ${MONTH_NAMES[month - 1]}/${filters.year}`}
      aside={<>
        <UpdatingNote show={stale} what="lịch ngày" />
        {days.status === 'success' && <ServedByBadge servedBy={days.servedBy} />}
      </>}
    >
      {days.status === 'error' && <ErrorNote error={days.error} onRetry={days.retry} context="lịch ngày" />}
      {data && (
        <div className={stale ? 'is-stale' : ''}>
          <div className="chips">
            <span className="badge num">
              Tổng tháng: {data.summary.totalValue === null ? '—' : `${readableValue(data.summary.totalValue)} snpp_eq`}
            </span>
            <CoverageChip coverage={data.summary.coverage} />
            {data.summary.peakDate && (
              <span className="badge num">
                <PeakLabel>
                  Ngày nổi bật: {formatDate(data.summary.peakDate.date)} ({readableValue(data.summary.peakDate.value)})
                  {data.summary.coverage.partial && ' — trong khoảng đã có dữ liệu'}
                </PeakLabel>
              </span>
            )}
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="calendar-grid" role="group" aria-label={`Các ngày tháng ${month}/${filters.year}. Dùng phím mũi tên để di chuyển.`}>
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} className="calendar-blank" aria-hidden="true" />)}
            {values.map((value, index) => {
              const inRange = value.valueStatus === 'AVAILABLE' && value.value !== null
              const peak = value.date === peakDate
              const selected = value.date === selectedDate
              const level = inRange ? scale.classOf(value.value as number) : -1
              const background = inRange ? (level < 0 ? ZERO_COLOR : scale.color(value.value as number)) : undefined
              return (
                <button
                  key={value.date}
                  ref={(element) => { buttons.current[index] = element }}
                  type="button"
                  tabIndex={index === tabIndexDay ? 0 : -1}
                  className={[
                    'calendar-day',
                    inRange ? '' : 'is-outside',
                    selected ? 'is-selected' : '',
                    level >= DARK_TEXT_CLASS ? 'is-bright' : '',
                    inRange && level < 0 ? 'is-zero' : '',
                  ].filter(Boolean).join(' ')}
                  style={background ? { background } : undefined}
                  aria-disabled={inRange ? undefined : true}
                  aria-pressed={inRange ? selected : undefined}
                  aria-label={dayLabel(value, peak)}
                  title={dayLabel(value, peak)}
                  onFocus={() => setFocusIndex(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onClick={() => inRange && dispatch({ type: 'setDate', date: value.date })}
                >
                  <span className="day-number">
                    {Number(value.date.slice(8, 10))}
                    {peak && <Icon name="star" size={11} />}
                  </span>
                  <span className="day-value num">{inRange ? compactValue(value.value as number) : '—'}</span>
                  {inRange && value.origin && value.origin !== 'DIRECT_OBSERVATION' && (
                    <span className="day-origin" aria-hidden="true">{ORIGIN_BADGE[value.origin].short}</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="muted small">
            Mỗi ô là một ngày. Số trong ô là snpp_eq của ngày; “0” là không có phát hiện; “—” là ngoài phạm vi dữ liệu
            (không chọn được). QĐ = quan sát NOAA‑20 quy đổi, ƯL = ước lượng phân bổ từ tổng tháng, HH = nhiều loại;
            ô không nhãn là quan sát S‑NPP trực tiếp. Ngôi sao = ngày nổi bật.
          </p>
        </div>
      )}
      {!data && days.status === 'loading' && <p className="muted" role="status">Đang tải lịch ngày…</p>}
    </Card>
  )
}
