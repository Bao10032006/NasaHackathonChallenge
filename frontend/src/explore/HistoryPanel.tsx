import type { CalendarResponse } from '../api/types'
import { formatDate, formatValue } from '../lib/format'
import { MONTH_NAMES } from '../lib/labels'
import { ORIGIN_BADGE, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { calendarGranularity, trendParameters, useAppState, useDispatch } from '../state/AppState'
import { useMetadata } from '../state/Metadata'
import { LineChart, OriginShapeLegend, type ChartPoint } from './LineChart'
import { calendarRequest, seasonalityRequest, trendsRequest } from './requests'
import { Card, ErrorNote, ServedByBadge, UpdatingNote } from '../components/ui'

/**
 * Quantitative comparison of the selected month / five-day period with its historical median
 * (/calendar baseline, target year excluded). The delta is hidden, with the reason, when the period
 * is incomplete or the baseline has fewer valid years than required. No anomaly label (deferred in v0.4).
 */
function BaselineComparison({ calendar, period, pentad }: { calendar: CalendarResponse; period: number; pentad: boolean }) {
  const value = calendar.values.find((item) => item.period === period)
  const baseline = calendar.baseline?.values.find((item) => item.period === period)
  const name = pentad ? `Kỳ ${period}` : MONTH_NAMES[period - 1]
  if (!value || !calendar.baseline || !baseline) {
    return <p className="muted">Chưa có mức lịch sử cho kỳ này.</p>
  }
  let reason: string | null = null
  if (value.valueStatus !== 'AVAILABLE' || value.value === null) {
    reason = 'Kỳ đang chọn nằm ngoài phạm vi dữ liệu.'
  } else if (value.partial) {
    reason = `Kỳ đang chọn chưa đầy đủ dữ liệu (có ${formatDate(value.coverage.coveredStartDate)}–${formatDate(value.coverage.coveredEndDate)}), không so được với các năm đủ kỳ.`
  } else if (baseline.valueStatus !== 'AVAILABLE' || baseline.value === null) {
    reason = `Chỉ có ${baseline.sampleSize} năm hợp lệ, chưa đủ để làm mức tham chiếu.`
  }
  const delta = reason === null ? (value.value as number) - (baseline.value as number) : null
  const percent = delta !== null && (baseline.value as number) > 0 ? (delta / (baseline.value as number)) * 100 : null

  return (
    <div className="comparison">
      <dl className="stat-row">
        <div>
          <dt>{name}/{calendar.year}</dt>
          <dd>{value.value === null ? '—' : readableValue(value.value)}</dd>
        </div>
        <div>
          <dt>Mức tham chiếu (trung vị)</dt>
          <dd>{baseline.value === null ? '—' : readableValue(baseline.value)}</dd>
        </div>
        <div>
          <dt>Chênh lệch</dt>
          <dd>
            {delta === null ? 'Ẩn' : `${delta > 0 ? '+' : ''}${readableValue(delta)}`}
            {percent !== null && <span className="muted small"> ({percent > 0 ? '+' : ''}{percent.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%)</span>}
          </dd>
        </div>
      </dl>
      <p className="muted small">
        Tham chiếu: trung vị cùng {pentad ? 'kỳ' : 'tháng'} các năm {calendar.baseline.referenceStartYear}–{calendar.baseline.referenceEndYear}
        {calendar.baseline.excludesTargetYear && `, không tính năm ${calendar.year}`} · {baseline.sampleSize} năm hợp lệ.
        Đây là so sánh định lượng với lịch sử, không phải nhãn bất thường.
      </p>
      {reason && <p className="note">Không tính chênh lệch: {reason}</p>}
    </div>
  )
}

export function HistoryPanel() {
  const state = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const { filters } = state
  const yearRange = metadata?.yearRange ?? { start: 2000, end: 2026 }
  const { granularity, period } = trendParameters(filters)
  const pentad = calendarGranularity(filters) === 'pentad'
  const trends = useApi(trendsRequest(state, yearRange))
  const seasonality = useApi(seasonalityRequest(state))
  const calendar = useApi(calendarRequest(state))
  const trendsView = currentOrPrevious(trends)
  const seasonalityView = currentOrPrevious(seasonality)
  const periodName = granularity === 'year' ? 'cả năm' : granularity === 'month' ? MONTH_NAMES[(period ?? 1) - 1] : `kỳ 5 ngày ${period}`
  const seasonX = pentad ? Array.from({ length: 73 }, (_, index) => index + 1) : Array.from({ length: 12 }, (_, index) => index + 1)
  const seasonLabel = (x: number) => (pentad ? `K${x}` : `T${x}`)

  return (
    <Card id="history" title="Phân tích lịch sử" className="history-card">
      <h3>Đối chiếu với mức lịch sử</h3>
      {period === null ? (
        <p className="muted">Chọn một tháng (hoặc kỳ 5 ngày) để so với mức điển hình của cùng kỳ các năm trước.</p>
      ) : calendar.status === 'success' ? (
        <BaselineComparison calendar={calendar.data} period={period} pentad={granularity === 'pentad'} />
      ) : calendar.status === 'error' ? (
        <ErrorNote error={calendar.error} onRetry={calendar.retry} context="mức lịch sử" />
      ) : (
        <p className="muted" role="status">Đang tải mức lịch sử…</p>
      )}

      <div className="history-charts">
      <div className="history-col">
      <div className="section-head">
        <h3>{granularity === 'year' ? 'Tổng năm qua các năm' : `Cùng ${periodName} qua các năm`}</h3>
        <UpdatingNote show={trendsView.stale} what="xu hướng" />
        {trends.status === 'success' && <ServedByBadge servedBy={trends.servedBy} />}
      </div>
      {trends.status === 'error' && <ErrorNote error={trends.error} onRetry={trends.retry} context="xu hướng" />}
      {trendsView.data && (
        <div className={trendsView.stale ? 'is-stale' : ''}>
          <LineChart
            ariaLabel={`Giá trị ${periodName} từ ${yearRange.start} đến ${yearRange.end}`}
            xValues={trendsView.data.points.map((point) => point.year)}
            xLabel={(year) => `'${String(year).slice(2)}`}
            xTickEvery={2}
            selectedX={filters.year}
            onSelect={(year) => dispatch({ type: 'setYear', year })}
            series={[{
              id: 'trend',
              label: `${periodName} từng năm`,
              color: '#fcd34d',
              markers: true,
              area: true,
              points: trendsView.data.points.map((point): ChartPoint => ({
                x: point.year,
                y: point.valueStatus === 'AVAILABLE' ? point.value : null,
                origin: point.origin,
                partial: point.partial,
                title: point.valueStatus === 'AVAILABLE'
                  ? `${point.year}: ${readableValue(point.value)} snpp_eq${point.origin ? ` · ${ORIGIN_BADGE[point.origin].label}` : ''}${point.partial ? ` · chưa đầy đủ (${point.coverage.coveredDayCount}/${point.coverage.expectedDayCount} ngày)` : ''}`
                  : `${point.year}: ngoài phạm vi dữ liệu`,
              })),
            }]}
          />
          <OriginShapeLegend />
          <p className="muted small">
            Trước 2012 giá trị là ước lượng hài hòa từ MODIS (Terra/Aqua); từ 2012 là quan sát VIIRS. Bấm một năm để xem năm đó.
          </p>
        </div>
      )}

      </div>
      <div className="history-col">
      <div className="section-head">
        <h3>Mẫu hình mùa vụ {pentad ? '73 kỳ' : '12 tháng'}</h3>
        <UpdatingNote show={seasonalityView.stale} what="mẫu hình mùa vụ" />
        {seasonality.status === 'success' && <ServedByBadge servedBy={seasonality.servedBy} />}
      </div>
      {seasonality.status === 'error' && <ErrorNote error={seasonality.error} onRetry={seasonality.retry} context="mẫu hình mùa vụ" />}
      {seasonalityView.data && (
        <div className={seasonalityView.stale ? 'is-stale' : ''}>
          <LineChart
            ariaLabel="Mẫu hình mùa vụ: trung bình, trung vị và năm đang xem"
            xValues={seasonX}
            xLabel={seasonLabel}
            xTickEvery={pentad ? 6 : 1}
            selectedX={period ?? undefined}
            series={[
              {
                id: 'median',
                label: `Trung vị ${seasonalityView.data.referenceStartYear}–${seasonalityView.data.referenceEndYear}`,
                color: '#a78bfa',
                area: true,
                points: seasonalityView.data.periods.map((item): ChartPoint => ({
                  x: item.period,
                  y: item.valueStatus === 'AVAILABLE' ? item.median : null,
                  title: item.valueStatus === 'AVAILABLE'
                    ? `Trung vị ${readableValue(item.median)} · trung bình ${readableValue(item.mean)} · ${item.sampleSize} năm`
                    : `Không đủ năm (${item.sampleSize}/${seasonalityView.data?.minimumSampleSize})`,
                })),
              },
              {
                id: 'mean',
                label: 'Trung bình',
                color: '#64748b',
                dash: '2 4',
                points: seasonalityView.data.periods.map((item): ChartPoint => ({
                  x: item.period,
                  y: item.valueStatus === 'AVAILABLE' ? item.mean : null,
                  title: `Trung bình ${formatValue(item.mean)}`,
                })),
              },
              ...(calendar.status === 'success' ? [{
                id: 'current',
                label: `Năm ${calendar.data.year}`,
                color: '#ff8a4c',
                markers: true,
                points: calendar.data.values.map((value): ChartPoint => ({
                  x: value.period,
                  y: value.valueStatus === 'AVAILABLE' ? value.value : null,
                  origin: value.origin,
                  partial: value.partial,
                  title: value.valueStatus === 'AVAILABLE'
                    ? `${calendar.data.year}: ${readableValue(value.value)}${value.partial ? ' (chưa đầy đủ)' : ''}`
                    : `${calendar.data.year}: ngoài phạm vi`,
                })),
              }] : []),
            ]}
          />
          <p className="muted small">
            Chỉ dùng các kỳ đủ dữ liệu; cần ít nhất {seasonalityView.data.minimumSampleSize} năm hợp lệ cho mỗi kỳ.
            Tổng theo mùa và phân loại bất thường chưa thuộc phạm vi v0.4.
          </p>
        </div>
      )}
      </div>
      </div>
    </Card>
  )
}
