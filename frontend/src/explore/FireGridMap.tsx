import type { Bounds, MapCellValue } from '../api/types'
import { Async, OriginText, Panel, StatusValue } from '../components/raw'
import { SOURCE_LABEL, formatInteger, formatValue } from '../lib/format'
import { useApi } from '../lib/useApi'
import { useAppState, useDispatch } from '../state/AppState'
import { mapRequest } from './requests'

/**
 * Plain geometric preview of the returned cells: one rectangle per 0.25° cell, grey level from the
 * API min/max. It is deliberately unstyled; the production map replaces it. Markers are grid-cell
 * centres, never raw hotspot coordinates.
 */
function RawCellPreview({
  cells,
  frame,
  domain,
  selectedCellId,
  onSelect,
}: {
  cells: MapCellValue[]
  frame: Bounds
  domain: { min: number | null; max: number | null }
  selectedCellId: string | null
  onSelect: (cellId: string) => void
}) {
  const width = frame.east - frame.west
  const height = frame.north - frame.south
  const span = domain.max !== null && domain.min !== null && domain.max > domain.min ? domain.max - domain.min : 1
  return (
    <svg
      viewBox={`${frame.west} ${-frame.north} ${width} ${height}`}
      width="100%"
      style={{ maxWidth: 480, aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label="Xem nhanh hình học các ô lưới đã chọn"
    >
      {cells.map((cell) => {
        const intensity = cell.value === null || domain.min === null ? 0 : (cell.value - domain.min) / span
        return (
          <rect
            key={cell.cellId}
            x={cell.bounds.west}
            y={-cell.bounds.north}
            width={cell.bounds.east - cell.bounds.west}
            height={cell.bounds.north - cell.bounds.south}
            fill={cell.valueStatus === 'AVAILABLE' ? `rgba(0,0,0,${0.08 + 0.85 * intensity})` : 'none'}
            stroke={cell.cellId === selectedCellId ? 'black' : 'grey'}
            strokeWidth={cell.cellId === selectedCellId ? 0.03 : 0.005}
            onClick={() => onSelect(cell.cellId)}
          >
            <title>{`${cell.cellId}: ${formatValue(cell.value)} (${cell.valueStatus})`}</title>
          </rect>
        )
      })}
      {cells.map((cell) => (
        <circle key={`${cell.cellId}-c`} cx={cell.center.lon} cy={-cell.center.lat} r={0.012} fill="grey" />
      ))}
    </svg>
  )
}

export function FireGridMap() {
  const state = useAppState()
  const dispatch = useDispatch()
  const map = useApi(mapRequest(state))
  const selectedCellId = state.filters.selectedCellId
  const select = (cellId: string) => dispatch({ type: 'selectCell', cellId })

  return (
    <Panel id="fire-grid-map" title="Bản đồ lưới 0,25° (dữ liệu thô)">
      <Async state={map}>
        {(data) => {
          const exactDate = data.temporalSelector.type === 'DATE'
          return (
            <>
              <p>
                Chấm là tâm ô lưới 0,25°, không phải vị trí điểm cháy thực. Thang xám dùng
                min/max từ API: {formatValue(data.summary.minCellValue)} – {formatValue(data.summary.maxCellValue)}.
              </p>
              <RawCellPreview
                cells={data.cells}
                frame={data.selection.selectedBounds}
                domain={{ min: data.summary.minCellValue, max: data.summary.maxCellValue }}
                selectedCellId={selectedCellId}
                onSelect={select}
              />
              <table>
                <caption>{data.cells.length} ô · bấm một dòng để xem chi tiết nguồn của ô</caption>
                <thead>
                  <tr>
                    <th>Ô</th>
                    <th>Tâm (vĩ, kinh)</th>
                    <th>Biên (T, N, Đ, B)</th>
                    <th>Giá trị</th>
                    <th>Trạng thái</th>
                    <th>Một phần</th>
                    <th>Origin</th>
                    {exactDate && (
                      <>
                        <th>Mã nguồn</th>
                        <th>Vệ tinh</th>
                        <th>Số phát hiện đầu vào</th>
                        <th>Đầu vào hợp lệ</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.cells.map((cell) => (
                    <tr
                      key={cell.cellId}
                      aria-selected={cell.cellId === selectedCellId}
                      data-status={cell.valueStatus}
                      onClick={() => select(cell.cellId)}
                    >
                      <td><button type="button" onClick={() => select(cell.cellId)}>{cell.cellId}</button></td>
                      <td>{cell.center.lat}, {cell.center.lon}</td>
                      <td>{cell.bounds.west}, {cell.bounds.south}, {cell.bounds.east}, {cell.bounds.north}</td>
                      <td><StatusValue value={cell.value} status={cell.valueStatus} /></td>
                      <td>{cell.valueStatus}</td>
                      <td>{cell.partial ? 'Có' : 'Không'}</td>
                      <td><OriginText origin={cell.origin} /></td>
                      {exactDate && (
                        <>
                          <td>{cell.sourceCode ?? '—'}</td>
                          <td>{cell.source ? `${cell.source} · ${SOURCE_LABEL[cell.source]}` : '—'}</td>
                          <td>{formatInteger(cell.inputObservationCount)}</td>
                          <td>{cell.sourceInputValid === undefined ? '—' : cell.sourceInputValid ? 'Có' : 'Không'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        }}
      </Async>
    </Panel>
  )
}
