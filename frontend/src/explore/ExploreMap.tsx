import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bounds, MapCellsResponse, MapCellValue } from '../api/types'
import { ORIGIN_COPY, PROBLEM_COPY } from '../lib/format'
import { boundsLabel, selectorLabel } from '../lib/labels'
import { ACTIVITY_COLORS, HOT_CLASS, ZERO_COLOR, activityScale, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { useAppState, useDispatch } from '../state/AppState'
import { ServedByBadge } from './ui'
import { mapRequest } from './requests'

/*
 * Basemaps: NASA GIBS (Global Imagery Browse Services) public WMTS tiles in Web Mercator, no API key.
 * - Night: VIIRS Black Marble (city lights) — the default, fire cells glow on it.
 * - Day: Blue Marble shaded relief + bathymetry.
 * GIBS Reference_Labels_15m is NOT used: some of its tiles come back as opaque black palette PNGs,
 * which covered the map with black squares. Place names are drawn locally instead.
 * FIRMS MAP_KEYs are for raw fire-detection downloads, which this product must not show
 * (capabilities.rawDetectionPointsAvailable = false), so none is used.
 */
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const BASEMAPS = {
  night: {
    label: 'Đêm',
    url: `${GIBS}/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
    attribution: 'Ảnh nền © NASA EOSDIS GIBS · VIIRS Black Marble',
  },
  day: {
    label: 'Ngày',
    url: `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
    attribution: 'Ảnh nền © NASA EOSDIS GIBS · Blue Marble',
  },
} as const
type BasemapId = keyof typeof BASEMAPS

const VIETNAM_VIEW: L.LatLngBoundsExpression = [[8.2, 102.1], [23.4, 109.5]]
const GRID = 0.25

/** Reference place names (centres of major cities), drawn as non-interactive labels. */
const PLACES: Array<[string, number, number]> = [
  ['Hà Nội', 21.028, 105.854],
  ['Hải Phòng', 20.845, 106.688],
  ['Điện Biên Phủ', 21.386, 103.023],
  ['Vinh', 18.679, 105.681],
  ['Huế', 16.463, 107.59],
  ['Đà Nẵng', 16.054, 108.202],
  ['Pleiku', 13.983, 108.0],
  ['Buôn Ma Thuột', 12.667, 108.038],
  ['Nha Trang', 12.238, 109.196],
  ['Đà Lạt', 11.94, 108.458],
  ['TP. Hồ Chí Minh', 10.776, 106.701],
  ['Cần Thơ', 10.045, 105.747],
]

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
    ? `<span class="tip-value">${readableValue(cell.value)}</span> snpp_eq${cell.value === 0 ? ' · không có phát hiện' : ''}`
    : 'Ngoài phạm vi dữ liệu'
  const origin = cell.origin ? `<br>${ORIGIN_COPY[cell.origin]}` : ''
  const partial = cell.partial ? '<br>Kỳ chưa đầy đủ dữ liệu' : ''
  return `<strong>Ô ${cell.cellId}</strong><span class="tip-muted"> · ${cell.center.lat}°B, ${cell.center.lon}°Đ</span><br>${value}${origin}${partial}`
}

export function ExploreMap() {
  const state = useAppState()
  const dispatch = useDispatch()
  const map = useApi(mapRequest(state))
  const { data, stale } = currentOrPrevious(map)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseLayerRef = useRef<L.TileLayer | null>(null)
  const cellsLayerRef = useRef<L.FeatureGroup | null>(null)
  const outlineLayerRef = useRef<L.FeatureGroup | null>(null)
  const fittedSelectionRef = useRef<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [basemap, setBasemap] = useState<BasemapId>('night')
  const selectedCellId = state.filters.selectedCellId
  const requestedBbox = state.filters.spatial.mode === 'bbox' ? state.filters.spatial : null

  const scale = useMemo(() => activityScale(data?.summary.maxCellValue), [data])

  // Create the Leaflet map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }
    const leaflet = L.map(containerRef.current, { zoomSnap: 0.25, minZoom: 4, maxZoom: 11, attributionControl: true })
    for (const [name, zIndex] of [['coast', '350'], ['places', '640']] as const) {
      leaflet.createPane(name)
      const pane = leaflet.getPane(name)
      if (pane) {
        pane.style.zIndex = zIndex
        pane.style.pointerEvents = 'none'
      }
    }
    L.tileLayer(`${GIBS}/Coastlines_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`, {
      maxNativeZoom: 13,
      maxZoom: 11,
      pane: 'coast',
      className: 'coast-tiles',
    }).addTo(leaflet)
    for (const [name, lat, lon] of PLACES) {
      L.marker([lat, lon], {
        pane: 'places',
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: 'place-label', html: `<span class="place-dot"></span><span>${name}</span>`, iconSize: [0, 0] }),
      }).addTo(leaflet)
    }
    cellsLayerRef.current = L.featureGroup().addTo(leaflet)
    outlineLayerRef.current = L.featureGroup().addTo(leaflet)
    leaflet.fitBounds(VIETNAM_VIEW)
    // Leaflet measures its container once; re-measure whenever the responsive layout resizes it.
    const observer = new ResizeObserver(() => leaflet.invalidateSize())
    observer.observe(containerRef.current)
    mapRef.current = leaflet
    return () => {
      observer.disconnect()
      leaflet.remove()
      mapRef.current = null
    }
  }, [])

  // Basemap switch (night / day).
  useEffect(() => {
    const leaflet = mapRef.current
    if (!leaflet) {
      return
    }
    baseLayerRef.current?.remove()
    baseLayerRef.current = L.tileLayer(BASEMAPS[basemap].url, {
      maxNativeZoom: 8,
      maxZoom: 11,
      attribution: `${BASEMAPS[basemap].attribution} · Ô lưới: Hỏa Lịch`,
    }).addTo(leaflet)
    baseLayerRef.current.bringToBack()
    leaflet.getContainer().dataset.basemap = basemap
  }, [basemap])

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
      const level = available ? scale.classOf(cell.value as number) : -1
      const classes = ['grid-cell']
      if (available && level >= HOT_CLASS) {
        classes.push('grid-cell-hot')
      }
      if (selected) {
        classes.push('grid-cell-selected')
      }
      const rectangle = L.rectangle(toLatLngBounds(cell.bounds), {
        className: classes.join(' '),
        color: selected ? '#ffffff' : available ? (level < 0 ? 'rgba(148,163,184,0.35)' : 'rgba(255,214,170,0.35)') : 'rgba(148,163,184,0.6)',
        weight: selected ? 2.5 : 0.5,
        dashArray: available ? undefined : '3 3',
        fillColor: available ? scale.color(cell.value as number) : 'transparent',
        fillOpacity: available ? (stale ? 0.35 : level < 0 ? 0.5 : 0.82) : 0,
      })
      rectangle.bindTooltip(cellTooltip(cell), { sticky: true, className: 'cell-tooltip' })
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
      L.rectangle(toLatLngBounds(requestedBbox), { color: '#22d3ee', weight: 1.5, dashArray: '6 5', fill: false, className: 'bbox-requested' })
        .bindTooltip('Khung bạn yêu cầu', { className: 'cell-tooltip' })
        .addTo(layer)
    }
    const sameAsRequested = requestedBbox !== null && data !== undefined
      && (['west', 'south', 'east', 'north'] as const).every((side) => requestedBbox[side] === data.selection.selectedBounds[side])
    if (data && data.selection.type === 'BOUNDING_BOX' && !sameAsRequested) {
      L.rectangle(toLatLngBounds(data.selection.selectedBounds), { color: '#67e8f9', weight: 1, opacity: 0.8, fill: false })
        .bindTooltip(`Phạm vi thực tế: ${data.selection.cellCount} ô`, { className: 'cell-tooltip' })
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
      // Zoom 8 is the native resolution of the GIBS basemaps; deeper zoom only blurs them.
      leaflet.fitBounds(toLatLngBounds(data.selection.selectedBounds), { padding: [40, 40], maxZoom: 8 })
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
      preview = L.rectangle(L.latLngBounds(event.latlng, event.latlng), {
        color: '#22d3ee', weight: 2, dashArray: '6 5', fillColor: '#22d3ee', fillOpacity: 0.08,
      }).addTo(leaflet)
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
          <h2 id="map-title">Bản đồ hoạt động cháy</h2>
          <p className="muted">
            {data ? selectorLabel(data.temporalSelector) : 'Đang tải…'}
            {data && <> · {data.selection.cellCount} ô lưới 0,25°</>}
          </p>
        </div>
        <div className="toolbar">
          <div className="segmented segmented-small" role="radiogroup" aria-label="Ảnh nền">
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={basemap === id}
                className={basemap === id ? 'active' : ''}
                onClick={() => setBasemap(id)}
              >
                {BASEMAPS[id].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={drawing ? 'button primary' : 'button'}
            aria-pressed={drawing}
            onClick={() => setDrawing((value) => !value)}
          >
            {drawing ? 'Kéo để khoanh… (Esc để hủy)' : '⬚ Khoanh vùng'}
          </button>
          {map.status === 'success' && <ServedByBadge servedBy={map.servedBy} />}
        </div>
      </div>

      <div className="map-frame">
        <div ref={containerRef} className="map" role="application" aria-label="Bản đồ ô lưới 0,25° của Việt Nam" />
        {map.status === 'loading' && (
          <div className="map-overlay" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
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
        {data && <MapLegend data={data} scaleBreaks={scale.breaks} />}
      </div>
      {data && <MapReading data={data} />}
    </section>
  )
}

/** Floating colour legend over the map. */
function MapLegend({ data, scaleBreaks }: { data: MapCellsResponse; scaleBreaks: number[] }) {
  return (
    <div className="map-legend" aria-label="Chú giải màu">
      <div className="map-legend-title">snpp_eq mỗi ô</div>
      <div className="legend-ramp" aria-hidden="true">
        {ACTIVITY_COLORS.map((color) => <span key={color} style={{ background: color }} />)}
      </div>
      <div className="legend-ramp-labels">
        <span>&gt;0</span>
        <span>{readableValue(scaleBreaks[2])}</span>
        <span>{readableValue(data.summary.maxCellValue)}</span>
      </div>
      <div className="legend-row"><span className="swatch" style={{ background: ZERO_COLOR }} />0 · không có phát hiện</div>
      <div className="legend-row"><span className="swatch swatch-outside" />Ngoài phạm vi dữ liệu</div>
    </div>
  )
}

/** How to read the map, under it. */
function MapReading({ data }: { data: MapCellsResponse }) {
  const { selection } = data
  return (
    <p className="legend muted small">
      Mỗi ô là một ô lưới 0,25° (~27 km). Màu từ đỏ sẫm đến vàng sáng thể hiện <strong>snpp_eq</strong> — số phát hiện cháy
      ban ngày tương đương cảm biến VIIRS S‑NPP — cộng trong kỳ, theo thang căn bậc hai từ 0 đến ô cao nhất. Không phải số
      vụ cháy hay vị trí điểm cháy.
      {selection.type === 'BOUNDING_BOX' && (
        <> Viền nét đứt: khung bạn yêu cầu; viền liền: phạm vi thực tế {boundsLabel(selection.selectedBounds)}
          {' '}(ô được tính khi tâm nằm trong hoặc trên biên khung).</>
      )}
      {' '}Bấm một ô để xem nguồn vệ tinh.
    </p>
  )
}
