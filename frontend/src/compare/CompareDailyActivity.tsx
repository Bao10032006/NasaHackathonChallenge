import { endpoint } from '../explore/api'
import type { Days, SpatialQuery } from '../explore/api'
import { CoverageNotice, ResourceNotice } from '../explore/display'
import { useI18n } from '../i18n'
import { SeriesChart } from '../explore/SeriesChart'
import { useResource } from '../explore/useResource'
import type { Resource } from '../explore/useResource'

type Day = Days['values'][number]

function DailyStats({ side, year, resource }: { side: 'A' | 'B'; year: number; resource: Resource<Days> }) {
  const { t, dateLabel, detectionCount, valueLabel } = useI18n()
  const data = resource.data
  const available = data?.values.filter((day) => day.valueStatus === 'AVAILABLE' && day.value != null) ?? []
  const positive = available.filter((day) => day.value! > 0).length
  const peak = data?.summary.peakDate

  return (
    <section className="metric compare-daily-stats" aria-label={`${t('dailyStats')} ${side} · ${year}`}>
      <h3><i className={`daily-key daily-key-${side.toLowerCase()}`} aria-hidden="true" />{side} · {year}</h3>
      <ResourceNotice resource={resource} />
      {data && <>
        <CoverageNotice coverage={data.summary.coverage} />
        <dl>
          <dt>{t('totalDetections')}</dt>
          <dd><strong>{valueLabel(data.summary.totalValue, data.summary.valueStatus)}</strong></dd>
          {available.length > 0 && <><dt>{t('daysWithActivity')}</dt><dd>{t('daysWithData', { active: positive, available: available.length })}</dd></>}
          {peak && <><dt>{t('peakDay')}</dt><dd>{dateLabel(peak.date)} · <strong>{detectionCount(peak.value)}</strong></dd></>}
        </dl>
      </>}
    </section>
  )
}

export function CompareDailyActivity({ spatial, month, yearA, yearB }: {
  spatial: SpatialQuery
  month: number
  yearA: number
  yearB: number
}) {
  const { t, dateLabel, monthLabel, valueLabel } = useI18n()
  const a = useResource<Days>(endpoint('/calendar/days', { ...spatial, year: yearA, month }))
  const b = useResource<Days>(endpoint('/calendar/days', { ...spatial, year: yearB, month }))
  const daysA = a.data?.values ?? []
  const daysB = b.data?.values ?? []
  const length = Math.max(daysA.length, daysB.length)
  const dayNumbers = Array.from({ length }, (_, index) => index + 1)

  function dayDetail(day?: Day) {
    if (!day) return '—'
    const label = valueLabel(day.value, day.valueStatus)
    return day.origin ? label + ' · ' + t(day.origin) : label
  }

  function points(days: Day[]) {
    return dayNumbers.map((day) => {
      const item = days[day - 1]
      return {
        key: day,
        label: String(day),
        value: item?.valueStatus === 'AVAILABLE' ? item.value : null,
        note: item ? dateLabel(item.date) : undefined,
      }
    })
  }

  return (
    <section className="panel compare-daily" aria-labelledby="compare-daily-title">
      <div className="panel-heading">
        <h2 id="compare-daily-title">{t('dailyActivity')}</h2><span className="pill">{monthLabel(month)}</span>
      </div>
      <div className="compare-totals">
        <DailyStats side="A" year={yearA} resource={a} />
        <DailyStats side="B" year={yearB} resource={b} />
      </div>
      {length > 0 && <>
        <p className="muted">{t('dailyCompareHint')}</p>
        <SeriesChart title={t('dailyComparison')} points={points(daysA)} comparison={points(daysB)} />
        <details className="series-table compare-daily-table">
          <summary>{t('viewDailyTable')}</summary>
          <table>
            <thead><tr><th scope="col">{t('day')}</th><th scope="col">A · {yearA}</th><th scope="col">B · {yearB}</th></tr></thead>
            <tbody>
              {dayNumbers.map((day) => (
                <tr key={day}><th scope="row">{day}</th><td>{dayDetail(daysA[day - 1])}</td><td>{dayDetail(daysB[day - 1])}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </>}
    </section>
  )
}
