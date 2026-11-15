import type { Calendar, Seasonality, Trends } from './api'
import { ResourceNotice } from './display'
import { useI18n } from '../i18n'
import { SeriesChart } from './SeriesChart'
import type { Resource } from './useResource'

export function HistoricalAnalysis({ month, calendar, trends, seasonality }: {
  month: number
  calendar: Resource<Calendar>
  trends: Resource<Trends>
  seasonality: Resource<Seasonality>
}) {
  const { t, monthLabel, shortMonth, detectionCount, detectionDifference } = useI18n()
  const baseline = calendar.data?.baseline
  const reference = baseline?.values.find((item) => item.period === month)
  const target = calendar.data?.values.find((item) => item.period === month)
  const delta = target?.value != null && target.valueStatus === 'AVAILABLE' && !target.coverage.partial &&
    reference?.valueStatus === 'AVAILABLE' && reference.value != null ? target.value - reference.value : null
  return (
    <section className="panel historical" aria-labelledby="historical-analysis-title">
      <div className="panel-heading"><h2 id="historical-analysis-title">{t('history')}</h2><span className="pill">{monthLabel(month)}</span></div>
      {reference && baseline && <dl className="baseline">
        <div><dt>{t('baseline')}</dt><dd>{reference.value == null ? t('INSUFFICIENT_BASELINE') : detectionCount(reference.value)}</dd></div>
        {delta != null && <div><dt>{t('samePeriodDifference')}</dt><dd>{detectionDifference(delta)}</dd></div>}
        <div><dt>{t('validYears')}</dt><dd>{reference.sampleSize}</dd></div>
        <div><dt>{t('referencePeriod')}</dt><dd>{baseline.referenceStartYear}–{baseline.referenceEndYear}</dd></div>
      </dl>}
      {baseline?.excludesTargetYear && <p className="muted">{t('baselineExclusion')}</p>}
      {calendar.data && delta == null && <p className="notice">{target?.coverage.partial
        ? t('partialMonth')
        : target?.valueStatus !== 'AVAILABLE' ? t('monthUnavailable')
          : t('historyUnavailable')}</p>}

      <div className="history-grid">
        <div><h3>{t('monthAcrossYears', { month: monthLabel(month) })}</h3>
          <ResourceNotice resource={trends} />
          {trends.data && <SeriesChart title={t('sameMonthAcrossYears')} points={trends.data.points.map((point) => ({
            key: point.year, label: String(point.year), value: point.valueStatus === 'AVAILABLE' ? point.value : null,
            partial: point.coverage.partial, note: point.coverage.partial ? t('partialPeriod') : t(point.valueStatus),
          }))} />}
        </div>
        <div><h3>{t('seasonality')}</h3>
          <ResourceNotice resource={seasonality} />
          {seasonality.data && <>
            <p className="muted">{t('median')} {seasonality.data.referenceStartYear}–{seasonality.data.referenceEndYear}</p>
            <SeriesChart title={t('seasonality')} points={seasonality.data.periods.map((item) => ({
              key: item.period, label: shortMonth(item.period), value: item.valueStatus === 'AVAILABLE' ? item.median : null,
              note: item.valueStatus === 'AVAILABLE' ? t('validYearsCount', { count: item.sampleSize }) : t(item.valueStatus),
            }))} />
          </>}
        </div>
      </div>
    </section>
  )
}
