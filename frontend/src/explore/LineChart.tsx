import { useEffect, useId, useRef, useState } from 'react'
import type { Origin } from '../api/types'
import { ORIGIN_MARKER, axisTicks, compactValue } from '../lib/scale'

export interface ChartPoint {
  x: number
  /** null leaves a gap (outside range / insufficient). */
  y: number | null
  origin?: Origin | null
  /** Partial periods are drawn hollow and labelled. */
  partial?: boolean
  title: string
}

export interface ChartSeries {
  id: string
  label: string
  color: string
  dash?: string
  points: ChartPoint[]
  /** Draw markers (shape = origin) for this series. */
  markers?: boolean
  /** Fill the area under the line with a fading gradient and add a soft glow. */
  area?: boolean
}

const HEIGHT = 250
const MARGIN = { top: 28, right: 18, bottom: 32, left: 48 }

function Marker(props: { x: number; y: number; point: ChartPoint; color: string; highlight: boolean }) {
  const { x, y, point, color, highlight } = props
  return (
    <g>
      {point.partial && <circle cx={x} cy={y} r={(highlight ? 6 : 4.5) + 4} fill="none" stroke={color} strokeDasharray="2 2" />}
      <MarkerShape {...props} />
    </g>
  )
}

function MarkerShape({ x, y, point, color, highlight }: { x: number; y: number; point: ChartPoint; color: string; highlight: boolean }) {
  const shape = point.origin ? ORIGIN_MARKER[point.origin] : 'circle'
  const r = highlight ? 6 : 4.5
  const fill = color
  const common = { stroke: color, strokeWidth: highlight ? 2.5 : 1.5 }
  switch (shape) {
    case 'diamond':
      return <path d={`M${x},${y - r - 1} L${x + r + 1},${y} L${x},${y + r + 1} L${x - r - 1},${y} Z`} fill={fill} {...common} />
    case 'ring':
      return <circle cx={x} cy={y} r={r} fill="#0b1220" {...common} />
    case 'half':
      return (
        <g>
          <circle cx={x} cy={y} r={r} fill="#0b1220" {...common} />
          <path d={`M${x},${y - r} A${r},${r} 0 0 1 ${x},${y + r} Z`} fill={color} />
        </g>
      )
    default:
      return <circle cx={x} cy={y} r={r} fill={fill} {...common} />
  }
}

/**
 * Minimal accessible SVG line chart. Gaps for null values, origin-shaped markers, a selected column,
 * click / Enter to select a column and a data table as text alternative.
 */
export function LineChart({
  series,
  xValues,
  xLabel,
  xTickEvery = 1,
  selectedX,
  onSelect,
  ariaLabel,
  yTitle = 'snpp_eq',
}: {
  series: ChartSeries[]
  xValues: number[]
  xLabel: (x: number) => string
  xTickEvery?: number
  selectedX?: number | null
  onSelect?: (x: number) => void
  ariaLabel: string
  yTitle?: string
}) {
  const chartId = useId().replace(/:/g, '')
  // Draw at the real container width so text and markers are never scaled up or squashed.
  const figureRef = useRef<HTMLElement | null>(null)
  const [WIDTH, setWidth] = useState(720)
  useEffect(() => {
    const element = figureRef.current
    if (!element) {
      return
    }
    const update = () => setWidth(Math.max(320, Math.round(element.getBoundingClientRect().width)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const values = series.flatMap((item) => item.points.map((point) => point.y).filter((y): y is number => y !== null))
  const ticks = axisTicks(values.length ? Math.max(...values) : 1)
  const yMax = ticks[ticks.length - 1] || 1
  const step = xValues.length > 1 ? plotWidth / (xValues.length - 1) : plotWidth
  const xPos = (x: number) => MARGIN.left + xValues.indexOf(x) * step
  const yPos = (y: number) => MARGIN.top + plotHeight - (y / yMax) * plotHeight

  function path(points: ChartPoint[]): string {
    let d = ''
    let open = false
    for (const point of points) {
      if (point.y === null) {
        open = false
        continue
      }
      d += `${open ? 'L' : 'M'}${xPos(point.x).toFixed(1)},${yPos(point.y).toFixed(1)} `
      open = true
    }
    return d
  }

  /** Closed polygons under each contiguous run of non-null points. */
  function areaPath(points: ChartPoint[]): string {
    const runs: ChartPoint[][] = [[]]
    for (const point of points) {
      if (point.y === null) {
        runs.push([])
      } else {
        runs[runs.length - 1].push(point)
      }
    }
    const base = yPos(0)
    return runs.filter((run) => run.length > 1).map((run) => {
      const line = run.map((point, index) => `${index ? 'L' : 'M'}${xPos(point.x).toFixed(1)},${yPos(point.y as number).toFixed(1)}`).join(' ')
      return `${line} L${xPos(run[run.length - 1].x).toFixed(1)},${base} L${xPos(run[0].x).toFixed(1)},${base} Z`
    }).join(' ')
  }

  return (
    <figure className="chart" ref={figureRef}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} role="img" aria-label={ariaLabel}>
        <defs>
          <filter id={`${chartId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {series.filter((item) => item.area).map((item) => (
            <linearGradient key={item.id} id={`${chartId}-${item.id}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity="0.45" />
              <stop offset="100%" stopColor={item.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yPos(tick)} y2={yPos(tick)} className="grid-line" />
            <text x={MARGIN.left - 8} y={yPos(tick) + 4} textAnchor="end" className="axis-text">{compactValue(tick)}</text>
          </g>
        ))}
        <text x={MARGIN.left} y={12} className="axis-text axis-title">{yTitle}</text>
        {selectedX !== undefined && selectedX !== null && xValues.includes(selectedX) && (
          <rect
            x={xPos(selectedX) - Math.max(step / 2, 6)}
            y={MARGIN.top}
            width={Math.max(step, 12)}
            height={plotHeight}
            className="selected-band"
          />
        )}
        {xValues.map((x, index) => (index % xTickEvery === 0 || x === selectedX) && (
          <text key={x} x={xPos(x)} y={HEIGHT - 12} textAnchor="middle" className={x === selectedX ? 'axis-text strong' : 'axis-text'}>
            {xLabel(x)}
          </text>
        ))}
        {series.filter((item) => item.area).map((item) => (
          <path key={`${item.id}-area`} d={areaPath(item.points)} fill={`url(#${chartId}-${item.id}-fill)`} stroke="none" />
        ))}
        {series.map((item) => (
          <path
            key={item.id}
            d={path(item.points)}
            fill="none"
            stroke={item.color}
            strokeWidth={item.area ? 2.5 : 2}
            strokeDasharray={item.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={item.area ? `url(#${chartId}-glow)` : undefined}
          />
        ))}
        {series.filter((item) => item.markers).map((item) => item.points.map((point) => point.y !== null && (
          <g key={`${item.id}-${point.x}`}>
            <Marker x={xPos(point.x)} y={yPos(point.y)} point={point} color={item.color} highlight={point.x === selectedX} />
            <title>{point.title}</title>
          </g>
        )))}
        {onSelect && xValues.map((x) => (
          <rect
            key={`hit-${x}`}
            x={xPos(x) - Math.max(step / 2, 6)}
            y={MARGIN.top}
            width={Math.max(step, 12)}
            height={plotHeight}
            className="hit-area"
            tabIndex={0}
            role="button"
            aria-label={`Chọn ${xLabel(x)}`}
            onClick={() => onSelect(x)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(x)
              }
            }}
          >
            <title>{series.map((item) => item.points.find((point) => point.x === x)?.title).filter(Boolean).join('\n')}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="chart-legend">
        {series.map((item) => (
          <span key={item.id} className="legend-item">
            <svg width="26" height="10" aria-hidden="true">
              <line x1="1" x2="25" y1="5" y2="5" stroke={item.color} strokeWidth="2" strokeDasharray={item.dash} />
            </svg>
            {item.label}
          </span>
        ))}
      </figcaption>
      <details className="chart-table">
        <summary>Xem bảng số liệu</summary>
        <table>
          <thead>
            <tr><th>Kỳ</th>{series.map((item) => <th key={item.id}>{item.label}</th>)}</tr>
          </thead>
          <tbody>
            {xValues.map((x) => (
              <tr key={x}>
                <th scope="row">{xLabel(x)}</th>
                {series.map((item) => <td key={item.id}>{item.points.find((point) => point.x === x)?.title ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Shape legend for origin markers, shared by the charts. */
export function OriginShapeLegend() {
  return (
    <p className="chart-legend muted small">
      Hình điểm: ● quan sát S‑NPP trực tiếp · ◆ quan sát NOAA‑20 quy đổi · ○ ước lượng phân bổ từ mô hình ·
      ◐ tổng hợp nhiều loại · vòng nét đứt quanh điểm = kỳ chưa đầy đủ · khoảng trống = ngoài phạm vi dữ liệu.
    </p>
  )
}
