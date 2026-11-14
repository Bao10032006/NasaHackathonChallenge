import { useState } from 'react'
import { ActivityCalendars } from './ActivityCalendars'
import { DataNotes, GridCellDetails } from './DataPanels'
import { ExploreFilters } from './ExploreFilters'
import type { CompareSelection } from '../compare/CompareScreen'
import type { Filters } from './ExploreFilters'
import { FireGridMap, nationalCamera } from './FireGridMap'
import type { Camera } from './FireGridMap'
import { HistoricalAnalysis } from './HistoricalAnalysis'
import { PeriodSummary } from './PeriodSummary'
import { dateLabel, ResourceNotice } from './display'
import { endpoint } from './api'
import type { Area, Bounds, Calendar, Daily, Days, Details, Grid, Metadata, Seasonality, TimeQuery, Trends } from './api'
import { useResource } from './useResource'
import './explore.css'

function initialFilters(metadata: Metadata): Filters {
  return {
    spatial: { areaType: 'national', areaId: 'ToanQuoc' },
    year: metadata.yearRange.end,
    month: Number(metadata.dateRange.end.slice(5, 7)),
    date: metadata.dateRange.end,
    pentad: 1,
    mode: 'year',
  }
}

type OpenCompare = (selection: CompareSelection) => void

function ExploreWorkspace({ metadata, areas, onCompare }: { metadata: Metadata; areas: Area[]; onCompare: OpenCompare }) {
  const [filters, setFilters] = useState(() => initialFilters(metadata))
  const [drawing, setDrawing] = useState(false)
  const [cell, setCell] = useState<string | null>(null)
  const [camera, setCamera] = useState<Camera>()
  const [history, setHistory] = useState<{ spatial: Filters['spatial']; camera: Camera }[]>([])
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
  const peak = mode === 'year' && yearPeak ? { label: 'Tháng ' + yearPeak.period, value: yearPeak.value }
    : mode === 'month' && monthPeak ? { label: dateLabel(monthPeak.date), value: monthPeak.value } : undefined
  const baseSummary = mode === 'year' ? calendar.data?.summary : mode === 'month' ? days.data?.summary : grid.data?.summary
  const summary = mode === 'day' && daily.data && baseSummary
    ? { ...baseSummary, totalValue: daily.data.value, valueStatus: daily.data.valueStatus }
    : baseSummary
  const period = mode === 'day' ? dateLabel(date) : mode === 'month' ? `Tháng ${month}/${year}` : mode === 'pentad' ? `Kỳ ${pentad}/${year}` : String(year)
  const noCells = grid.error === 'NO_CELLS_IN_BOUNDS'
  const showRegion = regional && !noCells && Boolean(grid.data || calendar.data)
  const mapKey = 'west' in spatial ? JSON.stringify(spatial) : spatial.areaId
  const focus = regional ? grid.data?.selection.selectedBounds : undefined
  const warnings = new Set([...(grid.data?.meta.warnings ?? []), ...(daily.data?.meta.warnings ?? [])])

  return (
    <>
      <ExploreFilters filters={filters} regional={regional} metadata={metadata} areas={areas} selection={grid.data?.selection} drawing={drawing}
        onChange={change} onDay={chooseDay} onDraw={() => setDrawing(!drawing)} onReset={reset} />
      {mode === 'month' && metadata.yearRange.start < metadata.yearRange.end && (
        <div className="compare-launch">
          <button type="button" className="outline" disabled={!grid.data} onClick={() => {
            const label = 'areaId' in spatial
              ? areas.find((area) => area.id === spatial.areaId)?.name ?? 'Ô ' + spatial.areaId
              : 'Khung đã khoanh'
            onCompare({ spatial, label, year, month, yearRange: metadata.yearRange, camera: camera ?? nationalCamera })
          }}>Đối chiếu hai năm</button>
        </div>
      )}

      <div className={regional && !noCells ? 'overview' : 'overview overview-map-only'}>
        <div className="map-column">
          <FireGridMap key={mapKey} grid={grid.data} focus={regional ? focus : undefined}
            camera={camera} onCamera={setCamera} onBack={history.length ? back : undefined}
            period={mode === 'year' ? `Năm ${year}` : period}
            requested={'west' in spatial ? spatial : undefined} drawing={drawing}
            activeCell={cell} onDraw={draw} onCell={(id) => {
              if (!regional) change({ spatial: { areaType: 'cell', areaId: id } })
              setCell(id)
            }} />
          <ResourceNotice resource={grid} />
          {metadata.warningCatalog.filter(({ code }) => warnings.has(code)).map(({ code, message }) => (
            <p className="notice" key={code}>{message}</p>
          ))}
        </div>
        {showRegion && <div className="overview-side">
          <PeriodSummary period={period} summary={summary} peak={peak}
            origin={mode === 'day' ? daily.data?.origin : grid.data?.summary.origin} contributions={daily.data?.sourceComposition}
            sourceNotice={mode === 'day' ? <ResourceNotice resource={daily} /> : undefined} />
          {cell && <GridCellDetails cellId={cell} resource={details}
            mapCell={selectedCell} period={grid.data?.temporalSelector} daily={cellDaily} onClose={() => setCell(null)} />}
          <ActivityCalendars year={year} month={hasMonth ? month : undefined} date={mode === 'day' ? date : undefined}
            calendar={calendar} days={days} onMonth={(selected) => change({ month: selected, mode: 'month' })} onDay={chooseDay} />
        </div>}
      </div>

      {showRegion && <HistoricalAnalysis month={month} calendar={calendar} trends={trends} seasonality={seasonality} />}
    </>
  )
}

export default function ExploreScreen({ onCompare }: { onCompare: OpenCompare }) {
  const metadata = useResource<Metadata>(endpoint('/metadata'))
  const areas = useResource<{ items: Area[] }>(endpoint('/areas'))

  return (
    <>
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">♨</span>
          <div><strong>Hỏa Lịch</strong><small>NASA FIRMS · Chuẩn S-NPP</small></div>
        </div>
        <div className="header-actions">
          {metadata.data && <span className="data-through">Dữ liệu đến <strong>{dateLabel(metadata.data.meta.dataThrough)}</strong></span>}
          <a href="#data-notes" onClick={() => {
            const notes = document.getElementById('data-notes')
            if (notes instanceof HTMLDetailsElement) notes.open = true
          }}>Nguồn và cách đọc dữ liệu</a>
        </div>
      </header>
      <main>
        <header className="intro">
          <h1>Khám phá hoạt động đốt</h1>
          <p>Số phát hiện ban ngày tương đương S-NPP</p>
        </header>
        <ResourceNotice resource={metadata} />
        <ResourceNotice resource={areas} />
        {metadata.data && areas.data && <ExploreWorkspace metadata={metadata.data} areas={areas.data.items} onCompare={onCompare} />}
        <DataNotes metadata={metadata.data} />
      </main>
    </>
  )
}
