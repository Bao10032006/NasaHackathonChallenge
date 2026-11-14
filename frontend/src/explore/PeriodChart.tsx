import type { CalendarValue } from '../api/types'
import { formatDate } from '../lib/format'
import { MONTH_NAMES } from '../lib/labels'
import { ORIGIN_BADGE, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { useAppState, useDispatch } from '../state/AppState'
import { LineChart, OriginShapeLegend, type ChartPoint } from './LineChart'
import { calendarRequest } from './requests'
import { Card, CoverageChip, ErrorNote, ServedByBadge, UpdatingNote } from './ui'

function valueTitle(label: string, value: CalendarValue): string {
  if (value.valueStatus !== 'AVAILABLE' || value.value === null) {
    return `${label}: ngoài phạm vi dữ liệu`
  }
  const partial = value.partial
    ? ` · chưa đầy đủ (${formatDate(value.coverage.coveredStartDate)}–${formatDate(value.coverage.coveredEndDate)})`
    : ''
  const origin = value.origin ? ` · ${ORIGIN_BADGE[value.origin].label}` : ''
  return `${label}: ${readableValue(value.value)} snpp_eq${origin}${partial}`
}

/**
 * 12 months (or 73 five-day periods) of the selected year with the historical median baseline from
 * /calendar (target year excluded). Clicking a point selects that month / period.
 */
export function PeriodChart() {
  const state = useAppState()
  const dispatch = useDispatch()
  const { filters } = state
  const calendar = useApi(calendarRequest(state))
  const { data, stale } = currentOrPrevious(calendar)
  const pentad = filters.timeMode === 'pentad'
  const selected = pentad ? filters.pentad : filters.timeMode === 'year' ? null : filters.month
  const label = (period: number) => (pentad ? `K${period}` : `T${period}`)
  const longLabel = (period: number) => (pentad ? `Kỳ ${period}` : MONTH_NAMES[period - 1])

  return (
    <Card
      id="period-chart"
      title={pentad ? `73 kỳ 5 ngày năm ${filters.year}` : `Hoạt động 12 tháng năm ${filters.year}`}
      aside={<>
        <UpdatingNote show={stale} what="biểu đồ" />
        {calendar.status === 'success' && <ServedByBadge servedBy={calendar.servedBy} />}
      </>}
    >
      {calendar.status === 'error' && <ErrorNote error={calendar.error} onRetry={calendar.retry} context="biểu đồ" />}
      {data && (
        <div className={stale ? 'is-stale' : ''}>
          <div className="chips">
            <CoverageChip coverage={data.summary.coverage} />
            {data.summary.peakPeriod && (
              <span className="badge">★ Cao nhất: {longLabel(data.summary.peakPeriod.period)} ({readableValue(data.summary.peakPeriod.value)})</span>
            )}
          </div>
          <LineChart
            ariaLabel={`Biểu đồ ${pentad ? '73 kỳ 5 ngày' : '12 tháng'} năm ${data.year} và mức lịch sử`}
            xValues={data.values.map((value) => value.period)}
            xLabel={label}
            xTickEvery={pentad ? 6 : 1}
            selectedX={selected}
            onSelect={(period) => {
              const value = data.values.find((item) => item.period === period)
              if (value && value.valueStatus !== 'OUTSIDE_DATASET_RANGE') {
                dispatch(pentad ? { type: 'setPentad', pentad: period } : { type: 'setMonth', month: period })
              }
            }}
            series={[
              {
                id: 'year',
                label: `Năm ${data.year}`,
                color: '#c2410c',
                markers: true,
                points: data.values.map((value): ChartPoint => ({
                  x: value.period,
                  y: value.valueStatus === 'AVAILABLE' ? value.value : null,
                  origin: value.origin,
                  partial: value.partial,
                  title: valueTitle(longLabel(value.period), value),
                })),
              },
              ...(data.baseline ? [{
                id: 'baseline',
                label: `Mức lịch sử (trung vị ${data.baseline.referenceStartYear}–${data.baseline.referenceEndYear}${data.baseline.excludesTargetYear ? `, trừ ${data.year}` : ''})`,
                color: '#475569',
                dash: '6 4',
                points: data.baseline.values.map((value): ChartPoint => ({
                  x: value.period,
                  y: value.valueStatus === 'AVAILABLE' ? value.value : null,
                  title: value.valueStatus === 'AVAILABLE'
                    ? `Trung vị lịch sử: ${readableValue(value.value)} (${value.sampleSize} năm)`
                    : `Không đủ năm lịch sử (${value.sampleSize} năm)`,
                })),
              }] : []),
            ]}
          />
          <OriginShapeLegend />
          <p className="muted small">Bấm một {pentad ? 'kỳ' : 'tháng'} trên biểu đồ để xem bản đồ và lịch ngày của kỳ đó.</p>
        </div>
      )}
      {!data && calendar.status === 'loading' && <p className="muted" role="status">Đang tải biểu đồ…</p>}
    </Card>
  )
}
