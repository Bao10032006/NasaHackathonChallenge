import { ApiError } from './errors'
import { mockRequest } from './mock'
import type {
  AreaListResponse,
  AreaType,
  CalendarGranularity,
  CalendarResponse,
  CellPeriodDetailsResponse,
  DailyCalendarResponse,
  DailyResponse,
  HarmonizationComparisonResponse,
  IsoDate,
  MapCellsResponse,
  MetadataResponse,
  Problem,
  SeasonalityResponse,
  TrendGranularity,
  TrendsResponse,
} from './types'

/** `api` calls the Spring backend through the Vite proxy; `mock` reads committed fixtures. */
export type DataSource = 'api' | 'mock'

export type SpatialQuery =
  | { kind: 'named'; areaType: AreaType; areaId: string }
  | { kind: 'bbox'; west: number; south: number; east: number; north: number }

/** Exactly one temporal selector, as /map/cells and /cells/{id}/period-details require. */
export type TemporalQuery =
  | { kind: 'date'; date: IsoDate }
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'pentad'; year: number; pentad: number }

export type Query = Record<string, string>

export { ApiError }
export type { ApiErrorKind } from './errors'

export function spatialParams(spatial: SpatialQuery): Query {
  if (spatial.kind === 'named') {
    return { areaType: spatial.areaType, areaId: spatial.areaId }
  }
  return {
    west: String(spatial.west),
    south: String(spatial.south),
    east: String(spatial.east),
    north: String(spatial.north),
  }
}

export function temporalParams(temporal: TemporalQuery): Query {
  switch (temporal.kind) {
    case 'date':
      return { date: temporal.date }
    case 'year':
      return { year: String(temporal.year) }
    case 'month':
      return { year: String(temporal.year), month: String(temporal.month) }
    case 'pentad':
      return { year: String(temporal.year), pentad: String(temporal.pentad) }
  }
}

/** Stable cache key: endpoint + every parameter + data source (contract v0.4 section 8). */
export function requestKey(source: DataSource, path: string, query: Query): string {
  const params = Object.keys(query)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&')
  return `${source}:${path}?${params}`
}

async function request<T>(source: DataSource, path: string, query: Query): Promise<T> {
  if (source === 'mock') {
    return mockRequest<T>(path, query)
  }
  const search = new URLSearchParams(query).toString()
  let response: Response
  try {
    response = await fetch(`/api/v1${path}${search ? `?${search}` : ''}`, {
      headers: { Accept: 'application/json, application/problem+json' },
    })
  } catch (error) {
    throw new ApiError('network', `Không kết nối được backend: ${String(error)}`)
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const problem = isProblem(body) ? body : null
    throw new ApiError('problem', problem?.detail ?? `HTTP ${response.status}`, response.status, problem)
  }
  return body as T
}

function isProblem(body: unknown): body is Problem {
  return typeof body === 'object' && body !== null && 'code' in body && 'status' in body
}

export interface Endpoint<T> {
  key: string
  load: () => Promise<T>
}

function endpoint<T>(source: DataSource, path: string, query: Query): Endpoint<T> {
  return { key: requestKey(source, path, query), load: () => request<T>(source, path, query) }
}

export const api = {
  metadata: (source: DataSource) => endpoint<MetadataResponse>(source, '/metadata', {}),

  areas: (source: DataSource) => endpoint<AreaListResponse>(source, '/areas', {}),

  mapCells: (source: DataSource, spatial: SpatialQuery, temporal: TemporalQuery) =>
    endpoint<MapCellsResponse>(source, '/map/cells', { ...spatialParams(spatial), ...temporalParams(temporal) }),

  calendar: (source: DataSource, spatial: SpatialQuery, year: number, granularity: CalendarGranularity) =>
    endpoint<CalendarResponse>(source, '/calendar', {
      ...spatialParams(spatial),
      year: String(year),
      granularity,
      includeBaseline: 'true',
    }),

  calendarDays: (source: DataSource, spatial: SpatialQuery, year: number, month: number) =>
    endpoint<DailyCalendarResponse>(source, '/calendar/days', {
      ...spatialParams(spatial),
      year: String(year),
      month: String(month),
    }),

  daily: (source: DataSource, spatial: SpatialQuery, date: IsoDate) =>
    endpoint<DailyResponse>(source, '/daily', { ...spatialParams(spatial), date, includeCells: 'true' }),

  trends: (
    source: DataSource,
    spatial: SpatialQuery,
    startYear: number,
    endYear: number,
    granularity: TrendGranularity,
    period: number | null,
  ) =>
    endpoint<TrendsResponse>(source, '/trends', {
      ...spatialParams(spatial),
      startYear: String(startYear),
      endYear: String(endYear),
      granularity,
      ...(granularity === 'year' || period === null ? {} : { period: String(period) }),
    }),

  seasonality: (
    source: DataSource,
    spatial: SpatialQuery,
    granularity: CalendarGranularity,
    startYear = 2003,
    endYear = 2025,
  ) =>
    endpoint<SeasonalityResponse>(source, '/seasonality', {
      ...spatialParams(spatial),
      granularity,
      startYear: String(startYear),
      endYear: String(endYear),
    }),

  cellPeriodDetails: (source: DataSource, cellId: string, temporal: TemporalQuery) =>
    endpoint<CellPeriodDetailsResponse>(
      source,
      `/cells/${encodeURIComponent(cellId)}/period-details`,
      temporalParams(temporal),
    ),

  harmonizationComparison: (source: DataSource) =>
    endpoint<HarmonizationComparisonResponse>(source, '/harmonization/comparison', {}),
}
