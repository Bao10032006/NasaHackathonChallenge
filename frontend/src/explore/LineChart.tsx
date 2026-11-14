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
}

const WIDTH = 720
const HEIGHT = 260
const MARGIN = { top: 16, right: 16, bottom: 34, left: 52 }

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
      return <circle cx={x} cy={y} r={r} fill="#fff" {...common} />
    case 'half':
      return (
        <g>
          <circle cx={x} cy={y} r={r} fill="#fff" {...common} />
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

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yPos(tick)} y2={yPos(tick)} className="grid-line" />
            <text x={MARGIN.left - 8} y={yPos(tick) + 4} textAnchor="end" className="axis-text">{compactValue(tick)}</text>
          </g>
        ))}
        <text x={12} y={MARGIN.top + 4} className="axis-text">{yTitle}</text>
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
        {series.map((item) => (
          <path key={item.id} d={path(item.points)} fill="none" stroke={item.color} strokeWidth={2} strokeDasharray={item.dash} />
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
