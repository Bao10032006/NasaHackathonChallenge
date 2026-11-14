import type { DailyCalendarValue } from '../api/types'
import { formatDate } from '../lib/format'
import { MONTH_NAMES } from '../lib/labels'
import { HOT_CLASS, ORIGIN_BADGE, ZERO_COLOR, activityScale, compactValue, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { dayCalendarMonth, useAppState, useDispatch } from '../state/AppState'
import { dayCalendarRequest } from './requests'
import { Card, CoverageChip, ErrorNote, ServedByBadge, UpdatingNote } from './ui'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function dayLabel(value: DailyCalendarValue, peak: boolean): string {
  if (value.valueStatus !== 'AVAILABLE' || value.value === null) {
    return `${formatDate(value.date)}: ngoài phạm vi dữ liệu`
  }
  const origin = value.origin ? `, ${ORIGIN_BADGE[value.origin].label}` : ''
  return `${formatDate(value.date)}: ${readableValue(value.value)} snpp_eq${value.value === 0 ? ' (không có phát hiện)' : ''}${origin}${peak ? ', ngày nổi bật' : ''}`
}

/**
 * Month grid with one cell per civil day (28–31, leap day included). Outside-range days stay visible
 * but disabled and never trigger an exact-date query; zero days remain selectable.
 */
export function DayCalendarGrid() {
  const state = useAppState()
  const dispatch = useDispatch()
  const { filters } = state
  const month = dayCalendarMonth(filters)
  const days = useApi(dayCalendarRequest(state))
  const { data, stale } = currentOrPrevious(days)

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
            <span className="badge">
              Tổng tháng: {data.summary.totalValue === null ? '—' : `${readableValue(data.summary.totalValue)} snpp_eq`}
            </span>
            <CoverageChip coverage={data.summary.coverage} />
            {data.summary.peakDate && (
              <span className="badge">
                ★ Ngày nổi bật: {formatDate(data.summary.peakDate.date)} ({readableValue(data.summary.peakDate.value)})
                {data.summary.coverage.partial && ' — trong khoảng đã có dữ liệu'}
              </span>
            )}
          </div>
          <div className="calendar-grid" role="grid" aria-label={`Lịch ngày tháng ${month}/${filters.year}`}>
            {WEEKDAYS.map((weekday) => <div key={weekday} className="calendar-weekday" role="columnheader">{weekday}</div>)}
            {Array.from({ length: firstWeekday }, (_, index) => <div key={`blank-${index}`} className="calendar-blank" />)}
            {values.map((value) => {
              const inRange = value.valueStatus === 'AVAILABLE' && value.value !== null
              const peak = value.date === peakDate
              const selected = value.date === selectedDate
              const background = inRange ? ((value.value as number) === 0 ? ZERO_COLOR : scale.color(value.value as number)) : undefined
              const bright = inRange && scale.classOf(value.value as number) >= HOT_CLASS
              return (
                <button
                  key={value.date}
                  type="button"
                  role="gridcell"
                  className={[
                    'calendar-day',
                    inRange ? '' : 'is-outside',
                    selected ? 'is-selected' : '',
                    bright ? 'is-bright' : '',
                    inRange && value.value === 0 ? 'is-zero' : '',
                  ].join(' ')}
                  style={background ? { background } : undefined}
                  disabled={!inRange}
                  aria-pressed={selected}
                  aria-label={dayLabel(value, peak)}
                  title={dayLabel(value, peak)}
                  onClick={() => dispatch({ type: 'setDate', date: value.date })}
                >
                  <span className="day-number">{Number(value.date.slice(8, 10))}{peak && ' ★'}</span>
                  <span className="day-value">{inRange ? compactValue(value.value as number) : '—'}</span>
                  {inRange && value.origin && value.origin !== 'DIRECT_OBSERVATION' && (
                    <span className="day-origin" aria-hidden="true">{ORIGIN_BADGE[value.origin].short}</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="muted small">
            Mỗi ô là một ngày. Số trong ô là snpp_eq của ngày; “0” là không có phát hiện; “—” là ngoài phạm vi dữ liệu
            (không chọn được). Nhãn QĐ = quan sát NOAA‑20 quy đổi, ƯL = ước lượng phân bổ từ tổng tháng, HH = nhiều loại;
            ô không nhãn là quan sát S‑NPP trực tiếp. ★ = ngày nổi bật.
          </p>
        </div>
      )}
      {!data && days.status === 'loading' && <p className="muted" role="status">Đang tải lịch ngày…</p>}
    </Card>
  )
}
