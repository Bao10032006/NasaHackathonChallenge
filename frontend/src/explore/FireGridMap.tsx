import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { endpoint } from './api'
import type { Area, Bounds, Grid, TimeQuery } from './api'
import { useResource } from './useResource'
import { useI18n } from '../i18n'
import { SatelliteTiles, worldX, worldY, longitude, latitude } from './SatelliteTiles'
import type { Basemap } from './SatelliteTiles'
import coastlines from './southeast-asia.json'

const width = 580
const view = { west: 97, east: 116, south: 7, north: 24 }
const west = worldX(view.west)
const north = worldY(view.north)
const spanX = worldX(view.east) - west
const spanY = worldY(view.south) - north
const height = width * spanY / spanX
const projectX = (value: number) => (value - west) / spanX * width
const projectY = (value: number) => (value - north) / spanY * height
const x = (lon: number) => projectX(worldX(lon))
const y = (lat: number) => projectY(worldY(lat))
const land = coastlines.map(({ vietnam, ring }) => ({
  vietnam, path: ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join(' ') + 'Z',
}))
/** Heat ramp, low → high: yellow, orange, red, deep red. Lightness falls with each step, so classes stay apart without hue. */
const colors = ['#ffd84d', '#ff9a2e', '#f4502a', '#c4122f']
/** The same ramp colours the fire calendar, so one legend reads across the page. */
export const heatRamp: readonly string[] = colors
const basemapChoices = [['imagery', 'satellite'], ['topo', 'topo'], ['none', 'plainMap']] as const
/** Dot radius per class: busier cells read larger as well as hotter. The hit target stays the whole cell. */
const radii = [1.7, 2.1, 2.5, 2.9]
/** Only the two hottest classes get a soft halo, so hotspots stand out without blurring neighbours together. */
const halos = [0, 0, 0.26, 0.4]
export type ColorDomain = { min: number; max: number }
export type MarkerThresholds = { national: number; regional: number; close: number }
const softLimits = { national: 140, regional: 75 }

export function MapColorScale({ domain }: { domain?: ColorDomain }) {
  const { t, detectionCount } = useI18n()
  if (!domain) return <span>{t('colorScaleUnavailable')}</span>
  return (
    <div className="legend-scale" aria-label={t('colorScaleRange')}>
      <span>{detectionCount(domain.min)}</span>
      {colors.map((color) => <i key={color} style={{ background: color }} aria-hidden="true" />)}
      <span>{detectionCount(domain.max)}</span>
    </div>
  )
}

function rect(bounds: Bounds) {
  return { x: x(bounds.west), y: y(bounds.north), width: x(bounds.east) - x(bounds.west), height: y(bounds.south) - y(bounds.north) }
}

type Coordinates = { lon: number; lat: number }
export type RegionLayer = { areas: Area[]; time: TimeQuery; onSelect: (area: Area) => void }

/**
 * One analysis region drawn from its own grid cells (ids are row_column on the 0.25° grid).
 * Hovering highlights the region and reports its total; a click or Enter opens it.
 */
function RegionShape({ area, time, hovered, canSelect, onSelect, onHover, onReady }: {
  area: Area
  time: TimeQuery
  hovered: boolean
  canSelect: () => boolean
  onSelect: (area: Area) => void
  onHover: (areaId?: string) => void
  onReady: (areaId: string, info: { ids: Set<string>; label: string }) => void
}) {
  const { areaLabel, detectionLabel } = useI18n()
  const grid = useResource<Grid>(endpoint('/map/cells', { areaType: area.type, areaId: area.id, ...time }))
  const data = grid.data
  const label = data ? `${areaLabel(area)} · ${detectionLabel(data.summary.totalValue, data.summary.valueStatus)}` : ''
  // The map hit-tests the pointer against these cells, so a region lights up even under its fire markers.
  useEffect(() => {
    if (data) onReady(area.id, { ids: new Set(data.cells.map((cell) => cell.cellId)), label })
  }, [data, label])
  if (!data) return null
  const ids = new Set(data.cells.map((cell) => cell.cellId))
  let fill = ''
  let edge = ''
  for (const cell of data.cells) {
    const [row, column] = cell.cellId.split('_').map(Number)
    const frame = rect(cell.bounds)
    const [left, top, w, h] = [frame.x, frame.y, frame.width, frame.height].map((value) => Number(value.toFixed(2)))
    fill += `M${left},${top}h${w}v${h}h${-w}Z`
    if (!ids.has(`${row + 1}_${column}`)) edge += `M${left},${top}h${w}`
    if (!ids.has(`${row - 1}_${column}`)) edge += `M${left},${top + h}h${w}`
    if (!ids.has(`${row}_${column - 1}`)) edge += `M${left},${top}v${h}`
    if (!ids.has(`${row}_${column + 1}`)) edge += `M${left + w},${top}v${h}`
  }
  const select = () => {
    onHover(undefined)
    onSelect(area)
  }
  return (
    <g className={hovered ? 'region-shape hovered' : 'region-shape'} role="button" tabIndex={0} aria-label={label}
      onClick={() => { if (canSelect()) select() }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          select()
        }
      }}
      onFocus={() => onHover(area.id)} onBlur={() => onHover(undefined)}>
      <title>{label}</title>
      <path d={fill} className="region-fill" />
      <path d={edge} className="region-edge" />
    </g>
  )
}
export type Camera = { x: number; y: number; zoom: number }
export const nationalCamera = { x: width / 2, y: height / 2, zoom: 1 }
const maxZoom = 16

function constrainCamera(camera: Camera): Camera {
  const halfWidth = width / (2 * camera.zoom)
  const halfHeight = height / (2 * camera.zoom)
  return {
    ...camera,
    x: Math.max(halfWidth, Math.min(width - halfWidth, camera.x)),
    y: Math.max(halfHeight, Math.min(height - halfHeight, camera.y)),
  }
}

/** Zooms while keeping `point` (in map units) under the pointer or the fingers that asked for it. */
function zoomAround(camera: Camera, zoom: number, point: { x: number; y: number }): Camera {
  const next = Math.max(1, Math.min(maxZoom, zoom))
  const ratio = camera.zoom / next
  return constrainCamera({ zoom: next, x: point.x + (camera.x - point.x) * ratio, y: point.y + (camera.y - point.y) * ratio })
}

function fittedCamera(bounds?: Bounds): Camera {
  if (!bounds) return nationalCamera
  const frame = rect(bounds)
  return constrainCamera({
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
    zoom: Math.max(1, Math.min(10, width / (frame.width * 1.6), height / (frame.height * 1.6))),
  })
}

function box(a: Coordinates, b: Coordinates): Bounds {
  return { west: Math.min(a.lon, b.lon), south: Math.min(a.lat, b.lat), east: Math.max(a.lon, b.lon), north: Math.max(a.lat, b.lat) }
}

export function FireGridMap({ grid, focus, requested, drawing, activeCell, period, camera: savedCamera,
  id = 'fire-map', title, colorDomain, sharedLegend = false, markerFilter, regionLayer,
  onCamera, onBack, onDraw, onDrawToggle, onCell }: {
  grid?: Grid
  id?: string
  title?: string
  colorDomain?: ColorDomain
  sharedLegend?: boolean
  markerFilter?: { thresholds: MarkerThresholds; showAll: boolean; onToggle: () => void }
  /** Nationwide view only: regions become hover-and-click shapes under the fire markers. */
  regionLayer?: RegionLayer
  focus?: Bounds
  requested?: Bounds
  drawing: boolean
  activeCell: string | null
  period: string
  camera?: Camera
  onCamera: (camera: Camera) => void
  onBack?: () => void
  onDraw?: (bounds: Bounds) => void
  /** Puts a draw-a-box button on the map itself, next to the zoom controls. */
  onDrawToggle?: () => void
  onCell: (cellId: string) => void
}) {
  const { t, number, detectionLabel, language } = useI18n()
  const coords = useRef<HTMLParagraphElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const reticle = useRef<SVGGElement>(null)
  const start = useRef<{ geographic: Coordinates; clientX: number; clientY: number; camera: Camera } | null>(null)
  const moved = useRef(false)
  const [preview, setPreview] = useState<Bounds>()
  const [basemap, setBasemap] = useState<Basemap | 'none'>('imagery')
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
  const [hoverRegion, setHoverRegion] = useState<string>()
  const regionInfo = useRef(new Map<string, { ids: Set<string>; label: string }>())
  const regionLabel = hoverRegion ? regionInfo.current.get(hoverRegion)?.label : undefined
  useEffect(() => {
    if (!savedCamera && focus) onCamera(fittedCamera(focus))
  }, [savedCamera, focus, onCamera])
  const camera = savedCamera ?? fittedCamera(focus)
  const viewWidth = width / camera.zoom
  const viewHeight = height / camera.zoom
  const left = camera.x - viewWidth / 2
  const top = camera.y - viewHeight / 2
  const max = grid?.summary.maxCellValue ?? 0
  const domain = colorDomain ?? { min: 0, max }
  const bounds = (drawing ? preview : undefined) ?? requested
  const live = useRef({ camera, onCamera, drawing })
  live.current = { camera, onCamera, drawing }
  useEffect(() => {
    if (!svg.current) return
    const map: SVGSVGElement = svg.current
    const mapPoint = (clientX: number, clientY: number) => {
      const screen = map.getScreenCTM()
      return screen ? new DOMPoint(clientX, clientY).matrixTransform(screen.inverse()) : undefined
    }
    // A scroll that began elsewhere keeps scrolling the page while the map passes under the pointer.
    let pageScrollAt = -Infinity
    const pageWheel = (event: WheelEvent) => {
      if (!map.contains(event.target as Node)) pageScrollAt = event.timeStamp
    }
    const wheel = (event: WheelEvent) => {
      const { camera, onCamera, drawing } = live.current
      // Ctrl + wheel is how a trackpad pinch arrives; without this the browser would zoom the whole page.
      if (event.ctrlKey) event.preventDefault()
      const rate = event.deltaMode === 1 ? 0.05 : event.ctrlKey ? 0.012 : 0.0022
      const next = Math.max(1, Math.min(maxZoom, camera.zoom * Math.exp(-event.deltaY * rate)))
      const point = mapPoint(event.clientX, event.clientY)
      // At either zoom limit the wheel goes back to the page, so the map never traps scrolling.
      if (drawing || !point || next === camera.zoom || (!event.ctrlKey && event.timeStamp - pageScrollAt < 400)) {
        if (!event.ctrlKey) pageScrollAt = event.timeStamp
        return
      }
      event.preventDefault()
      onCamera(zoomAround(camera, next, point))
    }
    let pinch: { distance: number; camera: Camera; point: DOMPoint } | undefined
    const fingers = (event: TouchEvent) => {
      const [a, b] = [event.touches[0], event.touches[1]]
      return { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
    }
    const touchStart = (event: TouchEvent) => {
      pinch = undefined
      if (event.touches.length !== 2 || live.current.drawing) return
      const now = fingers(event)
      const point = mapPoint(now.x, now.y)
      if (!point || now.distance === 0) return
      pinch = { distance: now.distance, camera: live.current.camera, point }
      start.current = null
    }
    const touchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return
      event.preventDefault()
      moved.current = true
      live.current.onCamera(zoomAround(pinch.camera, pinch.camera.zoom * fingers(event).distance / pinch.distance, pinch.point))
    }
    const touchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = undefined
    }
    window.addEventListener('wheel', pageWheel, { passive: true })
    map.addEventListener('wheel', wheel, { passive: false })
    map.addEventListener('touchstart', touchStart, { passive: true })
    map.addEventListener('touchmove', touchMove, { passive: false })
    map.addEventListener('touchend', touchEnd)
    map.addEventListener('touchcancel', touchEnd)
    return () => {
      window.removeEventListener('wheel', pageWheel)
      map.removeEventListener('wheel', wheel)
      map.removeEventListener('touchstart', touchStart)
      map.removeEventListener('touchmove', touchMove)
      map.removeEventListener('touchend', touchEnd)
      map.removeEventListener('touchcancel', touchEnd)
    }
  }, [])
  const allZero = grid?.summary.valueStatus === 'AVAILABLE' && grid.cells.length > 0 &&
    grid.cells.every((cell) => cell.valueStatus === 'AVAILABLE' && cell.value === 0)
  const zoomLevel = camera.zoom >= 3 ? 'close' : focus || camera.zoom >= 1.5 ? 'regional' : 'national'
  const baseThreshold = markerFilter?.thresholds[zoomLevel]
  const softLimit = zoomLevel === 'close' ? undefined : softLimits[zoomLevel]
  const cells = (grid?.cells ?? []).map((cell) => {
    const cx = x(cell.center.lon)
    const cy = y(cell.center.lat)
    const inView = cx >= left && cx <= left + viewWidth && cy >= top && cy <= top + viewHeight
    const activity = cell.valueStatus === 'AVAILABLE' ? cell.value ?? 0 : 0
    return { cell, cx, cy, inView, activity }
  })
  const visibleValues = cells.filter(({ inView, activity }) => inView && activity > 0).map(({ activity }) => activity)
  let threshold = baseThreshold
  if (threshold !== undefined && !markerFilter?.showAll && softLimit && visibleValues.length > softLimit) {
    // Keep every cell at the cutoff so ties are rendered consistently.
    const cutoff = visibleValues.sort((a, b) => b - a)[softLimit - 1]
    threshold = Math.max(threshold, cutoff)
  }
  const markers = cells.map((entry) => ({
    ...entry,
    showMarker: entry.activity > 0 && (threshold === undefined
      || (entry.inView && (markerFilter?.showAll || entry.activity >= threshold))),
  }))
  const visibleActivity = visibleValues.length
  const markerCount = markers.filter(({ showMarker }) => showMarker).length

  function location(event: PointerEvent<SVGSVGElement>) {
    const screen = event.currentTarget.getScreenCTM()
    if (!screen) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(screen.inverse())
    return {
      lon: longitude(west + Math.max(left, Math.min(left + viewWidth, point.x)) / width * spanX),
      lat: latitude(north + Math.max(top, Math.min(top + viewHeight, point.y)) / height * spanY),
    }
  }

  function finish(event: PointerEvent<SVGSVGElement>) {
    const begin = start.current
    start.current = null
    setPreview(undefined)
    if (!drawing || !begin || Math.abs(event.clientX - begin.clientX) < 4 || Math.abs(event.clientY - begin.clientY) < 4) return
    const end = location(event)
    if (end) onDraw?.(box(begin.geographic, end))
  }

  function zoom(factor: number) {
    const nextZoom = Math.max(1, Math.min(maxZoom, camera.zoom * factor))
    onCamera(constrainCamera({ ...camera, zoom: nextZoom }))
  }

  return (
    <section className="panel map-panel" aria-labelledby={id + '-title'}>
      <div className="panel-heading">
        <h2 id={id + '-title'}>{title ?? t('mapTitle')}</h2>
      </div>
      {drawing && <p className="drawing-note" role="status">{t('drawHint')}</p>}
      <div className="map-frame">
      <div className="map-tools" role="group" aria-label={t('mapControls')}>
        <span className="basemap-switch" role="group" aria-label={t('basemap')}>
          {basemapChoices.map(([id, label]) => <button key={id} type="button" aria-pressed={basemap === id} onClick={() => {
            setTilesUnavailable(false)
            setBasemap(id)
          }}>{t(label)}</button>)}
        </span>
        <button type="button" aria-label={t('zoomIn')} disabled={camera.zoom >= maxZoom || drawing} onClick={() => zoom(1.5)}>+</button>
        <button type="button" aria-label={t('zoomOut')} disabled={camera.zoom <= 1 || drawing} onClick={() => zoom(1 / 1.5)}>−</button>
        <button type="button" disabled={drawing} onClick={() => onCamera(nationalCamera)}>{t('resetCamera')}</button>
        {onDrawToggle && <button type="button" aria-pressed={drawing} onClick={onDrawToggle}>{drawing ? t('cancelDrawing') : t('drawArea')}</button>}
        {onBack && <button type="button" className="map-back" aria-label={t('backToArea')}
          title={t('backToArea')} onClick={onBack}>×</button>}
      </div>
      <svg ref={svg} id={id} viewBox={`${left} ${top} ${viewWidth} ${viewHeight}`}
        width={width} height={height}
        className={drawing ? 'map drawing' : camera.zoom > 1 ? 'map pannable' : 'map'}
        aria-label={t('mapDescription')}
        onPointerDown={(event) => {
          moved.current = false
          if (event.button !== 0 || (!drawing && camera.zoom <= 1)) return
          const geographic = location(event)
          if (!geographic) return
          start.current = { geographic, clientX: event.clientX, clientY: event.clientY, camera }
          if (drawing) event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          // The torch and its sight follow the pointer on every basemap; they are moved directly so no render is needed.
          const screen = event.pointerType === 'touch' ? null : event.currentTarget.getScreenCTM()
          if (screen && reticle.current) {
            const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(screen.inverse())
            reticle.current.setAttribute('transform', `translate(${at.x.toFixed(2)} ${at.y.toFixed(2)}) scale(${(1 / camera.zoom).toFixed(4)})`)
            reticle.current.classList.add('on')
          }
          const begin = start.current
          const point = begin ? undefined : location(event)
          if (point && coords.current) {
            const figure = (value: number) => Math.abs(value).toFixed(2).replace('.', language === 'vi' ? ',' : '.')
            coords.current.textContent = `${figure(point.lat)}° ${t('north')} · ${figure(point.lon)}° ${t('east')}`
          }
          if (regionLayer && !drawing && !begin) {
            const id = point && `${Math.floor(point.lat / 0.25)}_${Math.floor(point.lon / 0.25)}`
            let found: string | undefined
            if (id) for (const [areaId, info] of regionInfo.current) if (info.ids.has(id)) found = areaId
            if (found !== hoverRegion) setHoverRegion(found)
          }
          if (!begin) return
          if (drawing) {
            const end = location(event)
            if (end) setPreview(box(begin.geographic, end))
            return
          }
          const dx = event.clientX - begin.clientX
          const dy = event.clientY - begin.clientY
          if (!moved.current && Math.hypot(dx, dy) < 4) return
          moved.current = true
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId)
          const scale = event.currentTarget.getScreenCTM()?.a
          if (scale) onCamera(constrainCamera({
            ...begin.camera,
            x: begin.camera.x - dx / scale,
            y: begin.camera.y - dy / scale,
          }))
        }}
        onPointerLeave={() => {
          reticle.current?.classList.remove('on')
          setHoverRegion(undefined)
          if (coords.current) coords.current.textContent = ''
          if (!drawing && !moved.current) start.current = null
        }}
        onPointerUp={finish} onPointerCancel={() => { start.current = null; setPreview(undefined) }}>
        <rect width={width} height={height} className="sea" />
        <g aria-hidden="true">
          {[100, 105, 110, 115].map((lon) => <line key={lon} x1={x(lon)} x2={x(lon)} y1={0} y2={height} className="map-grid" />)}
          {[10, 15, 20].map((lat) => <line key={lat} x1={0} x2={width} y1={y(lat)} y2={y(lat)} className="map-grid" />)}
          {land.map((item, i) => <path key={i} d={item.path} className={item.vietnam ? 'vietnam' : 'land'} />)}
          <text x={x(111.4)} y={y(16.6)} className="sea-label">{t('sea')}</text>
          <text x={x(101)} y={y(19)} className="land-label">{t('southeastAsia')}</text>
        </g>
        {basemap !== 'none' && <SatelliteTiles basemap={basemap}
          viewport={{ west: west + left / width * spanX, north: north + top / height * spanY, width: viewWidth / width * spanX, height: viewHeight / height * spanY }}
          pixels={width}
          projectX={projectX} projectY={projectY}
          onImageError={() => setTilesUnavailable(true)}
        />}
        {basemap !== 'none' && <g aria-hidden="true" pointerEvents="none">
          {[100, 105, 110, 115].map((lon) => <line key={lon} x1={x(lon)} x2={x(lon)} y1={0} y2={height} className="map-grid" />)}
          {[10, 15, 20].map((lat) => <line key={lat} x1={0} x2={width} y1={y(lat)} y2={y(lat)} className="map-grid" />)}
          {land.filter((item) => item.vietnam).map((item, i) => <path key={i} d={item.path} className="vietnam-outline" />)}
        </g>}
        <g aria-hidden="true" pointerEvents="none">
          {[100, 105, 110, 115].map((lon) => <text key={'lon-' + lon} x={x(lon) + 2.5} y={height - 5} className="graticule-label">{lon}°E</text>)}
          {[10, 15, 20].map((lat) => <text key={'lat-' + lat} x={4} y={y(lat) - 3} className="graticule-label">{lat}°N</text>)}
        </g>
        {regionLayer && !drawing && <g className="region-layer">
          {regionLayer.areas.map((area) => <RegionShape key={area.id} area={area} time={regionLayer.time}
            hovered={hoverRegion === area.id} canSelect={() => !moved.current} onSelect={regionLayer.onSelect} onHover={setHoverRegion}
            onReady={(areaId, info) => { regionInfo.current.set(areaId, info) }} />)}
        </g>}
        {markers.map(({ cell, cx, cy, inView, showMarker }) => {
          const selected = activeCell === cell.cellId
          if (!showMarker && !(selected && (sharedLegend || (markerFilter && inView)))) return null
          const ratio = showMarker && cell.value != null && domain.max > domain.min
            ? Math.min(1, Math.max(0, (cell.value - domain.min) / (domain.max - domain.min))) : 0
          const index = Math.min(colors.length - 1, Math.floor(Math.sqrt(ratio) * colors.length))
          const label = `${t('cell', { id: cell.cellId })} · ${detectionLabel(cell.value, cell.valueStatus)}${cell.partial ? ' · ' + t('partialPeriod') : ''}`
          return (
            <g key={cell.cellId} className={drawing ? undefined : 'map-cell'}
              role={drawing ? undefined : 'button'} aria-label={label} tabIndex={drawing ? undefined : 0}
              aria-pressed={drawing ? undefined : activeCell === cell.cellId}
              onClick={drawing ? undefined : () => { if (!moved.current) onCell(cell.cellId) }}
              onKeyDown={(event) => {
                if (!drawing && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onCell(cell.cellId)
                }
              }}>
              <title>{label + (cell.origin ? ' · ' + t(cell.origin) : '')}</title>
              <rect {...rect(cell.bounds)} className={activeCell === cell.cellId ? 'cell-outline selected' : 'cell-outline'} />
              {showMarker && halos[index] > 0 && <circle cx={cx} cy={cy} r={radii[index] + 1.8} fill={colors[index]} opacity={halos[index]} className="cell-halo" />}
              {showMarker && <circle cx={cx} cy={cy} r={selected ? radii[index] + 0.6 : radii[index]} fill={colors[index]}
                className={cell.origin === 'MODEL_REDISTRIBUTED' ? 'cell-marker estimated' : 'cell-marker'} />}
              {selected && showMarker && <circle cx={cx} cy={cy} r="4.6" className="cell-pulse" />}
            </g>
          )
        })}
        {bounds && <rect {...rect(bounds)} className="draw-box" />}
        <defs>
          <radialGradient id={id + '-torch'}>
            <stop offset="0" stopColor="#ffc46b" stopOpacity=".5" />
            <stop offset=".4" stopColor="#ff6a2b" stopOpacity=".2" />
            <stop offset="1" stopColor="#ff6a2b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g ref={reticle} className="map-reticle" aria-hidden="true" pointerEvents="none">
          <circle r="38" fill={`url(#${id}-torch)`} className="reticle-torch" />
          <circle r="7.5" className="reticle-ring" />
          <path d="M-14 0H-9.5M9.5 0H14M0 -14V-9.5M0 9.5V14" className="reticle-tick" />
        </g>
      </svg>
      <p ref={coords} className="map-coords" aria-hidden="true" />
      {regionLayer && !drawing && <p className={regionLabel ? 'map-readout' : 'map-readout hint'} aria-hidden="true">{regionLabel ?? t('regionHint')}</p>}
      </div>
      <div className="map-legend" hidden={sharedLegend && !allZero && (!grid || grid.summary.valueStatus === 'AVAILABLE')}>
        {!sharedLegend && <>
        <div className="map-legend-row">
          <span>{t('metric')} · {period}</span>
          <MapColorScale domain={max > 0 ? domain : undefined} />
        </div>
        </>}
        {markerFilter && threshold !== undefined && grid?.summary.valueStatus === 'AVAILABLE' && (
          <>
            <div className="map-legend-row">
              <p>
                {t('markerCount', { count: `${number(markerCount)}/${number(visibleActivity)}` })}
                {' · '}{markerFilter.showAll ? t('positiveMarkers') : t(
                  threshold === Number(threshold.toFixed(2)) ? 'threshold' : 'approximateThreshold',
                  { value: number(threshold) },
                )}
              </p>
              <button className="map-marker-toggle quiet" type="button" onClick={markerFilter.onToggle}>
                {markerFilter.showAll ? t('restoreThreshold') : t('showAllMarkers')}
              </button>
            </div>
            {visibleActivity > 0 && markerCount === 0 && <p role="status">{t('belowThreshold')}</p>}
          </>
        )}
        {allZero && <p role="status">{t('zeroPeriod')}</p>}
        {grid && grid.summary.valueStatus !== 'AVAILABLE' && (
          <p role="status">{t('periodStatus', { status: t(grid.summary.valueStatus) })}</p>
        )}
        {!sharedLegend && <details>
          <summary>{t('legend')}</summary>
          <p>{t('markerMeaning')}</p>
          {markerFilter && <p>{t('thresholdMeaning')}</p>}
          <p>{t('mapColorMeaning')}</p>
          <p className="legend-symbol">
            <svg width="16" height="16" viewBox="0 0 8 8" aria-hidden="true">
              <circle cx="4" cy="4" r="2.6" fill={colors[1]} className="cell-marker estimated" />
            </svg>
            {t('estimatedMarker')}
          </p>
        </details>}
      </div>
      {basemap !== 'none' && <p className="map-source">
        {basemap === 'topo'
          ? <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer" target="_blank" rel="noreferrer">{t('topoCredit')}</a>
          : <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">{t('imageryCredit')}</a>}
        {basemap !== 'topo' && <>{' · '}{t('labelCredit')}</>}
        {tilesUnavailable && <span role="status"> · {t('imageryUnavailable')}</span>}
      </p>}
    </section>
  )
}
