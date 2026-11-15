import { useState } from 'react'
import type { Calendar } from './api'
import { ResourceNotice } from './display'
import { heatRamp, MapColorScale } from './FireGridMap'
import { useI18n } from '../i18n'
import type { Resource } from './useResource'

const periods = 73
const width = 1180
const height = 214
const left = 56
const right = 10
const top = 24
const bottom = 30
const slot = (width - left - right) / periods
const gap = 1.3

/** Five-day periods follow the backend definition: period p starts 5 × (p − 1) days after 1 January; period 73 runs to 31 December. */
function periodRange(year: number, period: number) {
  const start = new Date(Date.UTC(year, 0, 1 + 5 * (period - 1)))
  const end = period === periods ? new Date(Date.UTC(year, 11, 31)) : new Date(Date.UTC(year, 0, 5 * period))
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

/**
 * The fire calendar the product is named after: one bar per five-day period of the selected year,
 * with the typical level of the same period (baseline median from /calendar) drawn as a mark across each bar.
 * Purely descriptive: it reports values and differences, and classifies nothing.
 */
export function FireCalendar({ year, active, calendar, onSelect }: {
  year: number
  active?: number
  calendar: Resource<Calendar>
  onSelect: (period: number) => void
}) {
  const { t, dateLabel, shortMonth, detectionCount, detectionDifference, valueLabel } = useI18n()
  const [focused, setFocused] = useState<number | null>(null)
  const data = calendar.data
  const baseline = new Map(data?.baseline?.values.map((item) => [item.period, item]) ?? [])
  const rows = (data?.values ?? []).map((item) => {
    const range = item.startDate && item.endDate ? { startDate: item.startDate, endDate: item.endDate } : periodRange(year, item.period)
    const reference = baseline.get(item.period)
    const value = item.valueStatus === 'AVAILABLE' ? item.value : null
    const typical = reference?.valueStatus === 'AVAILABLE' ? reference.value : null
    const partial = Boolean(item.partial || item.coverage.partial)
    return { ...item, ...range, value, typical, partial, comparable: value != null && typical != null && !partial }
  })
  const maximum = Math.max(0, ...rows.map((row) => row.value ?? 0), ...rows.map((row) => row.typical ?? 0))
  const scale = Math.max(1, Math.ceil(maximum))
  const ticks = scale > 1 ? [0, Math.floor(scale / 2), scale] : [0, 1]
  const plot = height - top - bottom
  const y = (value: number) => height - bottom - plot * value / scale
  const x = (period: number) => left + (period - 1) * slot
  const comparable = rows.filter((row) => row.comparable)
  const above = comparable.filter((row) => row.value! > row.typical!).length
  const peak = data?.summary.peakPeriod
  const peakRow = rows.find((row) => row.period === peak?.period)
  const shown = rows.find((row) => row.period === (focused ?? active ?? peak?.period))
  const rangeLabel = (row: { startDate: string; endDate: string }) => `${dateLabel(row.startDate)} – ${dateLabel(row.endDate)}`
  const describe = (row: typeof rows[number]) => [
    t('pentadNumber', { period: row.period }),
    rangeLabel(row),
    row.partial ? t('partialPeriod') : null,
    valueLabel(row.value, row.valueStatus),
    row.typical != null ? `${t('baseline')} ${detectionCount(row.typical)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <section className="panel fire-calendar" aria-labelledby="fire-calendar-title">
      <div className="panel-heading"><h2 id="fire-calendar-title">{t('fireCalendar')}</h2><span className="pill">{year}</span></div>
      <ResourceNotice resource={calendar} />
      {data && <>
        <p className="muted">{t('fireCalendarHint')}</p>
        <figure className="series calendar-figure">
          <figcaption className="sr-only">{t('fireCalendarChart')} · {t('metric')}</figcaption>
          <div className="calendar-scroll">
            <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t('fireCalendarChart')}>
              <defs>{heatRamp.map((color, index) => (
                <linearGradient key={color} id={'calendar-heat-' + index} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".5" />
                </linearGradient>
              ))}</defs>
              {ticks.map((tick) => (
                <g key={tick} aria-hidden="true">
                  <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
                  <text x={left - 8} y={y(tick) + 4} textAnchor="end">{detectionCount(tick)}</text>
                </g>
              ))}
              {rows.map((row, index) => {
                const month = Number(row.startDate.slice(5, 7))
                const firstOfMonth = index === 0 || Number(rows[index - 1].startDate.slice(5, 7)) !== month
                return firstOfMonth && (
                  <g key={'month-' + row.period} aria-hidden="true">
                    {index > 0 && <line x1={x(row.period)} x2={x(row.period)} y1={top - 8} y2={height - bottom + 5} className="calendar-month" />}
                    <text x={x(row.period) + 3} y={height - 9}>{shortMonth(month)}</text>
                  </g>
                )
              })}
              {rows.map((row) => {
                const ratio = row.value != null ? row.value / scale : 0
                const heat = Math.min(heatRamp.length - 1, Math.floor(Math.sqrt(ratio) * heatRamp.length))
                const barTop = row.value != null ? y(row.value) : y(0)
                const label = describe(row)
                return (
                  <g key={row.period} className="calendar-slot" role="button" tabIndex={0} aria-label={label} aria-pressed={active === row.period}
                    onClick={() => onSelect(row.period)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(row.period)
                      }
                    }}
                    onMouseEnter={() => setFocused(row.period)} onMouseLeave={() => setFocused(null)}
                    onFocus={() => setFocused(row.period)} onBlur={() => setFocused(null)}>
                    <title>{label}</title>
                    <rect x={x(row.period)} y={top - 8} width={slot} height={plot + 13} className={active === row.period ? 'calendar-hit selected' : 'calendar-hit'} />
                    {row.value == null && <rect x={x(row.period) + gap} y={top} width={slot - 2 * gap} height={plot} className="calendar-missing" />}
                    {row.value != null && row.value > 0 && <rect x={x(row.period) + gap} y={barTop} width={slot - 2 * gap}
                      height={Math.max(1.5, y(0) - barTop)} rx="2.5" fill={`url(#calendar-heat-${heat})`}
                      style={{ animationDelay: row.period * 9 + 'ms' }}
                      className={`calendar-bar${row.partial ? ' partial' : ''}${heat === heatRamp.length - 1 ? ' hot' : ''}`} />}
                    {row.typical != null && <>
                      <line x1={x(row.period) + .4} x2={x(row.period) + slot - .4} y1={y(row.typical)} y2={y(row.typical)} className="calendar-typical-rim" />
                      <line x1={x(row.period) + .4} x2={x(row.period) + slot - .4} y1={y(row.typical)} y2={y(row.typical)} className="calendar-typical" />
                    </>}
                  </g>
                )
              })}
            </svg>
          </div>
        </figure>
        <p className="calendar-readout">
            {shown && <>
              <strong>{t('pentadNumber', { period: shown.period })} · {rangeLabel(shown)}</strong>
              <span>{t('metric')} <b>{valueLabel(shown.value, shown.valueStatus)}</b>{shown.partial ? ' · ' + t('partialPeriod') : ''}</span>
              {shown.typical != null && <span>{t('baseline')} <b>{detectionCount(shown.typical)}</b></span>}
              {shown.comparable && <span>{t('samePeriodDifference')} <b>{detectionDifference(shown.value! - shown.typical!)}</b></span>}
            </>}
          </p>
        <div className="map-legend-row calendar-legend">
          <MapColorScale domain={maximum > 0 ? { min: 0, max: scale } : undefined} />
          {data.baseline && <span className="legend-symbol">
            <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" className="calendar-typical" /></svg>
            {t('typicalMark')} · {t('median')} {data.baseline.referenceStartYear}–{data.baseline.referenceEndYear}
          </span>}
        </div>
        <dl className="baseline">
          {peak && <div><dt>{t('peakPentad')}</dt>
            <dd>{t('pentadNumber', { period: peak.period })}{peakRow ? ' · ' + rangeLabel(peakRow) : ''} · {detectionCount(peak.value)}</dd></div>}
          {comparable.length > 0 && <div><dt>{t('aboveTypical')}</dt><dd>{t('periodsOf', { count: above, total: comparable.length })}</dd></div>}
        </dl>
        {data.baseline?.excludesTargetYear && <p className="muted">{t('baselineExclusion')}</p>}
        <details className="series-table">
            <summary>{t('viewTable')}</summary>
            <table>
              <thead><tr><th scope="col">{t('period')}</th><th scope="col">{t('timeRange')}</th><th scope="col">{t('metric')}</th><th scope="col">{t('baseline')}</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.period}>
                <th scope="row">{row.period}</th><td>{rangeLabel(row)}</td>
                <td>{valueLabel(row.value, row.valueStatus)}{row.partial ? ' *' : ''}</td>
                <td>{row.typical == null ? '—' : detectionCount(row.typical)}</td>
              </tr>)}</tbody>
            </table>
        </details>
      </>}
    </section>
  )
}

/**
 * Compact skyline of the same 73 periods for the top of the page. It is a pointer shortcut only (hidden from
 * assistive technology): the period select and the full calendar below offer the same choice with keyboard support.
 */
export function CalendarStrip({ year, label, active, calendar, onSelect }: {
  year: number
  label: string
  active?: number
  calendar: Resource<Calendar>
  onSelect: (period: number) => void
}) {
  const { t, shortMonth, detectionCount } = useI18n()
  const values = calendar.data?.values ?? []
  const maximum = Math.max(1, ...values.map((item) => item.valueStatus === 'AVAILABLE' ? item.value ?? 0 : 0))
  const months = Array.from({ length: periods }, (_, index) => Number(periodRange(year, index + 1).startDate.slice(5, 7)))
  return (
    <div className="hero-strip" aria-hidden="true">
      <div className="hero-strip-meta"><strong>{t('fireCalendar')}</strong><span>{label} · {year}</span></div>
      <div className="hero-strip-cells">
        {months.map((_, index) => {
          const item = values[index]
          const value = item?.valueStatus === 'AVAILABLE' ? item.value : null
          const ratio = value != null ? value / maximum : 0
          const heat = Math.min(heatRamp.length - 1, Math.floor(Math.sqrt(ratio) * heatRamp.length))
          const lit = value != null && value > 0
          return <i key={index} title={`${t('pentadNumber', { period: index + 1 })}${value != null ? ' · ' + detectionCount(value) : ''}`}
            className={`${active === index + 1 ? 'active ' : ''}${lit && heat === heatRamp.length - 1 ? 'hot' : ''}`}
            style={lit ? { height: Math.max(9, ratio * 100) + '%', background: heatRamp[heat] } : undefined}
            onClick={() => onSelect(index + 1)} />
        })}
      </div>
      <div className="hero-strip-months">
        {months.map((month, index) => (index === 0 || months[index - 1] !== month) &&
          <span key={month} style={{ gridColumnStart: index + 1 }}>{shortMonth(month)}</span>)}
      </div>
    </div>
  )
}
