import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Bounds, Grid } from './api'
import { number, origins, valueLabel } from './display'
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
const colors = ['#ffc078', '#fb933e', '#fb5c4e', '#ef343d']

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
  onCamera, onBack, onDraw, onCell }: {
  grid?: Grid
  focus?: Bounds
  requested?: Bounds
  drawing: boolean
  activeCell: string | null
  period: string
  camera?: Camera
  onCamera: (camera: Camera) => void
  onBack?: () => void
  onDraw: (bounds: Bounds) => void
  onCell: (cellId: string) => void
}) {
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
  const bounds = (drawing ? preview : undefined) ?? requested
  const allZero = grid?.summary.valueStatus === 'AVAILABLE' && grid.cells.length > 0 &&
    grid.cells.every((cell) => cell.valueStatus === 'AVAILABLE' && cell.value === 0)

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
    if (end) onDraw(box(begin.geographic, end))
  }

  function zoom(factor: number) {
    const nextZoom = Math.max(1, Math.min(maxZoom, camera.zoom * factor))
    onCamera(constrainCamera({ ...camera, zoom: nextZoom }))
  }

  return (
    <section className="panel map-panel" aria-labelledby="map-title">
      <div className="panel-heading">
        <h2 id="map-title">Bản đồ hoạt động đốt</h2>
        <span className="pill">Lưới 0,25°</span>
      </div>
      {drawing && <p className="drawing-note" role="status">Kéo trên bản đồ để khoanh vùng. Tâm ô nằm trong hoặc trên biên khung sẽ được tính.</p>}
      <div className="map-frame">
      <div className="map-tools" role="group" aria-label="Điều khiển bản đồ">
        <button type="button" aria-pressed={satellite} onClick={() => {
          if (!satellite) setTilesUnavailable(false)
          setSatellite(!satellite)
        }}>Ảnh vệ tinh</button>
        <button type="button" aria-label="Phóng to" disabled={camera.zoom >= maxZoom || drawing} onClick={() => zoom(1.5)}>+</button>
        <button type="button" aria-label="Thu nhỏ" disabled={camera.zoom <= 1 || drawing} onClick={() => zoom(1 / 1.5)}>−</button>
        <button type="button" disabled={drawing} onClick={() => onCamera(nationalCamera)}>Thu camera về toàn quốc</button>
        {onBack && <button type="button" className="map-back" aria-label="Quay lại vùng trước"
          title="Quay lại vùng trước" onClick={onBack}>×</button>}
      </div>
      <svg id="fire-map" viewBox={`${left} ${top} ${viewWidth} ${viewHeight}`}
        width={width} height={height}
        className={drawing ? 'map drawing' : camera.zoom > 1 ? 'map pannable' : 'map'}
        aria-label="Bản đồ Việt Nam và các ô lưới đang xem"
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
          <text x={x(111.4)} y={y(16.6)} className="sea-label">BIỂN ĐÔNG</text>
          <text x={x(101)} y={y(19)} className="land-label">ĐÔNG NAM Á</text>
        </g>
        {satellite && <SatelliteTiles
          viewport={{ west: west + left / width * spanX, north: north + top / height * spanY, width: viewWidth / width * spanX, height: viewHeight / height * spanY }}
          pixels={width}
          projectX={projectX} projectY={projectY}
          onImageError={() => setTilesUnavailable(true)}
        />}
        {grid?.cells.map((cell) => {
          if (cell.valueStatus !== 'AVAILABLE' || cell.value == null || cell.value <= 0) return null
          const ratio = max > 0 ? cell.value / max : 0
          const index = Math.min(colors.length - 1, Math.floor(Math.sqrt(ratio) * colors.length))
          const label = `Ô ${cell.cellId} · ${valueLabel(cell.value, cell.valueStatus)} phát hiện tương đương S-NPP${cell.partial ? ' · Kỳ chưa đầy đủ' : ''}`
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
              <title>{label}{cell.origin ? ' · ' + origins[cell.origin] : ''}</title>
              <rect {...rect(cell.bounds)} className={activeCell === cell.cellId ? 'cell-outline selected' : 'cell-outline'} />
              <circle cx={x(cell.center.lon)} cy={y(cell.center.lat)} r={activeCell === cell.cellId ? 3.5 : 2.3} fill={colors[index]}
                className={cell.origin === 'MODEL_REDISTRIBUTED' ? 'cell-marker estimated' : 'cell-marker'} />
            </g>
          )
        })}
        {bounds && <rect {...rect(bounds)} className="draw-box" />}
      </svg>
      </div>
      <div className="map-legend">
        <div className="map-legend-row">
          <span>Số phát hiện tương đương S-NPP · {period}</span>
          <div className="legend-scale" aria-label="Thang màu từ thấp đến cao">
            <span>Thấp</span>{colors.map((color) => <i key={color} style={{ background: color }} aria-hidden="true" />)}
            <span>Cao{max > 0 ? ' · ' + number(max) : ''}</span>
          </div>
        </div>
        {allZero && <p role="status">Kỳ này có dữ liệu, tất cả ô đều có giá trị 0.</p>}
        {grid && grid.summary.valueStatus !== 'AVAILABLE' && (
          <p role="status">{valueLabel(grid.summary.totalValue, grid.summary.valueStatus)} cho kỳ này.</p>
        )}
        <details>
          <summary>Chú giải</summary>
          <p>Mỗi chấm là một ô lưới 0,25° có hoạt động được ghi nhận trong kỳ đang xem. Bản đồ chỉ vẽ chấm ở ô có giá trị lớn hơn 0.</p>
          <p>Màu đậm hơn biểu thị số phát hiện tương đương S-NPP cao hơn.</p>
          <p className="legend-symbol">
            <svg width="16" height="16" viewBox="0 0 8 8" aria-hidden="true">
              <circle cx="4" cy="4" r="2.3" fill={colors[1]} className="cell-marker estimated" />
            </svg>
            Chấm có viền hổ phách biểu thị giá trị ước tính.
          </p>
        </details>
      </div>
      {satellite && <p className="map-source">
        <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Nền ảnh: Esri World Imagery và các nhà cung cấp</a>
        {' · '}Tên địa danh: Esri
        {tilesUnavailable && <span role="status"> · Nền tối hiển thị ở nơi ảnh chưa tải được.</span>}
      </p>}
    </section>
  )
}
