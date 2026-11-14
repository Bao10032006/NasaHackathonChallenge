import { api } from '../api/client'
import type { MapCellsResponse } from '../api/types'
import { Async, CoverageView, ErrorView, Fields, MetaView, OriginText, Panel, SelectionView, StatusValue } from '../components/raw'
import { INCOMPATIBILITY_COPY, compareMaps } from '../lib/compare'
import { formatDelta, formatValue } from '../lib/format'
import { MONTHS } from '../lib/time'
import { useApi, type ApiState } from '../lib/useApi'
import { toSpatialQuery, useAppState, useDispatch } from '../state/AppState'
import { useMetadata } from '../state/Metadata'

/**
 * Dual-map comparison (Contract v0.4 section 7, wireframe v0.4 section 5): two /map/cells calls for the
 * same spatial selection and month in two years. Totals come from each map summary; deltas are shown
 * only when the comparison is compatible.
 */
function MapSide({ label, state }: { label: string; state: ApiState<MapCellsResponse> & { retry: () => void } }) {
  return (
    <section data-compare-side={label}>
      <h3>Bản đồ {label}</h3>
      <Async state={state}>
        {(data) => (
          <>
            <Fields
              rows={[
                ['Tổng kỳ', <StatusValue key="total" value={data.summary.totalValue} status={data.summary.valueStatus} />],
                ['Nguồn gốc giá trị', <OriginText key="origin" origin={data.summary.origin} />],
                ['Ô thấp nhất / cao nhất', `${formatValue(data.summary.minCellValue)} / ${formatValue(data.summary.maxCellValue)}`],
              ]}
            />
            <CoverageView coverage={data.summary.coverage} />
            <MetaView meta={data.meta} />
          </>
        )}
      </Async>
    </section>
  )
}

export default function CompareScreen() {
  const { dataSource, filters, compare } = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const spatial = toSpatialQuery(filters.spatial)
  const mapA = useApi(api.mapCells(dataSource, spatial, { kind: 'month', year: compare.yearA, month: compare.month }))
  const mapB = useApi(api.mapCells(dataSource, spatial, { kind: 'month', year: compare.yearB, month: compare.month }))
  const yearStart = metadata?.yearRange.start ?? 2000
  const yearEnd = metadata?.yearRange.end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearStart + index)
  const comparison = mapA.status === 'success' && mapB.status === 'success' ? compareMaps(mapA.data, mapB.data) : null

  return (
    <div data-screen="compare">
      <Panel id="compare-filters" title="So sánh hai bản đồ">
        <p>Dùng cùng vùng đang chọn ở màn Khám phá; chọn một tháng và hai năm.</p>
        <label>
          Tháng
          <select value={compare.month} onChange={(event) => dispatch({ type: 'setCompare', compare: { month: Number(event.target.value) } })}>
            {MONTHS.map((month) => <option key={month} value={month}>Tháng {month}</option>)}
          </select>
        </label>
        <label>
          Năm A
          <select value={compare.yearA} onChange={(event) => dispatch({ type: 'setCompare', compare: { yearA: Number(event.target.value) } })}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          Năm B
          <select value={compare.yearB} onChange={(event) => dispatch({ type: 'setCompare', compare: { yearB: Number(event.target.value) } })}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        {mapA.status === 'success' && <SelectionView selection={mapA.data.selection} />}
      </Panel>

      <Panel id="compare-compatibility" title="Kiểm tra tương thích">
        {comparison ? (
          <>
            <Fields
              rows={[
                ['Được tính chênh lệch', comparison.differenceAvailable ? 'Có' : 'Không'],
                ['Chênh lệch toàn vùng (B − A)', comparison.differenceAvailable
                  ? formatDelta(comparison.areaDelta)
                  : 'Ẩn vì hai kỳ không tương thích'],
                ['Thang màu chung (min – max)', comparison.colorDomain
                  ? `${formatValue(comparison.colorDomain.min)} – ${formatValue(comparison.colorDomain.max)}`
                  : '—'],
              ]}
            />
            {comparison.reasons.length > 0 && (
              <ul>
                {comparison.reasons.map((reason) => (
                  <li key={reason}><code>{reason}</code> — {INCOMPATIBILITY_COPY[reason]}</li>
                ))}
              </ul>
            )}
            <p>Khác nguồn gốc (quan sát và ước lượng) không làm mất tương thích, nhưng luôn hiển thị nguồn gốc cạnh giá trị.</p>
          </>
        ) : (
          <p>Cần tải xong cả hai bản đồ.</p>
        )}
        {mapA.status === 'error' && <ErrorView error={mapA.error} onRetry={mapA.retry} />}
        {mapB.status === 'error' && <ErrorView error={mapB.error} onRetry={mapB.retry} />}
      </Panel>

      <Panel id="compare-maps" title={`Tháng ${compare.month}: ${compare.yearA} (A) và ${compare.yearB} (B)`}>
        <MapSide label={`A · ${compare.yearA}`} state={mapA} />
        <MapSide label={`B · ${compare.yearB}`} state={mapB} />
        {comparison && (
          <table>
            <caption>So sánh từng ô (chênh lệch chỉ hiện khi tương thích và cả hai ô có dữ liệu)</caption>
            <thead>
              <tr>
                <th>Ô</th>
                <th>A: giá trị</th>
                <th>A: origin</th>
                <th>B: giá trị</th>
                <th>B: origin</th>
                <th>Chênh lệch (B − A)</th>
                <th>Lý do không tính</th>
              </tr>
            </thead>
            <tbody>
              {comparison.cells.map((cell) => (
                <tr key={cell.cellId}>
                  <td>{cell.cellId}</td>
                  <td>{cell.a ? <StatusValue value={cell.a.value} status={cell.a.valueStatus} /> : '—'}</td>
                  <td>{cell.a ? <OriginText origin={cell.a.origin} /> : '—'}</td>
                  <td>{cell.b ? <StatusValue value={cell.b.value} status={cell.b.valueStatus} /> : '—'}</td>
                  <td>{cell.b ? <OriginText origin={cell.b.origin} /> : '—'}</td>
                  <td>{formatDelta(cell.delta)}</td>
                  <td>{cell.reason ? <code>{cell.reason}</code> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
