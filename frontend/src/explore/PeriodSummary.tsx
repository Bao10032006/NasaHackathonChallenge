import type { Origin, SourceContribution, Summary } from './api'
import { CoverageNotice, number, origins, sources, valueLabel } from './display'

export function SourceList({ items }: { items: SourceContribution[] }) {
  return <ul className="sources">{items.map((entry) => <li key={entry.source}>
    <div><strong>{sources[entry.source]}</strong><small>{origins[entry.origin]} · {number(entry.contributingCellDayCount)} ô-ngày đóng góp</small></div>
    <span>{number(entry.harmonizedValue)}</span>
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
  return (
    <section className="panel period-summary" aria-labelledby="period-summary-title">
      <div className="panel-heading"><h2 id="period-summary-title">Tóm tắt vùng</h2><span className="pill">{period}</span></div>
      {summary && <>
        <div className="summary-metrics">
          <div className="metric">
            <span>Tổng kỳ đang xem</span>
            <strong className="summary-number">{valueLabel(summary.totalValue, summary.valueStatus)}</strong>
            <small>Số phát hiện tương đương S-NPP</small>
          </div>
          {peak && <div className="metric peak">
            <span>Thời điểm nổi bật{summary.coverage.partial ? ' trong khoảng đã có dữ liệu' : ''}</span>
            <strong>{peak.label} · {number(peak.value)}</strong>
          </div>}
          <div className="metric">
            <span>Phạm vi dữ liệu</span>
            <CoverageNotice coverage={summary.coverage} />
            {origin && <small className="origin">{origins[origin]}</small>}
          </div>
        </div>
      </>}
      {sourceNotice}
      {contributions?.length ? <><h3>Nguồn đóng góp</h3><SourceList items={contributions} /></> : null}
    </section>
  )
}
