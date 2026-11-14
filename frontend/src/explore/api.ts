export type Bounds = { west: number; south: number; east: number; north: number }
export type AreaType = 'national' | 'diagnostic_region' | 'cell'
export type SpatialQuery = Bounds | { areaType: AreaType; areaId: string }
export type TimeQuery = { year: number; month?: number; pentad?: number } | { date: string }
export type Area = { type: AreaType; id: string; name?: string; center?: { lat: number; lon: number }; bounds?: Bounds }
export type Selection = { cellCount: number; cellIds: string[]; selectedBounds: Bounds; requestedBounds?: Bounds }
export type Coverage = {
  coveredStartDate: string | null
  coveredEndDate: string | null
  coveredDayCount: number
  expectedDayCount: number
  partial: boolean
}
export type Status = 'AVAILABLE' | 'MISSING' | 'OUTSIDE_DATASET_RANGE' | 'INSUFFICIENT_BASELINE'
export type Origin = 'DIRECT_OBSERVATION' | 'SCALED_OBSERVATION' | 'MODEL_REDISTRIBUTED' | 'MIXED'
export type Source = 'TERRA' | 'AQUA' | 'SNPP' | 'NOAA20'
export type Value = { value: number | null; valueStatus: Status; partial?: boolean; origin?: Origin | null }
export type Meta = { dataVersion: string; modelVersion: string; dataThrough: string; metric: string; unit: string; warnings: string[] }
export type Metadata = {
  meta: Meta
  dateRange: { start: string; end: string }
  yearRange: { start: number; end: number }
  warningCatalog: { code: string; message: string }[]
  limitations: string[]
  daily: { qualification: string }
}
export type SourceContribution = { source: Source; origin: Origin; harmonizedValue: number; contributingCellDayCount: number }
export type Summary = { totalValue: number | null; valueStatus: Status; coverage: Coverage }
export type Baseline = { referenceStartYear: number; referenceEndYear: number; excludesTargetYear: boolean; values: (Value & { period: number; sampleSize: number })[] }
export type Calendar = {
  values: (Value & { period: number; coverage: Coverage })[]
  summary: Summary & { peakPeriod: { period: number; value: number } | null }
  baseline?: Baseline
}
export type Days = {
  values: (Value & { date: string })[]
  summary: Summary & { peakDate: { date: string; value: number } | null }
}
export type MapCell = Value & { cellId: string; center: NonNullable<Area['center']>; bounds: Bounds }
type TemporalSelector = { startDate: string; endDate: string; coverage: Coverage }
export type Grid = { selection: Selection; temporalSelector: TemporalSelector; summary: Summary & { minCellValue: number | null; maxCellValue: number | null; origin: Origin | null }; cells: MapCell[]; meta: Meta }
export type Daily = Value & { sourceComposition: SourceContribution[]; meta: Meta }
export type Details = Daily & { cell: Area; temporalSelector: TemporalSelector }
export type Trends = { points: (Value & { year: number; coverage: Coverage })[] }
export type Seasonality = {
  referenceStartYear: number
  referenceEndYear: number
  periods: { period: number; median: number | null; valueStatus: Status; sampleSize: number }[]
}

export type Query = Record<string, string | number | boolean | undefined>

export class ApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export function endpoint(path: string, query: Query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  return '/api/v1' + path + (params.size ? '?' + params : '')
}

export async function request<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json, application/problem+json' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
    const problem = await response.json().catch(() => null)
    throw new ApiError(response.status === 404 && problem?.code === 'NOT_FOUND' ? 'ENDPOINT_UNAVAILABLE' : problem?.code ?? 'REQUEST_FAILED')
  }
  return response.json() as Promise<T>
}
