import type { Calendar, Days } from './api'
import { CoverageNotice, ResourceNotice, dateLabel, number, origins, statusLabels, valueLabel } from './display'
import { SeriesChart } from './SeriesChart'
import type { Resource } from './useResource'

export function ActivityCalendars({ year, month, date, calendar, days, onMonth, onDay }: {
  year: number
  month?: number
  date?: string
  calendar: Resource<Calendar>
  days: Resource<Days>
  onMonth: (month: number) => void
  onDay: (date: string) => void
}) {
  const first = days.data?.values[0]
  const offset = first ? (new Date(first.date + 'T00:00:00Z').getUTCDay() + 6) % 7 : 0
  const maximum = Math.max(0, ...(days.data?.values.map((day) => day.value ?? 0) ?? []))
  return (
    <>
      <section className="panel" aria-labelledby="monthly-activity-title">
        <div className="panel-heading"><h2 id="monthly-activity-title">Hoạt động đốt theo tháng</h2><span className="pill">{year}</span></div>
        <ResourceNotice resource={calendar} />
        {calendar.data && <SeriesChart title="Hoạt động đốt theo 12 tháng" active={month} onSelect={onMonth}
          points={calendar.data.values.map((item) => ({
            key: item.period, label: 'T' + item.period, value: item.valueStatus === 'AVAILABLE' ? item.value : null,
            partial: item.coverage.partial,
            note: item.coverage.partial ? 'Kỳ chưa đầy đủ' : statusLabels[item.valueStatus],
          }))} />}
        {calendar.data?.values.some((item) => item.coverage.partial) && <p className="muted">* Kỳ có dữ liệu một phần</p>}
      </section>

      {month && <section className="panel" aria-labelledby="day-calendar-title">
        <div className="panel-heading"><h2 id="day-calendar-title">Lịch ngày</h2><span className="pill">Tháng {month}/{year}</span></div>
        <ResourceNotice resource={days} />
        {days.data && <>
          <CoverageNotice coverage={days.data.summary.coverage} />
          <div className="day-grid">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span className="weekday" key={day}>{day}</span>)}
            {Array.from({ length: offset }, (_, i) => <span key={'offset-' + i} aria-hidden="true" />)}
            {days.data.values.map((day) => {
              const available = day.valueStatus === 'AVAILABLE' && day.value != null
              const caption = valueLabel(day.value, day.valueStatus)
              const description = available && day.origin ? origins[day.origin] : statusLabels[day.valueStatus]
              const intensity = maximum && available ? Math.sqrt((day.value ?? 0) / maximum) : 0
              const dayClass = `day${available && day.value === 0 ? ' zero' : ''}${day.origin === 'MODEL_REDISTRIBUTED' ? ' estimated-day' : ''}`
              return <button key={day.date} type="button" className={dayClass}
                style={intensity ? { backgroundColor: `rgb(${Math.round(24 + 115 * intensity)} ${Math.round(30 + 6 * intensity)} ${Math.round(45 + 4 * intensity)})` } : undefined}
                aria-label={`${dateLabel(day.date)} · ${caption} · ${description}`}
                title={description} aria-pressed={date === day.date} disabled={!available} onClick={() => onDay(day.date)}>
                <span>{Number(day.date.slice(-2))}</span>
                <strong>{available ? number(day.value!) : day.valueStatus === 'OUTSIDE_DATASET_RANGE' ? 'Ngoài kỳ' : 'Thiếu'}</strong>
                {day.origin === 'MODEL_REDISTRIBUTED' && <small>Ước lượng</small>}
              </button>
            })}
          </div>
          <p className="muted">0 = giá trị hợp lệ · Ngoài kỳ = ngoài phạm vi · Thiếu = thiếu dữ liệu</p>
        </>}
      </section>}
    </>
  )
}
