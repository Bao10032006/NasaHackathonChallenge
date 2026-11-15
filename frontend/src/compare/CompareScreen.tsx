import { useEffect, useRef, useState } from 'react'
import { endpoint } from '../explore/api'
import type { Area, Grid, MapCell, Metadata, SpatialQuery } from '../explore/api'
import { LanguageSwitch, useI18n } from '../i18n'
import { FireGridMap, MapColorScale } from '../explore/FireGridMap'
import type { Camera } from '../explore/FireGridMap'
import { cellActivityStatus, CoverageNotice, ResourceNotice } from '../explore/display'
import { useResource } from '../explore/useResource'
import type { Resource } from '../explore/useResource'
import { CompareDailyActivity } from './CompareDailyActivity'
import './compare.css'

export type CompareSelection = {
  spatial: SpatialQuery
  area?: Area
  month: number
  year: number
  yearRange: Metadata['yearRange']
  camera: Camera
}

function incompatibility(a: Grid, b: Grid) {
  const { meta: left, selection: selectionA, summary: summaryA } = a
  const { meta: right, selection: selectionB, summary: summaryB } = b
  if (left.dataVersion !== right.dataVersion || left.modelVersion !== right.modelVersion ||
      left.metric !== right.metric || left.unit !== right.unit) {
    return 'compareVersionMismatch' as const
  }
  if (selectionA.cellIds.length !== selectionB.cellIds.length ||
      selectionA.cellIds.some((id, index) => id !== selectionB.cellIds[index])) {
    return 'compareCellMismatch' as const
  }
  const coverA = summaryA.coverage
  const coverB = summaryB.coverage
  if (coverA.partial || coverB.partial || coverA.coveredDayCount !== coverB.coveredDayCount ||
      coverA.coveredDayCount !== coverA.expectedDayCount || coverB.coveredDayCount !== coverB.expectedDayCount ||
      coverA.coveredDayCount === 0) {
    return 'compareCoverageMismatch' as const
  }
  return null
}

function cellValue(cell?: MapCell) {
  return cell?.valueStatus === 'AVAILABLE' ? cell.value : null
}

function YearSummary({ side, year, resource }: { side: 'A' | 'B'; year: number; resource: Resource<Grid> }) {
  const { t, valueLabel } = useI18n()
  const summary = resource.data?.summary
  return (
    <div className="metric compare-year-summary">
      <span>{t('areaTotal')} · {side} · {year}</span>
      <ResourceNotice resource={resource} />
      {summary && <>
        <strong className="summary-number">{valueLabel(summary.totalValue, summary.valueStatus)}</strong>
        <CoverageNotice coverage={summary.coverage} />
      </>}
    </div>
  )
}

export function CompareScreen({ selection, onBack }: { selection: CompareSelection; onBack: () => void }) {
  const { t, monthLabel, areaLabel, boundsLabel, number, detectionLabel, detectionDifference } = useI18n()
  const { spatial, area, month, year, yearRange } = selection
  const [yearA, setYearA] = useState(year > yearRange.start ? year - 1 : year + 1)
  const [yearB, setYearB] = useState(year)
  const [camera, setCamera] = useState(selection.camera)
  const [activeCell, setCell] = useState<string | null>(null)
  const [visible, setVisible] = useState<'a' | 'b'>('a')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const a = useResource<Grid>(endpoint('/map/cells', { ...spatial, year: yearA, month }))
  const b = useResource<Grid>(endpoint('/map/cells', { ...spatial, year: yearB, month }))
  const grids = [a.data, b.data].filter((grid) => grid !== undefined)
  const mins = grids.flatMap(({ summary }) => summary.minCellValue == null ? [] : [summary.minCellValue])
  const maxes = grids.flatMap(({ summary }) => summary.maxCellValue == null ? [] : [summary.maxCellValue])
  const domain = mins.length && maxes.length ? { min: Math.min(...mins), max: Math.max(...maxes) } : undefined
  const legendLabel = domain
    ? grids.length === 2 ? t('sharedColorScale') : `${t('colorScale')} · ${a.data ? 'A · ' + yearA : 'B · ' + yearB}`
    : t('mapColorScale')
  const incompatible = a.data && b.data ? incompatibility(a.data, b.data) : null
  const totalA = a.data?.summary.valueStatus === 'AVAILABLE' ? a.data.summary.totalValue : null
  const totalB = b.data?.summary.valueStatus === 'AVAILABLE' ? b.data.summary.totalValue : null
  const delta = !incompatible && totalA != null && totalB != null ? totalB - totalA : null
  const cellA = a.data?.cells.find((cell) => cell.cellId === activeCell)
  const cellB = b.data?.cells.find((cell) => cell.cellId === activeCell)
  const valueA = cellValue(cellA)
  const valueB = cellValue(cellB)
  const cellDelta = !incompatible && !cellA?.partial && !cellB?.partial && valueA != null && valueB != null ? valueB - valueA : null
  const years = Array.from({ length: yearRange.end - yearRange.start + 1 }, (_, index) => yearRange.end - index)
  const period = monthLabel(month)
  const maps = [
    { side: 'a', label: 'A', year: yearA, resource: a, cell: cellA },
    { side: 'b', label: 'B', year: yearB, resource: b, cell: cellB },
  ] as const

  return (
    <main className="compare-screen">
      <header className="compare-header">
        <div><h1 ref={heading} tabIndex={-1}>{t('compareTitle')}</h1><p className="muted">{areaLabel(area)} · {period}{'west' in spatial && ' · ' + boundsLabel(spatial)}</p></div>
        <div className="compare-header-actions">
          <LanguageSwitch />
          <button type="button" className="quiet" onClick={onBack}>{t('backToExplore')}</button>
        </div>
      </header>
      <section className="panel compare-overview" aria-label={t('compareOverview')}>
        <div className="filter-row">
          <label htmlFor="compare-year-a">{t('yearA')}</label>
          <select id="compare-year-a" value={yearA} onChange={(event) => setYearA(Number(event.target.value))}>
            {years.map((item) => <option key={item} disabled={item === yearB}>{item}</option>)}
          </select>
          <label htmlFor="compare-year-b">{t('yearB')}</label>
          <select id="compare-year-b" value={yearB} onChange={(event) => setYearB(Number(event.target.value))}>
            {years.map((item) => <option key={item} disabled={item === yearA}>{item}</option>)}
          </select>
          <span className="pill">{period}</span>
          {grids[0] && <span className="muted">{t('cellCount', { count: number(grids[0].selection.cellCount) })}</span>}
        </div>
        <div className="compare-totals">
          <YearSummary side="A" year={yearA} resource={a} />
          <YearSummary side="B" year={yearB} resource={b} />
          {delta != null && <div className="metric compare-delta"><span>{t('difference')}</span>
            <strong className="summary-number">{detectionDifference(delta)}</strong>
          </div>}
        </div>
        {incompatible && <p className="notice">{t(incompatible)}</p>}
        {a.data && b.data && !incompatible && delta == null && <p className="notice">{t('compareTotalsUnavailable')}</p>}
        {(a.error || b.error) && <p className="notice">{t('compareMapsUnavailable')}</p>}
      </section>

      <CompareDailyActivity spatial={spatial} month={month} yearA={yearA} yearB={yearB} />

      <div className="panel map-legend compare-legend">
        <div className="map-legend-row">
          <span>{legendLabel} · {t('metric')}</span>
          <MapColorScale domain={domain} />
        </div>
        <p>{t('compareLegend')}</p>
      </div>

      <div className="compare-switch" role="group" aria-label={t('activeMap')}>
        {maps.map((map) => <button type="button" key={map.side} aria-pressed={visible === map.side}
          onClick={() => setVisible(map.side)}>{map.label} · {map.year}</button>)}
      </div>

      <div className="compare-maps">
        {maps.map((map) => <div key={map.side} className="compare-map" data-active={visible === map.side}>
          <FireGridMap id={'compare-map-' + map.side} title={map.label + ' · ' + map.year} period={period}
            grid={map.resource.data} camera={camera} onCamera={setCamera} colorDomain={domain} sharedLegend drawing={false}
            requested={'west' in spatial ? spatial : undefined} activeCell={activeCell} onCell={setCell} />
        </div>)}
      </div>

      {activeCell && <section className="panel compare-cell" aria-labelledby="compare-cell-title">
        <div className="panel-heading">
          <h2 id="compare-cell-title">{t('cell', { id: activeCell })}</h2>
          <button type="button" className="quiet" onClick={() => setCell(null)}>{t('deselectCell')}</button>
        </div>
        <div className="compare-totals">
          {maps.map((map) => <div className="metric" key={map.side}>
            <h3>{map.label} · {map.year}</h3>
            {map.cell ? <>
              <strong>{detectionLabel(map.cell.value, map.cell.valueStatus)}</strong>
              <p className="muted">{t(cellActivityStatus(map.cell))}{map.cell.partial ? ' · ' + t('partialPeriod') : ''}</p>
              {map.cell.origin && <p className="origin">{t(map.cell.origin)}</p>}
            </> : <p className="muted">{t(map.resource.loading ? 'loading' : map.resource.data ? 'cellUnavailable' : 'mapUnavailable')}</p>}
          </div>)}
          {cellDelta != null && <div className="metric compare-delta"><span>{t('cellDifference')}</span>
            <strong className="summary-number">{detectionDifference(cellDelta)}</strong>
          </div>}
        </div>
      </section>}
    </main>
  )
}
