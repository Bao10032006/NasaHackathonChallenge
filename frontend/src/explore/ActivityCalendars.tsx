import type { Calendar, Days } from './api'
import { CoverageNotice, ResourceNotice } from './display'
import { useI18n } from '../i18n'
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
  const { t, dateLabel, valueLabel, weekdayLabels, monthLabel, shortMonth } = useI18n()
  const first = days.data?.values[0]
  const offset = first ? (new Date(first.date + 'T00:00:00Z').getUTCDay() + 6) % 7 : 0
  const maximum = Math.max(0, ...(days.data?.values.map((day) => day.value ?? 0) ?? []))
  return (
    <>
      <section className="panel" aria-labelledby="monthly-activity-title">
        <div className="panel-heading"><h2 id="monthly-activity-title">{t('monthlyActivity')}</h2><span className="pill">{year}</span></div>
        <ResourceNotice resource={calendar} />
        {calendar.data && <SeriesChart title={t('annualChart')} active={month} onSelect={onMonth}
          points={calendar.data.values.map((item) => ({
            key: item.period, label: shortMonth(item.period), value: item.valueStatus === 'AVAILABLE' ? item.value : null,
            partial: item.coverage.partial,
            note: item.coverage.partial ? t('partialPeriod') : t(item.valueStatus),
          }))} />}
        {calendar.data?.values.some((item) => item.coverage.partial) && <p className="muted">{t('partialFootnote')}</p>}
      </section>

      {month && <section className="panel" aria-labelledby="day-calendar-title">
        <div className="panel-heading"><h2 id="day-calendar-title">{t('dailyCalendar')}</h2><span className="pill">{monthLabel(month, year)}</span></div>
        <ResourceNotice resource={days} />
        {days.data && <>
          <CoverageNotice coverage={days.data.summary.coverage} />
          <div className="day-grid">
            {weekdayLabels.map((day) => <span className="weekday" key={day}>{day}</span>)}
            {Array.from({ length: offset }, (_, i) => <span key={'offset-' + i} aria-hidden="true" />)}
            {days.data.values.map((day) => {
              const available = day.valueStatus === 'AVAILABLE' && day.value != null
              const caption = valueLabel(day.value, day.valueStatus)
              const description = available && day.origin ? t(day.origin) : t(day.valueStatus)
              const intensity = maximum && available ? Math.sqrt((day.value ?? 0) / maximum) : 0
              const dayClass = `day${available && day.value === 0 ? ' zero' : ''}${day.origin === 'MODEL_REDISTRIBUTED' ? ' estimated-day' : ''}`
              return <button key={day.date} type="button" className={dayClass}
                style={intensity ? { backgroundColor: `rgb(${Math.round(24 + 115 * intensity)} ${Math.round(30 + 6 * intensity)} ${Math.round(45 + 4 * intensity)})` } : undefined}
                aria-label={`${dateLabel(day.date)} · ${caption} · ${description}`}
                title={description} aria-pressed={date === day.date} disabled={!available} onClick={() => onDay(day.date)}>
                <span>{Number(day.date.slice(-2))}</span>
                <strong>{available ? caption : day.valueStatus === 'OUTSIDE_DATASET_RANGE' ? t('outsideShort') : t('missingShort')}</strong>
                {day.origin === 'MODEL_REDISTRIBUTED' && <small>{t('estimated')}</small>}
              </button>
            })}
          </div>
          <p className="muted">{t('dayCalendarKey')}</p>
        </>}
      </section>}
    </>
  )
}
