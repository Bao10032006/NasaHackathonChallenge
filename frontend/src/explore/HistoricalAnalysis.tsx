import type { Calendar, Seasonality, Trends } from './api'
import { ResourceNotice, number, statusLabels } from './display'
import { SeriesChart } from './SeriesChart'
import type { Resource } from './useResource'

export function HistoricalAnalysis({ month, calendar, trends, seasonality }: {
  month: number
  calendar: Resource<Calendar>
  trends: Resource<Trends>
  seasonality: Resource<Seasonality>
}) {
  const baseline = calendar.data?.baseline
  const reference = baseline?.values.find((item) => item.period === month)
  const target = calendar.data?.values.find((item) => item.period === month)
  const delta = target?.value != null && target.valueStatus === 'AVAILABLE' && !target.coverage.partial &&
    reference?.valueStatus === 'AVAILABLE' && reference.value != null ? target.value - reference.value : null
  return (
    <section className="panel historical" aria-labelledby="historical-analysis-title">
      <div className="panel-heading"><h2 id="historical-analysis-title">Phân tích lịch sử</h2><span className="pill">Tháng {month}</span></div>
      {reference && baseline && <dl className="baseline">
        <div><dt>Mức tham chiếu</dt><dd>{reference.value == null ? 'Không đủ mẫu' : number(reference.value)}</dd></div>
        {delta != null && <div><dt>Chênh lệch cùng kỳ</dt><dd>{delta > 0 ? '+' : ''}{number(delta)}</dd></div>}
        <div><dt>Số năm hợp lệ</dt><dd>{reference.sampleSize}</dd></div>
        <div><dt>Dải tham chiếu</dt><dd>{baseline.referenceStartYear}–{baseline.referenceEndYear}</dd></div>
      </dl>}
      {baseline?.excludesTargetYear && <p className="muted">Mức tham chiếu loại năm đang xem.</p>}
      {calendar.data && delta == null && <p className="notice">{target?.coverage.partial
        ? 'Tháng đang xem chưa đầy đủ để đối chiếu.'
        : target?.valueStatus !== 'AVAILABLE' ? 'Tháng đang xem không có giá trị để đối chiếu.'
          : 'Không đủ dữ liệu lịch sử để đối chiếu.'}</p>}

      <div className="history-grid">
        <div><h3>Tháng {month} qua các năm</h3>
          <ResourceNotice resource={trends} />
          {trends.data && <SeriesChart title="Cùng tháng qua các năm" points={trends.data.points.map((point) => ({
            key: point.year, label: String(point.year), value: point.valueStatus === 'AVAILABLE' ? point.value : null,
            partial: point.coverage.partial, note: point.coverage.partial ? 'Kỳ chưa đầy đủ' : statusLabels[point.valueStatus],
          }))} />}
        </div>
        <div><h3>Mẫu hình mùa vụ 12 tháng</h3>
          <ResourceNotice resource={seasonality} />
          {seasonality.data && <>
            <p className="muted">Trung vị {seasonality.data.referenceStartYear}–{seasonality.data.referenceEndYear}</p>
            <SeriesChart title="Mẫu hình mùa vụ 12 tháng" points={seasonality.data.periods.map((item) => ({
              key: item.period, label: 'T' + item.period, value: item.valueStatus === 'AVAILABLE' ? item.median : null,
              note: item.valueStatus === 'AVAILABLE' ? item.sampleSize + ' năm hợp lệ' : statusLabels[item.valueStatus],
            }))} />
          </>}
        </div>
      </div>
    </section>
  )
}
