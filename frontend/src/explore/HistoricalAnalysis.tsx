import { Async, CoverageBadge, MetaView, OriginText, Panel, StatusValue } from '../components/raw'
import { formatValue } from '../lib/format'
import { useApi } from '../lib/useApi'
import { trendParameters, useAppState } from '../state/AppState'
import { useMetadata } from '../state/Metadata'
import { seasonalityRequest, trendsRequest } from './requests'

const PERIOD_LABEL = { year: 'cả năm', month: 'tháng', pentad: 'pentad' } as const

/** Same period across years (/trends) and the seasonal pattern (/seasonality). Backend: TASK 03B3. */
export function HistoricalAnalysis() {
  const state = useAppState()
  const metadata = useMetadata()
  const yearRange = metadata?.yearRange ?? { start: 2000, end: 2026 }
  const { granularity, period } = trendParameters(state.filters)
  const trends = useApi(trendsRequest(state, yearRange))
  const seasonality = useApi(seasonalityRequest(state))

  return (
    <Panel id="historical-analysis" title="Phân tích lịch sử">
      <h3>
        Cùng {PERIOD_LABEL[granularity]}{period === null ? '' : ` ${period}`} qua các năm ({yearRange.start}–{yearRange.end})
      </h3>
      <Async state={trends}>
        {(data) => (
          <>
            <table>
              <thead>
                <tr>
                  <th>Năm</th>
                  <th>Giá trị</th>
                  <th>Trạng thái</th>
                  <th>Phạm vi dữ liệu</th>
                  <th>Origin</th>
                </tr>
              </thead>
              <tbody>
                {data.points.map((point) => (
                  <tr key={point.year} data-status={point.valueStatus} data-partial={point.partial}>
                    <td>{point.year}</td>
                    <td><StatusValue value={point.value} status={point.valueStatus} /></td>
                    <td>{point.valueStatus}</td>
                    <td><CoverageBadge coverage={point.coverage} /></td>
                    <td><OriginText origin={point.origin} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MetaView meta={data.meta} />
          </>
        )}
      </Async>

      <h3>Mẫu hình mùa vụ</h3>
      <Async state={seasonality}>
        {(data) => (
          <>
            <p>
              Thống kê các năm {data.referenceStartYear}–{data.referenceEndYear}, chỉ dùng kỳ đủ dữ liệu, cần tối thiểu {data.minimumSampleSize} năm.
            </p>
            <table>
              <thead>
                <tr>
                  <th>{data.granularity === 'month' ? 'Tháng' : 'Pentad'}</th>
                  <th>Trung bình</th>
                  <th>Trung vị</th>
                  <th>Số năm hợp lệ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.periods.map((item) => (
                  <tr key={item.period} data-status={item.valueStatus}>
                    <td>{item.period}</td>
                    <td>{item.valueStatus === 'AVAILABLE' ? formatValue(item.mean) : '—'}</td>
                    <td><StatusValue value={item.median} status={item.valueStatus} /></td>
                    <td>{item.sampleSize}</td>
                    <td>{item.valueStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MetaView meta={data.meta} />
          </>
        )}
      </Async>
    </Panel>
  )
}
