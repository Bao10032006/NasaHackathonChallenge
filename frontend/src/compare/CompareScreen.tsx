import { useEffect, useRef, useState } from 'react'
import { endpoint } from '../explore/api'
import type { Grid, MapCell, Metadata, SpatialQuery } from '../explore/api'
import { boundsLabel } from '../explore/ExploreFilters'
import { FireGridMap, MapColorScale } from '../explore/FireGridMap'
import type { Camera } from '../explore/FireGridMap'
import { CoverageNotice, ResourceNotice, number, origins, statusLabels, valueLabel } from '../explore/display'
import { useResource } from '../explore/useResource'
import type { Resource } from '../explore/useResource'
import { CompareDailyActivity } from './CompareDailyActivity'
import './compare.css'

export type CompareSelection = {
  spatial: SpatialQuery
  label: string
  month: number
  year: number
  yearRange: Metadata['yearRange']
  camera: Camera
}

function incompatibility(a: Grid, b: Grid) {
  const { meta: left, selection: selectionA, summary: summaryA } = a
  const { meta: right, selection: selectionB, summary: summaryB } = b
  if (left.dataVersion !== right.dataVersion || left.modelVersion !== right.modelVersion ||
      left.metric !== right.metric || left.unit !== right.unit) {
    return 'Hai bản đồ khác phiên bản dữ liệu, mô hình hoặc đơn vị đo.'
  }
  if (selectionA.cellIds.length !== selectionB.cellIds.length ||
      selectionA.cellIds.some((id, index) => id !== selectionB.cellIds[index])) {
    return 'Hai bản đồ không có cùng tập ô theo thứ tự.'
  }
  const coverA = summaryA.coverage
  const coverB = summaryB.coverage
  if (coverA.partial || coverB.partial || coverA.coveredDayCount !== coverB.coveredDayCount ||
      coverA.coveredDayCount !== coverA.expectedDayCount || coverB.coveredDayCount !== coverB.expectedDayCount ||
      coverA.coveredDayCount === 0) {
    return 'Hai kỳ cần có đủ dữ liệu và cùng số ngày để tính chênh lệch.'
  }
  return null
}

function difference(a: number) {
  return a < 0 ? '−' + number(Math.abs(a)) : a > 0 ? '+' + number(a) : '0'
}

function cellValue(cell?: MapCell) {
  return cell?.valueStatus === 'AVAILABLE' ? cell.value : null
}

function YearSummary({ year, resource }: { year: number; resource: Resource<Grid> }) {
  const summary = resource.data?.summary
  return (
    <div className="metric compare-year-summary">
      <span>Tổng vùng · {year}</span>
      <ResourceNotice resource={resource} />
      {summary && <>
        <strong className="summary-number">{valueLabel(summary.totalValue, summary.valueStatus)}</strong>
        <CoverageNotice coverage={summary.coverage} />
      </>}
    </div>
  )
}

export function CompareScreen({ selection, onBack }: { selection: CompareSelection; onBack: () => void }) {
  const { spatial, label, month, year, yearRange } = selection
  const [yearA, setYearA] = useState(year > yearRange.start ? year - 1 : year + 1)
  const [yearB, setYearB] = useState(year)
  const [camera, setCamera] = useState(selection.camera)
  const [activeCell, setCell] = useState<string | null>(null)
  const [visible, setVisible] = useState<'a' | 'b'>('a')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const a = useResource<Grid>(endpoint('/map/cells', { ...spatial, year: yearA, month }))
  const b = useResource<Grid>(endpoint('/map/cells', { ...spatial, year: yearB, month }))
  const grids = [a.data, b.data].filter((grid) => grid !== undefined)
  const mins = grids.flatMap(({ summary }) => summary.minCellValue == null ? [] : [summary.minCellValue])
  const maxes = grids.flatMap(({ summary }) => summary.maxCellValue == null ? [] : [summary.maxCellValue])
  const domain = mins.length && maxes.length ? { min: Math.min(...mins), max: Math.max(...maxes) } : undefined
  const incompatible = a.data && b.data ? incompatibility(a.data, b.data) : null
  const totalA = a.data?.summary.valueStatus === 'AVAILABLE' ? a.data.summary.totalValue : null
  const totalB = b.data?.summary.valueStatus === 'AVAILABLE' ? b.data.summary.totalValue : null
  const delta = !incompatible && totalA != null && totalB != null ? totalB - totalA : null
  const cellA = a.data?.cells.find((cell) => cell.cellId === activeCell)
  const cellB = b.data?.cells.find((cell) => cell.cellId === activeCell)
  const valueA = cellValue(cellA)
  const valueB = cellValue(cellB)
  const cellDelta = !incompatible && !cellA?.partial && !cellB?.partial && valueA != null && valueB != null ? valueB - valueA : null
  const years = Array.from({ length: yearRange.end - yearRange.start + 1 }, (_, index) => yearRange.end - index)
  const period = 'Tháng ' + month
  const maps = [
    { side: 'a', label: 'A', year: yearA, resource: a, cell: cellA },
    { side: 'b', label: 'B', year: yearB, resource: b, cell: cellB },
  ] as const

  return (
    <main className="compare-screen">
      <header className="compare-header">
        <div><h1 ref={heading} tabIndex={-1}>Đối chiếu hai bản đồ</h1><p className="muted">{label} · {period}{'west' in spatial && ' · ' + boundsLabel(spatial)}</p></div>
        <button type="button" className="quiet" onClick={onBack}>Về Khám phá</button>
      </header>
      <section className="panel compare-overview" aria-label="Tổng quan đối chiếu">
        <div className="filter-row">
          <label htmlFor="compare-year-a">Năm A</label>
          <select id="compare-year-a" value={yearA} onChange={(event) => setYearA(Number(event.target.value))}>
            {years.map((item) => <option key={item} disabled={item === yearB}>{item}</option>)}
          </select>
          <label htmlFor="compare-year-b">Năm B</label>
          <select id="compare-year-b" value={yearB} onChange={(event) => setYearB(Number(event.target.value))}>
            {years.map((item) => <option key={item} disabled={item === yearA}>{item}</option>)}
          </select>
          <span className="pill">{period}</span>
          {grids[0] && <span className="muted">{grids[0].selection.cellCount} ô được tính</span>}
        </div>
        <div className="compare-totals">
          <YearSummary year={yearA} resource={a} />
          <YearSummary year={yearB} resource={b} />
          {delta != null && <div className="metric compare-delta"><span>Chênh lệch · B − A</span>
            <strong className="summary-number">{difference(delta)}</strong>
          </div>}
        </div>
        {incompatible && <p className="notice">{incompatible}</p>}
        {a.data && b.data && !incompatible && delta == null && <p className="notice">Chưa có đủ giá trị tổng vùng để tính chênh lệch.</p>}
        {(a.error || b.error) && <p className="notice">Cần tải thành công cả hai bản đồ để tính chênh lệch.</p>}
      </section>

      <CompareDailyActivity spatial={spatial} month={month} yearA={yearA} yearB={yearB} />

      <div className="panel map-legend compare-legend">
        <div className="map-legend-row">
          <span>Thang màu chung · Số phát hiện tương đương S-NPP</span>
          <MapColorScale domain={domain} />
        </div>
        <p>Mỗi chấm là một ô lưới 0,25°. Viền cyan đánh dấu ô đang chọn, kể cả khi giá trị bằng 0.</p>
      </div>

      <div className="compare-switch" role="group" aria-label="Bản đồ đang xem">
        {maps.map((map) => <button type="button" key={map.side} aria-pressed={visible === map.side}
          onClick={() => setVisible(map.side)}>{map.label} · {map.year}</button>)}
      </div>

      <div className="compare-maps">
        {maps.map((map) => <div key={map.side} className="compare-map" data-active={visible === map.side}>
          <FireGridMap id={'compare-map-' + map.side} title={map.label + ' · ' + map.year} period={period}
            grid={map.resource.data} camera={camera} onCamera={setCamera} colorDomain={domain} sharedLegend drawing={false}
            requested={'west' in spatial ? spatial : undefined} activeCell={activeCell} onCell={setCell} />
        </div>)}
      </div>

      {activeCell && <section className="panel compare-cell" aria-labelledby="compare-cell-title">
        <div className="panel-heading">
          <h2 id="compare-cell-title">Ô {activeCell}</h2>
          <button type="button" className="quiet" onClick={() => setCell(null)}>Bỏ chọn ô</button>
        </div>
        <div className="compare-totals">
          {maps.map((map) => <div className="metric" key={map.side}>
            <h3>{map.label} · {map.year}</h3>
            {map.cell ? <>
              <strong>{valueLabel(map.cell.value, map.cell.valueStatus)}</strong>
              <p className="muted">{statusLabels[map.cell.valueStatus]}{map.cell.partial ? ' · Kỳ chưa đầy đủ' : ''}</p>
              {map.cell.origin && <p className="origin">{origins[map.cell.origin]}</p>}
            </> : <p className="muted">{map.resource.loading ? 'Đang tải…' : map.resource.data ? 'Ô không có trong phản hồi của kỳ này.' : 'Chưa tải được bản đồ.'}</p>}
          </div>)}
          {cellDelta != null && <div className="metric compare-delta"><span>Chênh lệch ô · B − A</span>
            <strong className="summary-number">{difference(cellDelta)}</strong>
          </div>}
        </div>
      </section>}
    </main>
  )
}
