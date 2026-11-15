import { useI18n } from '../i18n'

export type Point = { key: number; label: string; value: number | null; note?: string; partial?: boolean }

const width = 640
const height = 184
const left = 60
const right = 18
const top = 16
const bottom = 34

export function SeriesChart({ title, points, active, onSelect, comparison }: {
  title: string
  points: Point[]
  active?: number
  onSelect?: (key: number) => void
  comparison?: Point[]
}) {
  const { t, detectionCount } = useI18n()
  const maximum = Math.max(0, ...[...points, ...(comparison ?? [])].map((point) => point.value ?? 0))
  const scale = Math.max(1, Math.ceil(maximum))
  const ticks = scale > 1 ? [0, Math.floor(scale / 2), scale] : [0, 1]
  const x = (index: number) => left + (width - left - right) * index / Math.max(1, points.length - 1)
  const y = (value: number) => height - bottom - (height - top - bottom) * value / scale
  const linePath = (series: Point[]) => series.map((point, index) => point.value == null ? '' :
    (index && series[index - 1].value != null ? 'L' : 'M') + x(index) + ',' + y(point.value)).join(' ')
  const path = linePath(points)
  const area = !comparison && points.length > 1 && points.every((point) => point.value != null)
    ? `${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : null
  return (
    <figure className="series">
      <figcaption className="sr-only">{title} · {t('metric')}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={left - 8} y={y(tick) + 4} textAnchor="end">{detectionCount(tick)}</text>
          </g>
        ))}
        {area && <path d={area} className="chart-area" />}
        <path d={path} className="chart-line" />
        {comparison && <path d={linePath(comparison)} className="chart-line chart-comparison-line" />}
        {points.map((point, index) => (
          <g key={point.key} className={onSelect && point.value != null ? 'chart-target' : undefined}
            onClick={onSelect && point.value != null ? () => onSelect(point.key) : undefined}>
            {(points.length <= 12 || index % 5 === 0 || index === points.length - 1) &&
              <text x={x(index)} y={height - 11} textAnchor="middle">{point.label}</text>}
            {point.value != null && <>
              <circle cx={x(index)} cy={y(point.value)} r={point.key === active ? 7 : 4}
                className={`chart-point${point.partial ? ' partial-point' : ''}${point.key === active ? ' active-point' : ''}`} />
              <circle cx={x(index)} cy={y(point.value)} r="12" fill="transparent">
                <title>{`${point.label} · ${detectionCount(point.value)}${point.note ? ' · ' + point.note : ''}`}</title>
              </circle>
            </>}
          </g>
        ))}
        {comparison?.map((point, index) => point.value != null && (
          <rect key={point.key} x={x(index) - 3.5} y={y(point.value) - 3.5} width="7" height="7" className="chart-comparison-point">
            <title>{`${point.note ?? point.label} · ${detectionCount(point.value)}`}</title>
          </rect>
        ))}
      </svg>
      {onSelect ? (
        <div className="month-shortcuts" aria-label={t('selectMonth')}>
          {points.map((point) => (
            <button key={point.key} type="button" aria-pressed={active === point.key} disabled={point.value == null}
              title={point.note} onClick={() => onSelect(point.key)}>
              <span>{point.label}</span><strong>{point.value == null ? point.note : detectionCount(point.value)}{point.partial ? ' *' : ''}</strong>
            </button>
          ))}
        </div>
      ) : !comparison && (
        <details className="series-table">
          <summary>{t('viewTable')}</summary>
          <table><thead><tr><th scope="col">{t('period')}</th><th scope="col">{t('metric')}</th><th scope="col">{t('notes')}</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.key}><th scope="row">{point.label}</th><td>{point.value == null ? '—' : detectionCount(point.value)}</td><td>{point.note ?? '—'}</td></tr>)}</tbody>
          </table>
        </details>
      )}
    </figure>
  )
}
