import type { Origin, SourceContribution, Summary } from './api'
import { CountUp, CoverageNotice, sources } from './display'
import { useI18n } from '../i18n'

export function SourceList({ items }: { items: SourceContribution[] }) {
  const { t, number, detectionCount } = useI18n()
  return <ul className="sources">{items.map((entry) => <li key={entry.source}>
    <div><strong>{sources[entry.source]}</strong><small>{t(entry.origin)} · {t('cellDays', { count: number(entry.contributingCellDayCount) })}</small></div>
    <span>{detectionCount(entry.harmonizedValue)}</span>
  </li>)}</ul>
}

export function PeriodSummary({ period, summary, peak, origin, contributions, sourceNotice }: {
  period: string
  summary?: Summary
  peak?: { label: string; value: number }
  origin?: Origin | null
  contributions?: SourceContribution[]
  sourceNotice?: React.ReactNode
}) {
  const { t, valueLabel, detectionCount } = useI18n()
  return (
    <section className="panel period-summary" aria-labelledby="period-summary-title">
      <div className="panel-heading"><h2 id="period-summary-title">{t('areaSummary')}</h2><span className="pill">{period}</span></div>
      {summary && <>
        <div className="summary-metrics">
          <div className="metric">
            <span>{t('periodTotal')}</span>
            <strong className="summary-number">{summary.totalValue != null && summary.valueStatus === 'AVAILABLE'
              ? <CountUp value={summary.totalValue} format={(value) => valueLabel(value, 'AVAILABLE')} />
              : valueLabel(summary.totalValue, summary.valueStatus)}</strong>
            <small>{t('metric')}</small>
          </div>
          {peak && <div className="metric peak">
            <span>{t(summary.coverage.partial ? 'partialPeak' : 'peak')}</span>
            <strong>{peak.label} · {detectionCount(peak.value)}</strong>
          </div>}
          <div className="metric">
            <span>{t('coverage')}</span>
            <CoverageNotice coverage={summary.coverage} />
            {origin && <small className="origin">{t(origin)}</small>}
          </div>
        </div>
      </>}
      {sourceNotice}
      {contributions?.length ? <details>
        <summary>{t('satelliteSources')}</summary>
        <SourceList items={contributions} />
      </details> : null}
    </section>
  )
}
