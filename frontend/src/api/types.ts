/*
 * Response types of the Hoa Lich read-only API, mirroring OpenAPI v0.4
 * (mvp_bussinessRule/HoaLich_OpenAPI_v0.4.yaml, components/schemas). Field names, nullability and
 * enums follow the contract exactly; keep this file in sync when the contract changes.
 */

export type AreaType = 'national' | 'diagnostic_region' | 'cell'
export type SelectionType = 'NAMED_AREA' | 'BOUNDING_BOX'
export type SelectionRule = 'NAMED_AREA_MEMBERSHIP' | 'CENTER_INCLUSIVE'
export type CalendarGranularity = 'month' | 'pentad'
export type TrendGranularity = 'year' | 'month' | 'pentad'
export type ValueStatus = 'AVAILABLE' | 'MISSING' | 'OUTSIDE_DATASET_RANGE' | 'INSUFFICIENT_BASELINE'
export type Origin = 'DIRECT_OBSERVATION' | 'SCALED_OBSERVATION' | 'MODEL_REDISTRIBUTED' | 'MIXED'
export type SourceOrigin = Exclude<Origin, 'MIXED'>
export type Source = 'TERRA' | 'AQUA' | 'SNPP' | 'NOAA20'
export type TemporalSelectorType = 'DATE' | 'YEAR' | 'MONTH' | 'PENTAD'

/** ISO local date, e.g. "2024-03-18". */
export type IsoDate = string

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export interface Coordinates {
  lat: number
  lon: number
}

export interface AreaRef {
  type: AreaType
  id: string
}

export interface SpatialSelection {
  type: SelectionType
  selectionRule: SelectionRule
  /** Present for NAMED_AREA. */
  area?: AreaRef
  /** Present for BOUNDING_BOX: the bbox exactly as requested. */
  requestedBounds?: Bounds
  /** Smallest bbox covering the full geometry of the selected cells. */
  selectedBounds: Bounds
  cellCount: number
  /** Canonical dataset order. */
  cellIds: string[]
}

export interface Coverage {
  requestedStartDate: IsoDate
  requestedEndDate: IsoDate
  coveredStartDate: IsoDate | null
  coveredEndDate: IsoDate | null
  expectedDayCount: number
  coveredDayCount: number
  uncoveredDayCount: number
  partial: boolean
}

export interface ResponseMeta {
  dataVersion: string
  modelVersion: string
  dataThrough: IsoDate
  metric: 'snpp_eq'
  unit: string
  timeZone: 'UTC'
  /** Stable warning codes; copy comes from /metadata warningCatalog. */
  warnings: string[]
}

export interface TemporalSelector {
  type: TemporalSelectorType
  date?: IsoDate
  year?: number
  month?: number
  pentad?: number
  startDate: IsoDate
  endDate: IsoDate
  coverage: Coverage
}

export interface PeriodPeak {
  period: number
  value: number
}

export interface DatePeak {
  date: IsoDate
  value: number
}

export interface CalendarSummary {
  totalValue: number | null
  valueStatus: ValueStatus
  coverage: Coverage
  peakPeriod: PeriodPeak | null
}

export interface DailyCalendarSummary {
  totalValue: number | null
  valueStatus: ValueStatus
  coverage: Coverage
  peakDate: DatePeak | null
}

export interface MapSummary {
  totalValue: number | null
  valueStatus: ValueStatus
  origin: Origin | null
  coverage: Coverage
  minCellValue: number | null
  maxCellValue: number | null
}

export interface SourceComposition {
  sourceCode: 1 | 2 | 3 | 4
  source: Source
  origin: SourceOrigin
  /** Distinct selected cells using this source at least once in the period. */
  cellCount: number
  /** Number of cell-day contributions using this source. */
  contributingCellDayCount: number
  harmonizedValue: number
  /** Detections of the satellite selected by the source code; NOT snpp_eq. */
  inputObservationCount: number
  sourceInputValidCellCount: number
}

export interface Area {
  type: AreaType
  id: string
  /** Vietnamese display name for national and diagnostic regions. */
  name?: string
  diagnosticRegion?: string
  cellCount?: number
  center?: Coordinates
  bounds?: Bounds
}

export interface AreaListResponse {
  items: Area[]
  meta: ResponseMeta
}

export interface SourceCodeDefinition {
  code: 1 | 2 | 3 | 4
  source: Source
  origin: Origin
  description?: string
}

export interface WarningDefinition {
  code: string
  message: string
  appliesTo?: string[]
}

export interface MetadataResponse {
  meta: ResponseMeta
  dateRange: { start: IsoDate; end: IsoDate }
  yearRange: { start: number; end: number }
  gridDegrees: number
  supportedGranularities: {
    calendar: CalendarGranularity[]
    map: Array<'day' | 'year' | 'month' | 'pentad'>
    trends: TrendGranularity[]
    seasonality: CalendarGranularity[]
  }
  capabilities: {
    spatialSelectors: SelectionType[]
    mapGranularities: Array<'day' | 'year' | 'month' | 'pentad'>
    calendarDaysAvailable: boolean
    rawDetectionPointsAvailable: boolean
    harmonizationComparisonAvailable: boolean
    anomalyAvailable: boolean
  }
  sourceCodes: SourceCodeDefinition[]
  limitations: string[]
  warningCatalog: WarningDefinition[]
  daily: {
    available: boolean
    uncertaintyIntervalAvailable: boolean
    qualification: string
  }
}

export interface CalendarValue {
  period: number
  startDate: IsoDate
  endDate: IsoDate
  value: number | null
  valueStatus: ValueStatus
  partial: boolean
  origin: Origin | null
  coverage: Coverage
}

export interface BaselineValue {
  period: number
  value: number | null
  sampleSize: number
  valueStatus: ValueStatus
}

export interface Baseline {
  method: 'median'
  referenceStartYear: number
  referenceEndYear: number
  /** True when the target year is inside the reference range (it is always excluded). */
  excludesTargetYear: boolean
  values: BaselineValue[]
}

export interface CalendarResponse {
  selection: SpatialSelection
  year: number
  granularity: CalendarGranularity
  values: CalendarValue[]
  summary: CalendarSummary
  baseline?: Baseline
  meta: ResponseMeta
}

export interface DailyCalendarValue {
  date: IsoDate
  value: number | null
  valueStatus: ValueStatus
  partial: boolean
  origin: Origin | null
  warnings?: string[]
}

export interface DailyCalendarResponse {
  selection: SpatialSelection
  year: number
  month: number
  values: DailyCalendarValue[]
  summary: DailyCalendarSummary
  meta: ResponseMeta
}

export interface MapCellValue {
  cellId: string
  center: Coordinates
  bounds: Bounds
  value: number | null
  valueStatus: ValueStatus
  partial: boolean
  origin: Origin | null
  /** Exact-date selector only. */
  sourceCode?: 1 | 2 | 3 | 4
  source?: Source
  inputObservationCount?: number
  sourceInputValid?: boolean
}

export interface MapCellsResponse {
  selection: SpatialSelection
  temporalSelector: TemporalSelector
  summary: MapSummary
  cells: MapCellValue[]
  meta: ResponseMeta
}

export interface DailyResponse {
  selection: SpatialSelection
  /** Kept for v0.3 named-area clients. */
  area?: AreaRef
  date: IsoDate
  value: number
  valueStatus: 'AVAILABLE'
  origin: Origin
  partial: false
  sourceComposition: SourceComposition[]
  cells?: MapCellValue[]
  meta: ResponseMeta
}

export interface TrendPoint {
  year: number
  period?: number
  value: number | null
  valueStatus: ValueStatus
  partial: boolean
  origin: Origin | null
  coverage: Coverage
}

export interface TrendsResponse {
  selection: SpatialSelection
  granularity: TrendGranularity
  period?: number
  points: TrendPoint[]
  meta: ResponseMeta
}

export interface SeasonalityPeriod {
  period: number
  sampleSize: number
  mean: number | null
  median: number | null
  valueStatus: ValueStatus
}

export interface SeasonalityResponse {
  selection: SpatialSelection
  granularity: CalendarGranularity
  referenceStartYear: number
  referenceEndYear: number
  minimumSampleSize: number
  periods: SeasonalityPeriod[]
  meta: ResponseMeta
}

export interface CellPeriodDetailsResponse {
  cell: Area
  temporalSelector: TemporalSelector
  value: number | null
  valueStatus: ValueStatus
  origin: Origin | null
  sourceComposition: SourceComposition[]
  meta: ResponseMeta
}

export interface ComparisonPoint {
  year: number
  value: number | null
}

export interface ComparisonSeries {
  seriesType: 'RAW_MODIS' | 'RAW_VIIRS_SNPP' | 'RAW_MERGED_REFERENCE' | 'HARMONIZED'
  label: string
  metric: string
  unit: string
  points: ComparisonPoint[]
}

export interface HarmonizationComparisonResponse {
  series: ComparisonSeries[]
  explanationKeys: string[]
  meta: ResponseMeta
}

export interface FieldError {
  field: string
  rejectedValue?: unknown
  message: string
}

/** application/problem+json body. Drive the UI from `code`, never from `detail`. */
export interface Problem {
  type: string
  title: string
  status: number
  code: string
  detail: string
  instance: string
  errors?: FieldError[]
  timestamp: string
}
