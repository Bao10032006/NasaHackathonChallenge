import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Bounds, Grid } from './api'
import { useI18n } from '../i18n'
import { SatelliteTiles, worldX, worldY, longitude, latitude } from './SatelliteTiles'
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
/** Dot radius per class: busier cells read larger as well as hotter. The hit target stays the whole cell. */
const radii = [1.7, 2.1, 2.5, 2.9]
/** Only the two hottest classes get a soft halo, so hotspots stand out without blurring neighbours together. */
const halos = [0, 0, 0.26, 0.4]
export type ColorDomain = { min: number; max: number }
export type MarkerThresholds = { national: number; regional: number; close: number }

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
  id = 'fire-map', title, colorDomain, sharedLegend = false, markerFilter,
  onCamera, onBack, onDraw, onCell }: {
  grid?: Grid
  id?: string
  title?: string
  colorDomain?: ColorDomain
  sharedLegend?: boolean
  markerFilter?: { thresholds: MarkerThresholds; showAll: boolean; onToggle: () => void }
  focus?: Bounds
  requested?: Bounds
  drawing: boolean
  activeCell: string | null
  period: string
  camera?: Camera
  onCamera: (camera: Camera) => void
  onBack?: () => void
  onDraw?: (bounds: Bounds) => void
  onCell: (cellId: string) => void
}) {
  const { t, number, detectionLabel } = useI18n()
  const start = useRef<{ geographic: Coordinates; clientX: number; clientY: number; camera: Camera } | null>(null)
  const moved = useRef(false)
  const [preview, setPreview] = useState<Bounds>()
  const [satellite, setSatellite] = useState(true)
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
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
  const allZero = grid?.summary.valueStatus === 'AVAILABLE' && grid.cells.length > 0 &&
    grid.cells.every((cell) => cell.valueStatus === 'AVAILABLE' && cell.value === 0)
  const zoomLevel = camera.zoom >= 3 ? 'close' : focus || camera.zoom >= 1.5 ? 'regional' : 'national'
  const threshold = markerFilter?.thresholds[zoomLevel]
  const markers = (grid?.cells ?? []).map((cell) => {
    const cx = x(cell.center.lon)
    const cy = y(cell.center.lat)
    const inView = cx >= left && cx <= left + viewWidth && cy >= top && cy <= top + viewHeight
    const value = cell.valueStatus === 'AVAILABLE' ? cell.value : null
    const hasActivity = value != null && value > 0
    const showMarker = hasActivity && (threshold === undefined || (inView && (markerFilter?.showAll || value >= threshold)))
    return { cell, cx, cy, inView, hasActivity, showMarker }
  })
  const visibleActivity = markers.filter(({ inView, hasActivity }) => inView && hasActivity).length
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
        <button type="button" aria-pressed={satellite} onClick={() => {
          if (!satellite) setTilesUnavailable(false)
          setSatellite(!satellite)
        }}>{t('satellite')}</button>
        <button type="button" aria-label={t('zoomIn')} disabled={camera.zoom >= maxZoom || drawing} onClick={() => zoom(1.5)}>+</button>
        <button type="button" aria-label={t('zoomOut')} disabled={camera.zoom <= 1 || drawing} onClick={() => zoom(1 / 1.5)}>−</button>
        <button type="button" disabled={drawing} onClick={() => onCamera(nationalCamera)}>{t('resetCamera')}</button>
        {onBack && <button type="button" className="map-back" aria-label={t('backToArea')}
          title={t('backToArea')} onClick={onBack}>×</button>}
      </div>
      <svg id={id} viewBox={`${left} ${top} ${viewWidth} ${viewHeight}`}
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
          const begin = start.current
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
        onPointerLeave={() => { if (!drawing && !moved.current) start.current = null }}
        onPointerUp={finish} onPointerCancel={() => { start.current = null; setPreview(undefined) }}>
        <rect width={width} height={height} className="sea" />
        <g aria-hidden="true">
          {[100, 105, 110, 115].map((lon) => <line key={lon} x1={x(lon)} x2={x(lon)} y1={0} y2={height} className="map-grid" />)}
          {[10, 15, 20].map((lat) => <line key={lat} x1={0} x2={width} y1={y(lat)} y2={y(lat)} className="map-grid" />)}
          {land.map((item, i) => <path key={i} d={item.path} className={item.vietnam ? 'vietnam' : 'land'} />)}
          <text x={x(111.4)} y={y(16.6)} className="sea-label">{t('sea')}</text>
          <text x={x(101)} y={y(19)} className="land-label">{t('southeastAsia')}</text>
        </g>
        {satellite && <SatelliteTiles
          viewport={{ west: west + left / width * spanX, north: north + top / height * spanY, width: viewWidth / width * spanX, height: viewHeight / height * spanY }}
          pixels={width}
          projectX={projectX} projectY={projectY}
          onImageError={() => setTilesUnavailable(true)}
        />}
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
      </svg>
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
                {' · '}{markerFilter.showAll ? t('positiveMarkers') : t('threshold', { value: number(threshold) })}
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
      {satellite && <p className="map-source">
        <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">{t('imageryCredit')}</a>
        {' · '}{t('labelCredit')}
        {tilesUnavailable && <span role="status"> · {t('imageryUnavailable')}</span>}
      </p>}
    </section>
  )
}
