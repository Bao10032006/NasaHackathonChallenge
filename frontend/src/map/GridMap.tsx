import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Bounds, MapCellValue } from '../api/types'
import { ORIGIN_COPY } from '../lib/format'
import { HOT_CLASS, type ActivityScale, readableValue } from '../lib/scale'
import { BASEMAPS, COASTLINES_URL, NATIVE_ZOOM, PLACES, VIETNAM_BOUNDS, type BasemapId } from './basemaps'

const GRID = 0.25

export interface MapFit {
  /** Changes whenever the view should be refitted (e.g. a new spatial selection). */
  key: string
  bounds: Bounds | 'vietnam'
  /** Keep the current view (e.g. the user just drew this box in view). */
  skip?: boolean
}

/** Minimum pointer travel (px) for a press to count as a drawn box rather than a click. */
const MIN_DRAG_PX = 8
/** Clicks right after a drawing gesture are ignored so the gesture never selects a cell. */
const CLICK_GUARD_MS = 500

function toLatLngBounds(bounds: Bounds): L.LatLngBoundsExpression {
  return [[bounds.south, bounds.west], [bounds.north, bounds.east]]
}

function snapToGrid(value: number): number {
  return Math.round(value / GRID) * GRID
}

/** Drawn boxes snap to the 0.25° grid edges, so the box matches what the cell rule will select. */
export function snapBounds(a: L.LatLng, b: L.LatLng): Bounds {
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
  return {
    west: Math.max(-180, west),
    south: Math.max(-90, south),
    east: Math.min(180, east),
    north: Math.min(90, north),
  }
}

function cellTooltip(cell: MapCellValue): string {
  const value = cell.valueStatus === 'AVAILABLE' && cell.value !== null
    ? `<span class="tip-value">${readableValue(cell.value)}</span> snpp_eq${cell.value === 0 ? ' · không có phát hiện' : ''}`
    : 'Ngoài phạm vi dữ liệu'
  const origin = cell.origin ? `<br>${ORIGIN_COPY[cell.origin]}` : ''
  const partial = cell.partial ? '<br>Kỳ chưa đầy đủ dữ liệu' : ''
  return `<strong>Ô ${cell.cellId}</strong><span class="tip-muted"> · ${cell.center.lat}°B, ${cell.center.lon}°Đ</span><br>${value}${origin}${partial}`
}

function cellStyle(cell: MapCellValue, scale: ActivityScale, selected: boolean, stale: boolean): L.PathOptions {
  const available = cell.valueStatus === 'AVAILABLE' && cell.value !== null
  const level = available ? scale.classOf(cell.value as number) : -1
  return {
    color: selected ? '#ffffff' : available ? (level < 0 ? 'rgba(148,163,184,0.4)' : 'rgba(255,214,170,0.4)') : 'rgba(148,163,184,0.65)',
    weight: selected ? 2.5 : 0.5,
    dashArray: available ? undefined : '3 3',
    fillColor: available ? scale.color(cell.value as number) : 'transparent',
    fillOpacity: available ? (stale ? 0.35 : level < 0 ? 0.5 : 0.85) : 0,
  }
}

/**
 * Leaflet grid map shared by Explore and Compare. Leaflet is created once; data changes rebuild the
 * cell layer, while selection changes only restyle the two affected rectangles (setStyle).
 */
export function GridMap({
  cells,
  scale,
  stale,
  selectedCellId,
  onSelectCell,
  requestedBounds,
  selectedBounds,
  previewBounds,
  fit,
  basemap,
  drawing = false,
  locked = false,
  onDrawEnd,
  onDrawCancel,
  onReady,
  ariaLabel,
  children,
}: {
  cells: MapCellValue[] | undefined
  scale: ActivityScale
  stale: boolean
  selectedCellId: string | null
  onSelectCell: (cellId: string) => void
  requestedBounds?: Bounds | null
  selectedBounds?: Bounds | null
  /** Box waiting for confirmation (drawn but not applied yet). */
  previewBounds?: Bounds | null
  fit: MapFit | null
  basemap: BasemapId
  drawing?: boolean
  /** Ignore cell clicks (drawing or confirming a box). */
  locked?: boolean
  onDrawEnd?: (bounds: Bounds) => void
  onDrawCancel?: () => void
  onReady?: (map: L.Map) => void
  ariaLabel: string
  children?: ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseLayerRef = useRef<L.TileLayer | null>(null)
  const cellsLayerRef = useRef<L.FeatureGroup | null>(null)
  const outlineLayerRef = useRef<L.FeatureGroup | null>(null)
  const layersRef = useRef(new Map<string, { layer: L.Rectangle; cell: MapCellValue }>())
  const selectedRef = useRef<string | null>(selectedCellId)
  const callbacks = useRef({ onSelectCell, onDrawEnd, onDrawCancel })
  callbacks.current = { onSelectCell, onDrawEnd, onDrawCancel }
  const renderState = useRef({ scale, stale })
  renderState.current = { scale, stale }
  const lockedRef = useRef(false)
  lockedRef.current = drawing || locked
  const clickGuardUntil = useRef(0)

  // Create Leaflet once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }
    const leaflet = L.map(containerRef.current, { zoomSnap: 0.25, minZoom: 4, maxZoom: 11 })
    for (const [name, zIndex] of [['coast', '350'], ['places', '640']] as const) {
      leaflet.createPane(name)
      const pane = leaflet.getPane(name)
      if (pane) {
        pane.style.zIndex = zIndex
        pane.style.pointerEvents = 'none'
      }
    }
    L.tileLayer(COASTLINES_URL, { maxNativeZoom: 13, maxZoom: 11, pane: 'coast', className: 'coast-tiles' }).addTo(leaflet)
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
    leaflet.fitBounds(toLatLngBounds(VIETNAM_BOUNDS))
    const observer = new ResizeObserver(() => leaflet.invalidateSize())
    observer.observe(containerRef.current)
    mapRef.current = leaflet
    onReady?.(leaflet)
    return () => {
      observer.disconnect()
      leaflet.remove()
      mapRef.current = null
    }
    // onReady is only meaningful at creation time.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const leaflet = mapRef.current
    if (!leaflet) {
      return
    }
    baseLayerRef.current?.remove()
    baseLayerRef.current = L.tileLayer(BASEMAPS[basemap].url, {
      maxNativeZoom: NATIVE_ZOOM,
      maxZoom: 11,
      attribution: `${BASEMAPS[basemap].attribution} · Ô lưới: Hỏa Lịch`,
    }).addTo(leaflet)
    baseLayerRef.current.bringToBack()
    leaflet.getContainer().dataset.basemap = basemap
  }, [basemap])

  // Rebuild the cell layer when the data, the colour scale or the stale flag change.
  useEffect(() => {
    const group = cellsLayerRef.current
    if (!group) {
      return
    }
    group.clearLayers()
    layersRef.current.clear()
    for (const cell of cells ?? []) {
      const available = cell.valueStatus === 'AVAILABLE' && cell.value !== null
      const hot = available && scale.classOf(cell.value as number) >= HOT_CLASS
      const layer = L.rectangle(toLatLngBounds(cell.bounds), {
        className: hot ? 'grid-cell grid-cell-hot' : 'grid-cell',
        ...cellStyle(cell, scale, cell.cellId === selectedRef.current, stale),
      })
      layer.bindTooltip(cellTooltip(cell), { sticky: true, className: 'cell-tooltip' })
      layer.on('click', () => {
        if (lockedRef.current || performance.now() < clickGuardUntil.current) {
          return
        }
        callbacks.current.onSelectCell(cell.cellId)
      })
      layer.addTo(group)
      layersRef.current.set(cell.cellId, { layer, cell })
    }
    const selected = selectedRef.current ? layersRef.current.get(selectedRef.current) : undefined
    if (selected) {
      selected.layer.bringToFront()
      const element = selected.layer.getElement()
      if (element) {
        L.DomUtil.addClass(element as HTMLElement, 'grid-cell-selected')
      }
    }
  }, [cells, scale, stale])

  // Selection: restyle only the previous and the new selected rectangles.
  useEffect(() => {
    const previous = selectedRef.current
    selectedRef.current = selectedCellId
    const { scale: currentScale, stale: currentStale } = renderState.current
    for (const [cellId, selected] of [[previous, false], [selectedCellId, true]] as const) {
      const entry = cellId ? layersRef.current.get(cellId) : undefined
      if (!entry) {
        continue
      }
      entry.layer.setStyle(cellStyle(entry.cell, currentScale, selected, currentStale))
      const element = entry.layer.getElement() as HTMLElement | undefined
      if (element) {
        if (selected) {
          L.DomUtil.addClass(element, 'grid-cell-selected')
          entry.layer.bringToFront()
        } else {
          L.DomUtil.removeClass(element, 'grid-cell-selected')
        }
      }
    }
  }, [selectedCellId])

  // Outlines: requested box (dashed) and the extent actually selected (solid) when they differ.
  useEffect(() => {
    const group = outlineLayerRef.current
    if (!group) {
      return
    }
    group.clearLayers()
    if (requestedBounds) {
      L.rectangle(toLatLngBounds(requestedBounds), { color: '#67E8F9', weight: 1.5, dashArray: '6 5', fill: false, className: 'bbox-requested' })
        .bindTooltip('Khung bạn yêu cầu', { className: 'cell-tooltip' })
        .addTo(group)
    }
    const same = requestedBounds && selectedBounds
      && (['west', 'south', 'east', 'north'] as const).every((side) => requestedBounds[side] === selectedBounds[side])
    if (selectedBounds && !same) {
      L.rectangle(toLatLngBounds(selectedBounds), { color: '#67E8F9', weight: 1, opacity: 0.8, fill: false })
        .bindTooltip('Phạm vi thực tế của các ô được chọn', { className: 'cell-tooltip' })
        .addTo(group)
    }
    if (previewBounds) {
      L.rectangle(toLatLngBounds(previewBounds), {
        color: '#67E8F9', weight: 2, fillColor: '#67E8F9', fillOpacity: 0.12, interactive: false, className: 'bbox-preview',
      }).addTo(group)
    }
  }, [requestedBounds, selectedBounds, previewBounds])

  // Fit when the fit key changes (new spatial selection), not on period or cell changes.
  const fitKey = fit?.key
  useEffect(() => {
    const leaflet = mapRef.current
    if (!leaflet || !fit || fit.skip) {
      return
    }
    if (fit.bounds === 'vietnam') {
      leaflet.fitBounds(toLatLngBounds(VIETNAM_BOUNDS))
    } else {
      leaflet.fitBounds(toLatLngBounds(fit.bounds), { padding: [40, 40], maxZoom: NATIVE_ZOOM })
    }
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Box drawing with mouse, pen or touch (the coordinate form is the keyboard alternative).
  // Pointer events are captured on the container so the gesture never reaches the cell layers.
  useEffect(() => {
    const leaflet = mapRef.current
    if (!leaflet || !drawing) {
      return
    }
    const container = leaflet.getContainer()
    leaflet.dragging.disable()
    leaflet.boxZoom.disable()
    leaflet.doubleClickZoom.disable()
    container.classList.add('is-drawing')
    let start: { latlng: L.LatLng; point: L.Point; pointerId: number } | null = null
    let live: L.Rectangle | null = null

    const clear = () => {
      live?.remove()
      live = null
      start = null
    }
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element).closest('.leaflet-control')) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      try {
        container.setPointerCapture(event.pointerId) // keep receiving moves if the pointer leaves the map
      } catch {
        // Pointer no longer active: drawing still works while it stays over the map.
      }
      const latlng = leaflet.mouseEventToLatLng(event)
      clear()
      start = { latlng, point: leaflet.mouseEventToContainerPoint(event), pointerId: event.pointerId }
      live = L.rectangle(L.latLngBounds(latlng, latlng), {
        color: '#67E8F9', weight: 2, dashArray: '6 5', fillColor: '#67E8F9', fillOpacity: 0.08, interactive: false,
      }).addTo(leaflet)
    }
    const onMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      event.stopPropagation()
      live?.setBounds(toLatLngBounds(snapBounds(start.latlng, leaflet.mouseEventToLatLng(event))))
    }
    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      event.stopPropagation()
      clickGuardUntil.current = performance.now() + CLICK_GUARD_MS
      const from = start
      clear()
      if (leaflet.mouseEventToContainerPoint(event).distanceTo(from.point) < MIN_DRAG_PX) {
        return // a click, not a drag: stay in drawing mode
      }
      callbacks.current.onDrawEnd?.(snapBounds(from.latlng, leaflet.mouseEventToLatLng(event)))
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        clear()
        callbacks.current.onDrawCancel?.()
      }
    }
    container.addEventListener('pointerdown', onDown, true)
    container.addEventListener('pointermove', onMove, true)
    container.addEventListener('pointerup', onUp, true)
    container.addEventListener('pointercancel', clear, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      container.removeEventListener('pointerdown', onDown, true)
      container.removeEventListener('pointermove', onMove, true)
      container.removeEventListener('pointerup', onUp, true)
      container.removeEventListener('pointercancel', clear, true)
      document.removeEventListener('keydown', onKey, true)
      clear()
      container.classList.remove('is-drawing')
      leaflet.dragging.enable()
      leaflet.boxZoom.enable()
      leaflet.doubleClickZoom.enable()
    }
  }, [drawing])

  return (
    <div className="map-frame">
      <div ref={containerRef} className="map" role="region" aria-label={ariaLabel} />
      {children}
    </div>
  )
}
