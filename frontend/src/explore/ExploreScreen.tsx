import { useState } from 'react'
import { ActivityCalendars } from './ActivityCalendars'
import { DataNotes, GridCellDetails } from './DataPanels'
import { ExploreFilters } from './ExploreFilters'
import type { CompareSelection } from '../compare/CompareScreen'
import type { Filters } from './ExploreFilters'
import { FireGridMap, nationalCamera } from './FireGridMap'
import type { Camera, MarkerThresholds } from './FireGridMap'
import { HistoricalAnalysis } from './HistoricalAnalysis'
import { PeriodSummary } from './PeriodSummary'
import { ResourceNotice } from './display'
import { LanguageSwitch, useI18n } from '../i18n'
import { BrandMark } from '../BrandMark'
import { DatasetWarning } from './DatasetNotes'
import { endpoint } from './api'
import type { Area, Bounds, Calendar, Daily, Days, Details, Grid, Metadata, Seasonality, TimeQuery, Trends } from './api'
import { useResource } from './useResource'
import './explore.css'

const markerThresholds: Record<Filters['mode'], MarkerThresholds> = {
  year: { national: 125, regional: 40, close: 5 },
  month: { national: 15, regional: 4, close: 1 },
  pentad: { national: 4, regional: 1, close: 0.5 },
  day: { national: 2, regional: 0.5, close: 0.25 },
}

const nationalArea = { type: 'national', id: 'ToanQuoc' } satisfies Area

function initialFilters(metadata: Metadata): Filters {
  return {
    spatial: { areaType: nationalArea.type, areaId: nationalArea.id },
    year: metadata.yearRange.end,
    month: Number(metadata.dateRange.end.slice(5, 7)),
    date: metadata.dateRange.end,
    pentad: 1,
    mode: 'year',
  }
}

type OpenCompare = (selection: CompareSelection) => void

function ExploreWorkspace({ metadata, areas, onCompare }: { metadata: Metadata; areas: Area[]; onCompare: OpenCompare }) {
  const { t, dateLabel, monthLabel } = useI18n()
  const [filters, setFilters] = useState(() => initialFilters(metadata))
  const [drawing, setDrawing] = useState(false)
  const [cell, setCell] = useState<string | null>(null)
  const [camera, setCamera] = useState<Camera>()
  const [history, setHistory] = useState<{ spatial: Filters['spatial']; camera: Camera }[]>([])
  const [showAllMarkers, setShowAllMarkers] = useState(false)
  const { spatial, year, month, mode, date, pentad } = filters
  const regional = 'west' in spatial || spatial.areaType !== 'national'
  const hasMonth = regional && (mode === 'month' || mode === 'day')
  const time: TimeQuery = mode === 'day' ? { date } : {
    year, ...(mode === 'month' ? { month } : {}), ...(mode === 'pentad' ? { pentad } : {}),
  }
  const grid = useResource<Grid>(endpoint('/map/cells', { ...spatial, ...time }))
  const calendar = useResource<Calendar>(regional ? endpoint('/calendar', { ...spatial, year, granularity: 'month', includeBaseline: true }) : null)
  const days = useResource<Days>(hasMonth ? endpoint('/calendar/days', { ...spatial, year, month }) : null)
  const daily = useResource<Daily>(regional && mode === 'day' ? endpoint('/daily', { ...spatial, date }) : null)
  const trends = useResource<Trends>(regional ? endpoint('/trends', {
    ...spatial, startYear: metadata.yearRange.start, endYear: metadata.yearRange.end, granularity: 'month', period: month,
  }) : null)
  const seasonality = useResource<Seasonality>(regional ? endpoint('/seasonality', { ...spatial, granularity: 'month' }) : null)
  const details = useResource<Details>(cell ? endpoint('/cells/' + encodeURIComponent(cell) + '/period-details', time) : null)
  const cellDaily = useResource<Daily>(cell && mode === 'day' && details.error === 'ENDPOINT_UNAVAILABLE'
    ? endpoint('/daily', { areaType: 'cell', areaId: cell, date }) : null)
  const selectedCell = grid.data?.cells.find((item) => item.cellId === cell)

  function change(patch: Partial<Filters>) {
    const changingRegion = patch.spatial && JSON.stringify(patch.spatial) !== JSON.stringify(spatial)
    if (changingRegion) {
      setHistory((previous) => [...previous, { spatial, camera: camera ?? nationalCamera }])
      setCamera(undefined)
    }
    setFilters((current) => ({ ...current, ...(changingRegion ? { mode: 'year' as const } : {}), ...patch }))
    setCell(null)
    setDrawing(false)
  }

  function back() {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((entries) => entries.slice(0, -1))
    setFilters((current) => ({ ...current, spatial: previous.spatial }))
    setCamera(previous.camera)
    setCell(null)
    setDrawing(false)
  }

  function reset() {
    setFilters(initialFilters(metadata))
    setHistory([])
    setCamera(nationalCamera)
    setCell(null)
    setDrawing(false)
    setShowAllMarkers(false)
  }

  function chooseDay(day: string) {
    if (!hasMonth || day < metadata.dateRange.start || day > metadata.dateRange.end) return
    change({ mode: 'day', date: day, year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) })
  }

  function draw(bounds: Bounds) {
    change({ spatial: bounds })
  }

  const yearPeak = calendar.data?.summary.peakPeriod
  const monthPeak = days.data?.summary.peakDate
  const peak = mode === 'year' && yearPeak ? { label: monthLabel(yearPeak.period), value: yearPeak.value }
    : mode === 'month' && monthPeak ? { label: dateLabel(monthPeak.date), value: monthPeak.value } : undefined
  const baseSummary = mode === 'year' ? calendar.data?.summary : mode === 'month' ? days.data?.summary : grid.data?.summary
  const summary = mode === 'day' && daily.data && baseSummary
    ? { ...baseSummary, totalValue: daily.data.value, valueStatus: daily.data.valueStatus }
    : baseSummary
  const period = mode === 'day' ? dateLabel(date) : mode === 'month' ? monthLabel(month, year) : mode === 'pentad' ? `${t('pentadNumber', { period: pentad })} · ${year}` : String(year)
  const noCells = grid.error === 'NO_CELLS_IN_BOUNDS'
  const showRegion = regional && !noCells && Boolean(grid.data || calendar.data)
  const splitOverview = (regional && !noCells) || cell !== null
  const mapKey = 'west' in spatial ? JSON.stringify(spatial) : spatial.areaId
  const focus = regional ? grid.data?.selection.selectedBounds : undefined
  const warnings = new Set([...(grid.data?.meta.warnings ?? []), ...(daily.data?.meta.warnings ?? [])])
  const cellDetails = cell && <GridCellDetails cellId={cell} resource={details}
    mapCell={selectedCell} period={grid.data?.temporalSelector} daily={cellDaily} onClose={() => setCell(null)} />

  return (
    <>
      <ExploreFilters filters={filters} regional={regional} metadata={metadata} areas={areas} selection={grid.data?.selection} drawing={drawing}
        onChange={change} onDay={chooseDay} onDraw={() => setDrawing(!drawing)} onReset={reset} />
      {mode === 'month' && metadata.yearRange.start < metadata.yearRange.end && (
        <div className="compare-launch">
          <button type="button" className="outline" disabled={!grid.data} onClick={() => {
            const area = 'areaId' in spatial ? areas.find((item) => item.id === spatial.areaId) : undefined
            onCompare({ spatial, area, year, month, yearRange: metadata.yearRange, camera: camera ?? nationalCamera })
          }}>{t('compareYears')}</button>
        </div>
      )}

      <div className={splitOverview ? 'overview' : 'overview overview-map-only'}>
        <div className="map-column">
          <FireGridMap key={mapKey} grid={grid.data} focus={regional ? focus : undefined}
            camera={camera} onCamera={setCamera} onBack={history.length ? back : undefined}
            period={mode === 'year' ? `${t('year')} ${year}` : period}
            markerFilter={{ thresholds: markerThresholds[mode], showAll: showAllMarkers, onToggle: () => setShowAllMarkers((showAll) => !showAll) }}
            requested={'west' in spatial ? spatial : undefined} drawing={drawing}
            activeCell={cell} onDraw={draw} onCell={setCell} />
          <ResourceNotice resource={grid} />
          {metadata.warningCatalog.filter(({ code }) => warnings.has(code)).map(({ code, message }) => (
            <DatasetWarning key={code} code={code} message={message} />
          ))}
        </div>
        {(showRegion || cellDetails) && <div className="overview-side">
          {showRegion && <PeriodSummary period={period} summary={summary} peak={peak}
            origin={mode === 'day' ? daily.data?.origin : grid.data?.summary.origin} contributions={daily.data?.sourceComposition}
            sourceNotice={mode === 'day' ? <ResourceNotice resource={daily} /> : undefined} />}
          {cellDetails}
          {showRegion && <ActivityCalendars year={year} month={hasMonth ? month : undefined} date={mode === 'day' ? date : undefined}
            calendar={calendar} days={days} onMonth={(selected) => change({ month: selected, mode: 'month' })} onDay={chooseDay} />}
        </div>}
      </div>

      {showRegion && <HistoricalAnalysis month={month} calendar={calendar} trends={trends} seasonality={seasonality} />}
    </>
  )
}

export default function ExploreScreen({ onCompare }: { onCompare: OpenCompare }) {
  const { t, dateLabel } = useI18n()
  const metadata = useResource<Metadata>(endpoint('/metadata'))
  const regions = useResource<{ items: Area[] }>(endpoint('/areas', { type: 'socioeconomic_region' }))

  return (
    <>
      <header className="masthead">
        <div className="brand">
          <BrandMark />
          <div><strong>Hỏa Lịch</strong><small>{t('satelliteData')} · NASA FIRMS</small></div>
        </div>
        <div className="header-actions">
          {metadata.data && <span className="data-through">{t('dataThrough')} <strong>{dateLabel(metadata.data.meta.dataThrough)}</strong></span>}
          <a href="#data-notes" onClick={() => {
            const notes = document.getElementById('data-notes')
            if (notes instanceof HTMLDetailsElement) notes.open = true
          }}>{t('dataNotes')}</a>
          <LanguageSwitch />
        </div>
      </header>
      <main>
        <header className="intro">
          <h1>{t('exploreTitle')}</h1>
          <p>{t('daytimeMetric')}</p>
        </header>
        <ResourceNotice resource={metadata} />
        <ResourceNotice resource={regions} />
        {metadata.data && <ExploreWorkspace metadata={metadata.data} areas={[nationalArea, ...(regions.data?.items ?? [])]} onCompare={onCompare} />}
        <DataNotes metadata={metadata.data} />
      </main>
    </>
  )
}
