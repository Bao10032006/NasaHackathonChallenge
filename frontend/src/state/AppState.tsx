import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react'
import type { DataSource, SpatialQuery, TemporalQuery } from '../api/client'
import type { AreaType, CalendarGranularity, TrendGranularity } from '../api/types'
import { monthOf, monthOfPentad, moveDateToYear, yearOf } from '../lib/time'

/*
 * One filter state for every Explore panel (FR08): calendar, map, summary, trends and cell details
 * always read the same spatial selection and period. Compare keeps its own month and two years but
 * reuses the same spatial selection.
 */

export type Screen = 'explore' | 'compare' | 'notes'
export type TimeMode = 'year' | 'month' | 'pentad' | 'date'

export type SpatialFilter =
  | { mode: 'named'; areaType: AreaType; areaId: string }
  | { mode: 'bbox'; west: number; south: number; east: number; north: number }

export interface Filters {
  spatial: SpatialFilter
  year: number
  timeMode: TimeMode
  month: number
  pentad: number
  /** Exact date; its year always equals `year`. */
  date: string
  selectedCellId: string | null
}

export interface CompareFilters {
  month: number
  yearA: number
  yearB: number
}

export interface AppState {
  dataSource: DataSource
  screen: Screen
  filters: Filters
  compare: CompareFilters
}

/** Document 08 golden bounding box (13 Tay Nguyen cells); fully covered by mock fixtures. */
export const GOLDEN_BBOX = { west: 107, south: 12, east: 108, north: 13 } as const

/** The Explore flow starts at the national scope, yearly view of the last complete year. */
const DEFAULT_FILTERS: Filters = {
  spatial: { mode: 'named', areaType: 'national', areaId: 'ToanQuoc' },
  year: 2024,
  timeMode: 'year',
  month: 3,
  pentad: 15,
  date: '2024-03-18',
  selectedCellId: null,
}

const DEFAULT_COMPARE: CompareFilters = { month: 3, yearA: 2005, yearB: 2024 }

function initialDataSource(): DataSource {
  return import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'
}

export type Action =
  | { type: 'setDataSource'; dataSource: DataSource }
  | { type: 'setScreen'; screen: Screen }
  | { type: 'setSpatial'; spatial: SpatialFilter }
  | { type: 'setYear'; year: number }
  | { type: 'setTimeMode'; timeMode: TimeMode }
  | { type: 'setMonth'; month: number }
  | { type: 'setPentad'; pentad: number }
  | { type: 'setDate'; date: string }
  | { type: 'selectCell'; cellId: string | null }
  | { type: 'resetFilters' }
  | { type: 'setCompare'; compare: Partial<CompareFilters> }
  | { type: 'hydrate'; state: AppState }

function reducer(state: AppState, action: Action): AppState {
  const filters = state.filters
  switch (action.type) {
    case 'setDataSource':
      return { ...state, dataSource: action.dataSource }
    case 'setScreen':
      return { ...state, screen: action.screen }
    case 'setSpatial':
      return { ...state, filters: { ...filters, spatial: action.spatial, selectedCellId: null } }
    case 'setYear':
      return { ...state, filters: { ...filters, year: action.year, date: moveDateToYear(filters.date, action.year) } }
    case 'setTimeMode':
      return { ...state, filters: { ...filters, timeMode: action.timeMode } }
    case 'setMonth':
      return { ...state, filters: { ...filters, timeMode: 'month', month: action.month } }
    case 'setPentad':
      return { ...state, filters: { ...filters, timeMode: 'pentad', pentad: action.pentad } }
    case 'setDate':
      return {
        ...state,
        filters: {
          ...filters,
          timeMode: 'date',
          date: action.date,
          year: yearOf(action.date),
          month: monthOf(action.date),
        },
      }
    case 'selectCell':
      return { ...state, filters: { ...filters, selectedCellId: action.cellId } }
    case 'resetFilters':
      return { ...state, filters: DEFAULT_FILTERS, compare: DEFAULT_COMPARE }
    case 'setCompare':
      return { ...state, compare: { ...state.compare, ...action.compare } }
    case 'hydrate':
      return action.state
  }
}

/* ---------- URL synchronisation (shareable links, Back/Forward) ----------
 * ?s=explore|compare|notes &src=mock|api
 * &area=national | region:<id> | cell:<id> | bbox:<w>,<s>,<e>,<n>
 * &t=year:<y> | month:<y>-<m> | pentad:<y>-<p> | date:<yyyy-mm-dd>
 * &cell=<cellId> &cmp=<month>,<yearA>,<yearB>
 */

export function serializeState(state: AppState): string {
  const { filters, compare } = state
  const params = new URLSearchParams()
  params.set('s', state.screen)
  params.set('src', state.dataSource)
  const spatial = filters.spatial
  params.set('area', spatial.mode === 'bbox'
    ? `bbox:${spatial.west},${spatial.south},${spatial.east},${spatial.north}`
    : spatial.areaType === 'national' ? 'national'
      : `${spatial.areaType === 'diagnostic_region' ? 'region' : 'cell'}:${spatial.areaId}`)
  params.set('t', {
    year: `year:${filters.year}`,
    month: `month:${filters.year}-${filters.month}`,
    pentad: `pentad:${filters.year}-${filters.pentad}`,
    date: `date:${filters.date}`,
  }[filters.timeMode])
  if (filters.selectedCellId) {
    params.set('cell', filters.selectedCellId)
  }
  params.set('cmp', `${compare.month},${compare.yearA},${compare.yearB}`)
  return `?${params.toString()}`
}

function intIn(value: string | undefined, min: number, max: number): number | null {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

/** Parses a URL query; anything missing or invalid falls back to the defaults. */
export function parseState(search: string, fallbackSource: DataSource): AppState {
  const params = new URLSearchParams(search)
  const screen: Screen = (['explore', 'compare', 'notes'] as const).find((value) => value === params.get('s')) ?? 'explore'
  const dataSource: DataSource = params.get('src') === 'api' ? 'api' : params.get('src') === 'mock' ? 'mock' : fallbackSource
  const filters: Filters = { ...DEFAULT_FILTERS }

  const area = params.get('area') ?? ''
  const [areaKind, areaValue] = area.split(':')
  if (areaKind === 'bbox' && areaValue) {
    const [west, south, east, north] = areaValue.split(',').map(Number)
    if ([west, south, east, north].every(Number.isFinite) && west < east && south < north) {
      filters.spatial = { mode: 'bbox', west, south, east, north }
    }
  } else if (areaKind === 'region' && areaValue) {
    filters.spatial = { mode: 'named', areaType: 'diagnostic_region', areaId: areaValue }
  } else if (areaKind === 'cell' && /^\d+_\d+$/.test(areaValue ?? '')) {
    filters.spatial = { mode: 'named', areaType: 'cell', areaId: areaValue }
  }

  const [timeKind, timeValue = ''] = (params.get('t') ?? '').split(':')
  const [first, second] = timeValue.split('-')
  const year = intIn(first, 1990, 2100)
  if (timeKind === 'year' && year !== null) {
    Object.assign(filters, { timeMode: 'year', year, date: moveDateToYear(filters.date, year) })
  } else if (timeKind === 'month' && year !== null && intIn(second, 1, 12) !== null) {
    Object.assign(filters, { timeMode: 'month', year, month: Number(second), date: moveDateToYear(filters.date, year) })
  } else if (timeKind === 'pentad' && year !== null && intIn(second, 1, 73) !== null) {
    Object.assign(filters, { timeMode: 'pentad', year, pentad: Number(second), date: moveDateToYear(filters.date, year) })
  } else if (timeKind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(timeValue)) {
    Object.assign(filters, { timeMode: 'date', date: timeValue, year: yearOf(timeValue), month: monthOf(timeValue) })
  }
  const cell = params.get('cell')
  filters.selectedCellId = cell && /^\d+_\d+$/.test(cell) ? cell : null

  const [month, yearA, yearB] = (params.get('cmp') ?? '').split(',')
  const compare: CompareFilters = intIn(month, 1, 12) !== null && intIn(yearA, 1990, 2100) !== null && intIn(yearB, 1990, 2100) !== null
    ? { month: Number(month), yearA: Number(yearA), yearB: Number(yearB) }
    : DEFAULT_COMPARE
  return { dataSource, screen, filters, compare }
}

const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<Dispatch<Action> | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => parseState(window.location.search, initialDataSource()))
  const restoringRef = useRef(false)
  const firstRef = useRef(true)

  // State → URL: every user change becomes a history entry; the first render only normalises the URL.
  useEffect(() => {
    const query = serializeState(state)
    if (query === window.location.search) {
      restoringRef.current = false
      firstRef.current = false
      return
    }
    if (firstRef.current || restoringRef.current) {
      window.history.replaceState(null, '', query)
    } else {
      window.history.pushState(null, '', query)
    }
    firstRef.current = false
    restoringRef.current = false
  }, [state])

  // URL → state on Back/Forward.
  useEffect(() => {
    const onPop = () => {
      restoringRef.current = true
      dispatch({ type: 'hydrate', state: parseState(window.location.search, initialDataSource()) })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useAppState(): AppState {
  const state = useContext(StateContext)
  if (!state) {
    throw new Error('useAppState must be used inside AppStateProvider')
  }
  return state
}

export function useDispatch(): Dispatch<Action> {
  const dispatch = useContext(DispatchContext)
  if (!dispatch) {
    throw new Error('useDispatch must be used inside AppStateProvider')
  }
  return dispatch
}

export function toSpatialQuery(spatial: SpatialFilter): SpatialQuery {
  return spatial.mode === 'named'
    ? { kind: 'named', areaType: spatial.areaType, areaId: spatial.areaId }
    : { kind: 'bbox', west: spatial.west, south: spatial.south, east: spatial.east, north: spatial.north }
}

export function toTemporalQuery(filters: Filters): TemporalQuery {
  switch (filters.timeMode) {
    case 'year':
      return { kind: 'year', year: filters.year }
    case 'month':
      return { kind: 'month', year: filters.year, month: filters.month }
    case 'pentad':
      return { kind: 'pentad', year: filters.year, pentad: filters.pentad }
    case 'date':
      return { kind: 'date', date: filters.date }
  }
}

/** Month whose day calendar is shown, or null in year mode (pick a month first). */
export function dayCalendarMonth(filters: Filters): number | null {
  switch (filters.timeMode) {
    case 'year':
      return null
    case 'month':
      return filters.month
    case 'pentad':
      return monthOfPentad(filters.year, filters.pentad)
    case 'date':
      return monthOf(filters.date)
  }
}

export function calendarGranularity(filters: Filters): CalendarGranularity {
  return filters.timeMode === 'pentad' ? 'pentad' : 'month'
}

/** Same-period trend parameters (wireframe: same month/pentad across years, or yearly totals). */
export function trendParameters(filters: Filters): { granularity: TrendGranularity; period: number | null } {
  switch (filters.timeMode) {
    case 'year':
      return { granularity: 'year', period: null }
    case 'month':
      return { granularity: 'month', period: filters.month }
    case 'pentad':
      return { granularity: 'pentad', period: filters.pentad }
    case 'date':
      return { granularity: 'month', period: monthOf(filters.date) }
  }
}

export function useSpatialQuery(): SpatialQuery {
  const { filters } = useAppState()
  return useMemo(() => toSpatialQuery(filters.spatial), [filters.spatial])
}
