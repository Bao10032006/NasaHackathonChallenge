import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'
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

/** Document 08 golden scenario: the default view always has data in mock mode. */
export const GOLDEN_BBOX = { west: 107, south: 12, east: 108, north: 13 } as const

const DEFAULT_FILTERS: Filters = {
  spatial: { mode: 'bbox', ...GOLDEN_BBOX },
  year: 2024,
  timeMode: 'month',
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
  }
}

const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<Dispatch<Action> | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    dataSource: initialDataSource(),
    screen: 'explore' as Screen,
    filters: DEFAULT_FILTERS,
    compare: DEFAULT_COMPARE,
  }))
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
