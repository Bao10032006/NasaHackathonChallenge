import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bounds, MapCellsResponse, MapCellValue } from '../api/types'
import { ORIGIN_COPY, PROBLEM_COPY } from '../lib/format'
import { boundsLabel, selectorLabel } from '../lib/labels'
import { ACTIVITY_COLORS, ZERO_COLOR, activityScale, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { useAppState, useDispatch } from '../state/AppState'
import { ServedByBadge } from './ui'
import { mapRequest } from './requests'

/*
 * Basemap: NASA GIBS (Global Imagery Browse Services) public WMTS tiles in Web Mercator. GIBS needs
 * no API key. FIRMS MAP_KEYs are for raw fire-detection downloads, which this product must not show
 * (capabilities.rawDetectionPointsAvailable = false).
 */
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const VIETNAM_VIEW: L.LatLngBoundsExpression = [[8.2, 102.1], [23.4, 109.5]]
const GRID = 0.25

function snapToGrid(value: number): number {
  return Math.round(value / GRID) * GRID
}

/** Drawn boxes snap to the 0.25° grid edges, so the box matches what the cell rule will select. */
function snapBounds(a: L.LatLng, b: L.LatLng): Bounds {
  let west = snapToGrid(Math.min(a.lng, b.lng))
  let east = snapToGrid(Math.max(a.lng, b.lng))
  let south = snapToGrid(Math.min(a.lat, b.lat))
  let north = snapToGrid(Math.max(a.lat, b.lat))
  if (east <= west) {
    east = west + GRID
  }
  if (north <= south) {
    north = south + GRID
  }
  west = Math.max(-180, west)
  east = Math.min(180, east)
  south = Math.max(-90, south)
  north = Math.min(90, north)
  return { west, south, east, north }
}

function toLatLngBounds(bounds: Bounds): L.LatLngBoundsExpression {
  return [[bounds.south, bounds.west], [bounds.north, bounds.east]]
}

function cellTooltip(cell: MapCellValue): string {
  const value = cell.valueStatus === 'AVAILABLE' && cell.value !== null
    ? `${readableValue(cell.value)} snpp_eq${cell.value === 0 ? ' (0: không có phát hiện)' : ''}`
    : 'Ngoài phạm vi dữ liệu'
  const origin = cell.origin ? `<br>${ORIGIN_COPY[cell.origin]}` : ''
  const partial = cell.partial ? '<br>Kỳ chưa đầy đủ dữ liệu' : ''
  return `<strong>Ô ${cell.cellId}</strong> · tâm ${cell.center.lat}°B, ${cell.center.lon}°Đ<br>${value}${origin}${partial}`
}

export function ExploreMap() {
  const state = useAppState()
  const dispatch = useDispatch()
  const map = useApi(mapRequest(state))
  const { data, stale } = currentOrPrevious(map)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const cellsLayerRef = useRef<L.FeatureGroup | null>(null)
  const outlineLayerRef = useRef<L.FeatureGroup | null>(null)
  const fittedSelectionRef = useRef<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const selectedCellId = state.filters.selectedCellId
  const requestedBbox = state.filters.spatial.mode === 'bbox' ? state.filters.spatial : null

  const scale = useMemo(() => activityScale(data?.summary.maxCellValue), [data])

  // Create the Leaflet map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }
    const leaflet = L.map(containerRef.current, { zoomSnap: 0.25, minZoom: 4, maxZoom: 11, attributionControl: true })
    leaflet.createPane('labels')
    const labelsPane = leaflet.getPane('labels')
    if (labelsPane) {
      labelsPane.style.zIndex = '650'
      labelsPane.style.pointerEvents = 'none'
    }
    L.tileLayer(`${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`, {
      maxNativeZoom: 8,
      maxZoom: 11,
      attribution: 'Ảnh nền © NASA EOSDIS GIBS (Blue Marble) · Ô lưới: Hỏa Lịch',
    }).addTo(leaflet)
    L.tileLayer(`${GIBS}/Coastlines_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`, {
      maxNativeZoom: 13,
      maxZoom: 11,
      pane: 'labels',
      opacity: 0.6,
    }).addTo(leaflet)
    L.tileLayer(`${GIBS}/Reference_Labels_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`, {
      maxNativeZoom: 13,
      maxZoom: 11,
      pane: 'labels',
    }).addTo(leaflet)
    cellsLayerRef.current = L.featureGroup().addTo(leaflet)
    outlineLayerRef.current = L.featureGroup().addTo(leaflet)
    leaflet.fitBounds(VIETNAM_VIEW)
    mapRef.current = leaflet
    return () => {
      leaflet.remove()
      mapRef.current = null
    }
  }, [])

  // Draw the cells of the current (or previous, while updating) response.
  useEffect(() => {
    const layer = cellsLayerRef.current
    if (!layer) {
      return
    }
    layer.clearLayers()
    if (!data) {
      return
    }
    for (const cell of data.cells) {
      const available = cell.valueStatus === 'AVAILABLE' && cell.value !== null
      const selected = cell.cellId === selectedCellId
      const rectangle = L.rectangle(toLatLngBounds(cell.bounds), {
        color: selected ? '#111' : available ? 'rgba(60,40,20,0.45)' : '#777',
        weight: selected ? 2.5 : 0.6,
        dashArray: available ? undefined : '3 3',
        fillColor: available ? scale.color(cell.value as number) : '#ffffff',
        fillOpacity: available ? (stale ? 0.35 : 0.78) : 0.15,
      })
      rectangle.bindTooltip(cellTooltip(cell), { sticky: true })
      rectangle.on('click', () => dispatch({ type: 'selectCell', cellId: cell.cellId }))
      rectangle.addTo(layer)
    }
  }, [data, scale, selectedCellId, stale, dispatch])

  // Outlines: requested box (dashed) and the extent the backend actually selected (solid).
  useEffect(() => {
    const layer = outlineLayerRef.current
    if (!layer) {
      return
    }
    layer.clearLayers()
    if (requestedBbox) {
      L.rectangle(toLatLngBounds(requestedBbox), { color: '#1d4ed8', weight: 2, dashArray: '6 4', fill: false })
        .bindTooltip('Khung bạn yêu cầu')
        .addTo(layer)
    }
    if (data && data.selection.type === 'BOUNDING_BOX') {
      L.rectangle(toLatLngBounds(data.selection.selectedBounds), { color: '#1d4ed8', weight: 1.5, fill: false })
        .bindTooltip(`Phạm vi thực tế: ${data.selection.cellCount} ô`)
        .addTo(layer)
    }
  }, [requestedBbox, data])

  // Fit the view when the spatial selection changes (not when only the period changes).
  useEffect(() => {
    const leaflet = mapRef.current
    if (!leaflet || !data || stale) {
      return
    }
    const key = `${data.selection.type}:${data.selection.cellIds.join(',')}`
    if (fittedSelectionRef.current === key) {
      return
    }
    fittedSelectionRef.current = key
    if (data.selection.type === 'NAMED_AREA' && data.selection.area?.type === 'national') {
      leaflet.fitBounds(VIETNAM_VIEW)
    } else {
      leaflet.fitBounds(toLatLngBounds(data.selection.selectedBounds), { padding: [40, 40], maxZoom: 9 })
    }
  }, [data, stale])

  // Box drawing: drag a rectangle while the draw mode is on.
  useEffect(() => {
    const leaflet = mapRef.current
    if (!leaflet || !drawing) {
      return
    }
    leaflet.dragging.disable()
    leaflet.getContainer().style.cursor = 'crosshair'
    let start: L.LatLng | null = null
    let preview: L.Rectangle | null = null
    const onDown = (event: L.LeafletMouseEvent) => {
      start = event.latlng
      preview = L.rectangle(L.latLngBounds(event.latlng, event.latlng), { color: '#1d4ed8', weight: 2, dashArray: '6 4', fillOpacity: 0.08 })
        .addTo(leaflet)
    }
    const onMove = (event: L.LeafletMouseEvent) => {
      if (start && preview) {
        preview.setBounds(L.latLngBounds(start, event.latlng))
      }
    }
    const onUp = (event: L.LeafletMouseEvent) => {
      if (!start) {
        return
      }
      const bounds = snapBounds(start, event.latlng)
      preview?.remove()
      start = null
      setDrawing(false)
      dispatch({ type: 'setSpatial', spatial: { mode: 'bbox', ...bounds } })
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        preview?.remove()
        setDrawing(false)
      }
    }
    leaflet.on('mousedown', onDown)
    leaflet.on('mousemove', onMove)
    leaflet.on('mouseup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      leaflet.off('mousedown', onDown)
      leaflet.off('mousemove', onMove)
      leaflet.off('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
      preview?.remove()
      leaflet.dragging.enable()
      leaflet.getContainer().style.cursor = ''
    }
  }, [drawing, dispatch])

  const error = map.status === 'error' ? map.error : null
  const noCells = error?.code === 'NO_CELLS_IN_BOUNDS'

  return (
    <section className="card map-card" aria-labelledby="map-title">
      <div className="card-head">
        <div>
          <h2 id="map-title">Bản đồ hoạt động theo ô lưới</h2>
          <p className="muted">
            {data ? selectorLabel(data.temporalSelector) : 'Đang tải…'}
            {data && <> · {data.selection.cellCount} ô</>}
          </p>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className={drawing ? 'button primary' : 'button'}
            aria-pressed={drawing}
            onClick={() => setDrawing((value) => !value)}
          >
            {drawing ? 'Kéo để khoanh… (Esc để hủy)' : 'Khoanh vùng trên bản đồ'}
          </button>
          {map.status === 'success' && <ServedByBadge servedBy={map.servedBy} />}
        </div>
      </div>

      <div className="map-frame">
        <div ref={containerRef} className="map" role="application" aria-label="Bản đồ ô lưới 0,25° của Việt Nam" />
        {map.status === 'loading' && (
          <div className="map-overlay" role="status" aria-live="polite">
            {stale ? 'Đang cập nhật bản đồ cho lựa chọn mới…' : 'Đang tải bản đồ…'}
          </div>
        )}
        {error && (
          <div className="map-overlay map-overlay-error" role="alert">
            <strong>{noCells ? 'Khung không chứa ô dữ liệu nào' : 'Không tải được bản đồ'}</strong>
            <span>
              {noCells
                ? 'Không có tâm ô nào nằm trong khung. Khung vẫn được giữ: hãy khoanh lại rộng hơn.'
                : error.kind === 'mock-missing'
                  ? 'Chưa có dữ liệu mẫu cho lựa chọn này. Dùng toàn quốc, khung ví dụ Tây Nguyên hoặc chuyển sang API thật.'
                  : (error.code && PROBLEM_COPY[error.code]) ?? error.message}
            </span>
            {!noCells && error.kind !== 'mock-missing' && (
              <button type="button" className="button" onClick={map.retry}>Thử lại</button>
            )}
          </div>
        )}
      </div>

      {data && <MapLegend data={data} scaleBreaks={scale.breaks} />}
    </section>
  )
}

function MapLegend({ data, scaleBreaks }: { data: MapCellsResponse; scaleBreaks: number[] }) {
  const { selection, summary } = data
  return (
    <div className="legend" aria-label="Chú giải bản đồ">
      <p className="legend-title">
        Mỗi ô là một ô lưới 0,25° (~27 km). Màu thể hiện <strong>snpp_eq</strong> — số phát hiện cháy ban ngày
        tương đương cảm biến VIIRS S‑NPP — cộng trong kỳ; không phải số vụ cháy hay vị trí điểm cháy.
      </p>
      <div className="legend-scale">
        <span className="legend-item">
          <span className="swatch" style={{ background: ZERO_COLOR }} />0 (không có phát hiện)
        </span>
        {ACTIVITY_COLORS.map((color, index) => (
          <span key={color} className="legend-item">
            <span className="swatch" style={{ background: color }} />
            {index === 0 ? '>0' : readableValue(scaleBreaks[index - 1])}–{readableValue(scaleBreaks[index])}
          </span>
        ))}
        <span className="legend-item">
          <span className="swatch swatch-outside" />Ngoài phạm vi dữ liệu
        </span>
      </div>
      <p className="muted">
        Thang màu theo căn bậc hai, từ 0 đến ô cao nhất của kỳ ({readableValue(summary.maxCellValue)}).
        {selection.type === 'BOUNDING_BOX' && (
          <> Viền nét đứt: khung bạn yêu cầu; viền liền: phạm vi thực tế {boundsLabel(selection.selectedBounds)}
            {' '}(ô được tính khi tâm nằm trong hoặc trên biên khung).</>
        )}
        {' '}Bấm một ô để xem nguồn vệ tinh.
      </p>
    </div>
  )
}
