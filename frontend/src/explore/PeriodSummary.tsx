import { Async, CoverageView, Fields, MetaView, OriginText, Panel, SelectionView, SourceCompositionTable, StatusText, TemporalSelectorView } from '../components/raw'
import { formatDate, formatValue } from '../lib/format'
import { useApi } from '../lib/useApi'
import { useAppState } from '../state/AppState'
import { calendarRequest, dailyRequest, dayCalendarRequest, mapRequest } from './requests'

/** Spatial selection + period actually resolved by the backend (from the map response). */
export function SelectionStatus() {
  const state = useAppState()
  const map = useApi(mapRequest(state))
  return (
    <Panel id="selection-status" title="Vùng và kỳ đang xem">
      <Async state={map}>
        {(data) => (
          <>
            <h3>Không gian</h3>
            <SelectionView selection={data.selection} />
            <h3>Thời gian</h3>
            <TemporalSelectorView selector={data.temporalSelector} />
          </>
        )}
      </Async>
    </Panel>
  )
}

/**
 * Summary card (wireframe v0.4 section 9): total + coverage for every period, peak month for a year,
 * peak day for a month, source composition for a date. Totals come from the API, never re-summed.
 */
export function PeriodSummary() {
  const state = useAppState()
  const { timeMode } = state.filters
  const map = useApi(mapRequest(state))
  const calendar = useApi(timeMode === 'year' ? calendarRequest(state) : null)
  const days = useApi(timeMode === 'month' ? dayCalendarRequest(state) : null)
  const daily = useApi(dailyRequest(state))

  return (
    <Panel id="period-summary" title="Tóm tắt kỳ">
      <Async state={map}>
        {(data) => (
          <>
            <Fields
              rows={[
                ['Tổng kỳ (snpp_eq)', formatValue(data.summary.totalValue)],
                ['Trạng thái', <StatusText key="status" status={data.summary.valueStatus} />],
                ['Nguồn gốc giá trị', <OriginText key="origin" origin={data.summary.origin} />],
                ['Ô thấp nhất / cao nhất', `${formatValue(data.summary.minCellValue)} / ${formatValue(data.summary.maxCellValue)}`],
              ]}
            />
            <CoverageView coverage={data.summary.coverage} />
            <MetaView meta={data.meta} />
          </>
        )}
      </Async>

      {timeMode === 'year' && (
        <Async state={calendar}>
          {(data) => (
            <Fields
              rows={[
                ['Tháng cao nhất (chỉ xét tháng đủ dữ liệu)', data.summary.peakPeriod
                  ? `Tháng ${data.summary.peakPeriod.period}: ${formatValue(data.summary.peakPeriod.value)}`
                  : 'Không có (mọi tháng bằng 0 hoặc chưa đủ dữ liệu)'],
              ]}
            />
          )}
        </Async>
      )}
      {timeMode === 'month' && (
        <Async state={days}>
          {(data) => (
            <Fields
              rows={[
                [data.summary.coverage.partial
                  ? 'Ngày cao nhất (trong khoảng đã có dữ liệu)'
                  : 'Ngày cao nhất', data.summary.peakDate
                  ? `${formatDate(data.summary.peakDate.date)}: ${formatValue(data.summary.peakDate.value)}`
                  : 'Không có (mọi ngày bằng 0)'],
              ]}
            />
          )}
        </Async>
      )}
      {timeMode === 'date' && (
        <Async state={daily}>
          {(data) => (
            <>
              <h3>Ngày {formatDate(data.date)}</h3>
              <Fields
                rows={[
                  ['Giá trị (snpp_eq)', formatValue(data.value)],
                  ['Trạng thái', <StatusText key="status" status={data.valueStatus} />],
                  ['Nguồn gốc giá trị', <OriginText key="origin" origin={data.origin} />],
                  ['Một phần (partial)', data.partial ? 'Có' : 'Không'],
                  ['Khoảng bất định theo ngày', 'Không có (dataset không cung cấp)'],
                ]}
              />
              <SourceCompositionTable sources={data.sourceComposition} />
              <MetaView meta={data.meta} />
            </>
          )}
        </Async>
      )}
      {timeMode === 'pentad' && <p>Pentad: xem tổng và đỉnh trong bảng 73 pentad bên dưới.</p>}
    </Panel>
  )
}
