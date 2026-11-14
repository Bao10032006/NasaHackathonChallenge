import type L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { MapCellsResponse } from '../api/types'
import { DataTable } from '../components/DataTable'
import { SegmentedControl } from '../components/SegmentedControl'
import { CoverageChip, ErrorNote, OriginBadge, ServedByBadge, UpdatingNote, ValueWithStatus } from '../components/ui'
import { FilterBar } from '../explore/FilterBar'
import { INCOMPATIBILITY_COPY, compareMaps } from '../lib/compare'
import { MONTH_NAMES } from '../lib/labels'
import { activityScale, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi, type ApiResult } from '../lib/useApi'
import { BASEMAP_OPTIONS, type BasemapId } from '../map/basemaps'
import { GridMap, type MapFit } from '../map/GridMap'
import { MapLegend } from '../map/MapLegend'
import { toSpatialQuery, useAppState, useDispatch } from '../state/AppState'
import { useMetadata } from '../state/Metadata'

function formatDelta(value: number | null): string {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${readableValue(value)}`
}

/** Keeps two Leaflet maps on the same centre and zoom (user pan/zoom on either side). */
function useSyncedMaps() {
  const maps = useRef<{ a: L.Map | null; b: L.Map | null }>({ a: null, b: null })
  const syncing = useRef(false)
  const attach = (side: 'a' | 'b') => (map: L.Map) => {
    maps.current[side] = map
    const other = () => maps.current[side === 'a' ? 'b' : 'a']
    map.on('move', () => {
      const target = other()
      if (!target || syncing.current) {
        return
      }
      syncing.current = true
      target.setView(map.getCenter(), map.getZoom(), { animate: false })
      syncing.current = false
    })
  }
  return { attachA: attach('a'), attachB: attach('b') }
}

function SideSummary({ label, state }: { label: string; state: ApiResult<MapCellsResponse> }) {
  const { data, stale } = currentOrPrevious(state)
  return (
    <div className="compare-side-summary">
      <div className="compare-side-head">
        <h3>{label}</h3>
        <UpdatingNote show={stale} what="bản đồ" />
        {state.status === 'success' && <ServedByBadge servedBy={state.servedBy} />}
      </div>
      {state.status === 'error' && <ErrorNote error={state.error} onRetry={state.retry} context={`bản đồ ${label}`} />}
      {data && (
        <>
          <p className="stat-value num">
            <ValueWithStatus value={data.summary.totalValue} status={data.summary.valueStatus} /> <span className="unit">snpp_eq</span>
          </p>
          <div className="chips">
            <CoverageChip coverage={data.summary.coverage} />
            <OriginBadge origin={data.summary.origin} long />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Dual-map comparison (Contract v0.4 section 7): two /map/cells calls for the same spatial selection and
 * month in two years, one shared colour scale and a synchronised view. Deltas only when compatible.
 */
export default function CompareScreen() {
  const { dataSource, filters, compare } = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const spatial = toSpatialQuery(filters.spatial)
  const mapA = useApi(api.mapCells(dataSource, spatial, { kind: 'month', year: compare.yearA, month: compare.month }))
  const mapB = useApi(api.mapCells(dataSource, spatial, { kind: 'month', year: compare.yearB, month: compare.month }))
  const viewA = currentOrPrevious(mapA)
  const viewB = currentOrPrevious(mapB)
  const [basemap, setBasemap] = useState<BasemapId>('night')
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
  const { attachA, attachB } = useSyncedMaps()
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  const comparison = mapA.status === 'success' && mapB.status === 'success' ? compareMaps(mapA.data, mapB.data) : null
  const sharedMax = comparison?.colorDomain?.max
    ?? Math.max(viewA.data?.summary.maxCellValue ?? 0, viewB.data?.summary.maxCellValue ?? 0)
  const scale = useMemo(() => activityScale(sharedMax), [sharedMax])
  const yearStart = metadata?.yearRange.start ?? 2000
  const yearEnd = metadata?.yearRange.end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearEnd - index)
  const reference = viewA.data ?? viewB.data
  const fit: MapFit | null = reference
    ? {
      key: `${reference.selection.type}:${reference.selection.cellIds.join(',')}`,
      bounds: reference.selection.type === 'NAMED_AREA' && reference.selection.area?.type === 'national'
        ? 'vietnam'
        : reference.selection.selectedBounds,
    }
    : null
  const selectedRow = selectedCellId ? comparison?.cells.find((cell) => cell.cellId === selectedCellId) : undefined

  useEffect(() => {
    setSelectedCellId(null)
  }, [filters.spatial])

  return (
    <div className="compare" data-screen="compare">
      <h1 className="visually-hidden" ref={headingRef}>So sánh hai bản đồ</h1>
      <FilterBar showTime={false} />

      <section className="card compare-controls" aria-labelledby="compare-controls-title">
        <div className="card-head">
          <h2 id="compare-controls-title">Cùng tháng ở hai năm</h2>
          <SegmentedControl label="Ảnh nền" size="small" options={BASEMAP_OPTIONS} value={basemap} onChange={setBasemap} />
        </div>
        <div className="filter-row">
          <label className="field-inline">
            <span>Tháng</span>
            <select value={compare.month} onChange={(event) => dispatch({ type: 'setCompare', compare: { month: Number(event.target.value) } })}>
              {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </label>
          <label className="field-inline">
            <span>Năm A</span>
            <select value={compare.yearA} onChange={(event) => dispatch({ type: 'setCompare', compare: { yearA: Number(event.target.value) } })}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="field-inline">
            <span>Năm B</span>
            <select value={compare.yearB} onChange={(event) => dispatch({ type: 'setCompare', compare: { yearB: Number(event.target.value) } })}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>

        <div className="compare-summary">
          <SideSummary label={`A · ${MONTH_NAMES[compare.month - 1]}/${compare.yearA}`} state={mapA} />
          <div className="compare-delta" aria-live="polite">
            <h3>Chênh lệch toàn vùng (B − A)</h3>
            {comparison ? (
              comparison.differenceAvailable ? (
                <p className="stat-value num">{formatDelta(comparison.areaDelta)} <span className="unit">snpp_eq</span></p>
              ) : (
                <>
                  <p className="stat-value muted">Ẩn</p>
                  <ul className="reason-list">
                    {comparison.reasons.map((reason) => <li key={reason}><code>{reason}</code> — {INCOMPATIBILITY_COPY[reason]}</li>)}
                  </ul>
                </>
              )
            ) : <p className="muted small">Cần tải xong cả hai bản đồ.</p>}
            <p className="muted small">Khác nguồn gốc (quan sát/ước lượng) không làm mất tương thích, nhưng luôn ghi nguồn gốc cạnh giá trị.</p>
          </div>
          <SideSummary label={`B · ${MONTH_NAMES[compare.month - 1]}/${compare.yearB}`} state={mapB} />
        </div>
      </section>

      <div className="compare-maps">
        {([['A', compare.yearA, viewA, attachA], ['B', compare.yearB, viewB, attachB]] as const).map(([side, year, view, attach]) => (
          <section key={side} className="card map-card" aria-label={`Bản đồ ${side}: tháng ${compare.month}/${year}`}>
            <p className="compare-map-label"><strong>{side}</strong> · {MONTH_NAMES[compare.month - 1]}/{year}</p>
            <GridMap
              ariaLabel={`Bản đồ ${side}, tháng ${compare.month}/${year}. Dùng bảng so sánh bên dưới để đọc từng ô.`}
              cells={view.data?.cells}
              scale={scale}
              stale={view.stale}
              selectedCellId={selectedCellId}
              onSelectCell={setSelectedCellId}
              fit={fit}
              basemap={basemap}
              onReady={attach}
            />
          </section>
        ))}
      </div>
      {(viewA.data || viewB.data) && <MapLegend max={sharedMax} middle={scale.breaks[2]} shared />}

      {selectedRow && (
        <section className="card compare-selected" aria-live="polite" aria-labelledby="compare-selected-title">
          <h2 id="compare-selected-title">Ô {selectedRow.cellId}</h2>
          <dl className="stat-row">
            <div><dt>A · {compare.yearA}</dt><dd>{selectedRow.a ? <ValueWithStatus value={selectedRow.a.value} status={selectedRow.a.valueStatus} /> : '—'}</dd></div>
            <div><dt>B · {compare.yearB}</dt><dd>{selectedRow.b ? <ValueWithStatus value={selectedRow.b.value} status={selectedRow.b.valueStatus} /> : '—'}</dd></div>
            <div><dt>Chênh lệch (B − A)</dt><dd className="num">{selectedRow.delta === null ? 'Ẩn' : formatDelta(selectedRow.delta)}</dd></div>
          </dl>
          {selectedRow.reason && <p className="muted small">Không tính chênh lệch: {INCOMPATIBILITY_COPY[selectedRow.reason]}</p>}
        </section>
      )}

      {comparison && (
        <section className="card" aria-labelledby="compare-table-title">
          <h2 id="compare-table-title">Bảng so sánh theo ô</h2>
          <DataTable label="So sánh giá trị theo ô giữa năm A và năm B">
            <thead>
              <tr>
                <th scope="col">Ô</th>
                <th scope="col" className="num-col">A · {compare.yearA}</th>
                <th scope="col">Nguồn gốc A</th>
                <th scope="col" className="num-col">B · {compare.yearB}</th>
                <th scope="col">Nguồn gốc B</th>
                <th scope="col" className="num-col">B − A</th>
              </tr>
            </thead>
            <tbody>
              {comparison.cells.map((cell) => (
                <tr key={cell.cellId} aria-selected={cell.cellId === selectedCellId}>
                  <th scope="row">
                    <button type="button" className="link-button" aria-pressed={cell.cellId === selectedCellId} onClick={() => setSelectedCellId(cell.cellId)}>
                      {cell.cellId}
                    </button>
                  </th>
                  <td className="num-col">{cell.a ? <ValueWithStatus value={cell.a.value} status={cell.a.valueStatus} /> : '—'}</td>
                  <td>{cell.a && <OriginBadge origin={cell.a.origin} />}</td>
                  <td className="num-col">{cell.b ? <ValueWithStatus value={cell.b.value} status={cell.b.valueStatus} /> : '—'}</td>
                  <td>{cell.b && <OriginBadge origin={cell.b.origin} />}</td>
                  <td className="num-col">{cell.delta === null ? <span className="muted" title={cell.reason ? INCOMPATIBILITY_COPY[cell.reason] : undefined}>Ẩn</span> : formatDelta(cell.delta)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      )}
    </div>
  )
}
