import { api, type Endpoint } from '../api/client'
import type {
  CalendarResponse,
  CellPeriodDetailsResponse,
  DailyCalendarResponse,
  DailyResponse,
  MapCellsResponse,
  SeasonalityResponse,
  TrendsResponse,
} from '../api/types'
import {
  calendarGranularity,
  dayCalendarMonth,
  toSpatialQuery,
  toTemporalQuery,
  trendParameters,
  type AppState,
} from '../state/AppState'

/*
 * Every Explore panel derives its request from the same AppState, so all panels show the same
 * selection and period. Identical requests share one cached response (see useApi).
 */

export function mapRequest({ dataSource, filters }: AppState): Endpoint<MapCellsResponse> {
  return api.mapCells(dataSource, toSpatialQuery(filters.spatial), toTemporalQuery(filters))
}

export function calendarRequest({ dataSource, filters }: AppState): Endpoint<CalendarResponse> {
  return api.calendar(dataSource, toSpatialQuery(filters.spatial), filters.year, calendarGranularity(filters))
}

export function dayCalendarRequest({ dataSource, filters }: AppState): Endpoint<DailyCalendarResponse> | null {
  const month = dayCalendarMonth(filters)
  return month === null ? null : api.calendarDays(dataSource, toSpatialQuery(filters.spatial), filters.year, month)
}

export function dailyRequest({ dataSource, filters }: AppState): Endpoint<DailyResponse> | null {
  return filters.timeMode === 'date' ? api.daily(dataSource, toSpatialQuery(filters.spatial), filters.date) : null
}

export function trendsRequest(
  { dataSource, filters }: AppState,
  yearRange: { start: number; end: number },
): Endpoint<TrendsResponse> {
  const { granularity, period } = trendParameters(filters)
  return api.trends(dataSource, toSpatialQuery(filters.spatial), yearRange.start, yearRange.end, granularity, period)
}

export function seasonalityRequest({ dataSource, filters }: AppState): Endpoint<SeasonalityResponse> {
  return api.seasonality(dataSource, toSpatialQuery(filters.spatial), calendarGranularity(filters))
}

export function cellDetailsRequest({ dataSource, filters }: AppState): Endpoint<CellPeriodDetailsResponse> | null {
  return filters.selectedCellId === null
    ? null
    : api.cellPeriodDetails(dataSource, filters.selectedCellId, toTemporalQuery(filters))
}
