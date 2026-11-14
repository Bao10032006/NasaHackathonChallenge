import type { Coverage, Origin, Source, SourceOrigin, ValueStatus } from '../api/types'

/** Raw numbers keep up to 6 decimals; snpp_eq is a decimal metric, never round it to a fire count. */
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 6 })
}

export function formatInteger(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('vi-VN')
}

export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${formatValue(value)}`
}

/** "2024-03-18" -> "18/03/2024" */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

/** Wireframe v0.4 section 10. AVAILABLE shows the number itself, including zero. */
export const STATUS_COPY: Record<ValueStatus, string> = {
  AVAILABLE: 'Có dữ liệu',
  MISSING: 'Không có dữ liệu cho kỳ này.',
  OUTSIDE_DATASET_RANGE: 'Ngoài phạm vi dữ liệu hiện có.',
  INSUFFICIENT_BASELINE: 'Không đủ dữ liệu lịch sử để so sánh kỳ này.',
}

/** Wireframe v0.4 section 10 / Contract v0.3 section 8 provenance copy. */
export const ORIGIN_COPY: Record<Origin, string> = {
  DIRECT_OBSERVATION: 'Quan sát S-NPP trực tiếp trong snapshot đã lọc.',
  SCALED_OBSERVATION: 'Quan sát NOAA-20 đã quy đổi về S-NPP.',
  MODEL_REDISTRIBUTED: 'Ước lượng hài hòa theo ngày.',
  MIXED: 'Kết hợp nhiều nguồn: quan sát và/hoặc ước lượng hài hòa.',
}

export const SOURCE_LABEL: Record<Source, string> = {
  TERRA: 'MODIS Terra',
  AQUA: 'MODIS Aqua',
  SNPP: 'VIIRS S-NPP',
  NOAA20: 'VIIRS NOAA-20',
}

export const SOURCE_ORIGIN_SHORT: Record<SourceOrigin, string> = {
  DIRECT_OBSERVATION: 'Quan sát trực tiếp',
  SCALED_OBSERVATION: 'Quan sát đã quy đổi',
  MODEL_REDISTRIBUTED: 'Ước lượng mô hình',
}

export const AREA_TYPE_LABEL = {
  national: 'Toàn quốc',
  diagnostic_region: 'Vùng phân tích',
  cell: 'Ô lưới 0,25°',
} as const

export const DIAGNOSTIC_REGION_NOTE = 'Vùng phân tích phục vụ nghiên cứu, không phải ranh giới hành chính.'

export const METRIC_NOTICE =
  'Số phát hiện tương đương S-NPP · dữ liệu lịch sử, không phải cảnh báo cháy · không phải số vụ cháy.'

export function partialCopy(coverage: Coverage): string | null {
  if (!coverage.partial) {
    return null
  }
  if (coverage.coveredStartDate === null) {
    return 'Kỳ nằm hoàn toàn ngoài phạm vi dữ liệu.'
  }
  return `Kỳ chưa đầy đủ: có dữ liệu ${formatDate(coverage.coveredStartDate)}–${formatDate(coverage.coveredEndDate)}`
    + ` (${coverage.coveredDayCount}/${coverage.expectedDayCount} ngày).`
}

/** UI copy keyed by stable problem code (never parse `detail`). */
export const PROBLEM_COPY: Record<string, string> = {
  INVALID_PARAMETER: 'Tham số không hợp lệ.',
  INVALID_SPATIAL_SELECTOR: 'Hãy chọn một vùng có sẵn hoặc nhập đủ bốn cạnh của khung.',
  INVALID_TEMPORAL_SELECTOR: 'Chỉ chọn một kiểu thời gian: năm, tháng, pentad hoặc ngày.',
  INVALID_BOUNDS: 'Khung không hợp lệ: cần tây < đông và nam < bắc.',
  AREA_NOT_FOUND: 'Không tìm thấy vùng trong snapshot.',
  CELL_NOT_FOUND: 'Không tìm thấy ô lưới trong snapshot.',
  NO_CELLS_IN_BOUNDS: 'Khung đã chọn không chứa ô dữ liệu; hãy khoanh lại.',
  UNSUPPORTED_QUERY: 'Bộ lọc này chưa được hỗ trợ.',
  DATE_OUTSIDE_DATASET_RANGE: 'Ngày nằm ngoài phạm vi dữ liệu hiện có.',
  DATASET_UNAVAILABLE: 'Dữ liệu tạm thời không sẵn sàng. Thử lại sau.',
  INTERNAL_ERROR: 'Lỗi máy chủ không dự kiến. Thử lại sau.',
  NOT_FOUND: 'Backend chưa có API này. Chuyển sang "Dữ liệu mẫu" để xem dữ liệu.',
  METHOD_NOT_ALLOWED: 'Phương thức HTTP không được hỗ trợ.',
}
