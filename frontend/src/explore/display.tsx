import type { Coverage, Origin, Source, Status } from './api'
import type { Resource } from './useResource'

const numbers = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const dates = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })

export const number = (value: number) =>
  value > 0 && value < 0.005 ? '<0,01' : value < 0 && value > -0.005 ? '−<0,01' : numbers.format(value)
export const dateLabel = (date: string) => dates.format(new Date(date + 'T00:00:00Z'))

export const statusLabels: Record<Status, string> = {
  AVAILABLE: 'Có dữ liệu',
  MISSING: 'Thiếu dữ liệu',
  OUTSIDE_DATASET_RANGE: 'Ngoài phạm vi',
  INSUFFICIENT_BASELINE: 'Không đủ mẫu',
}

export const origins: Record<Origin, string> = {
  DIRECT_OBSERVATION: 'Quan sát S-NPP trực tiếp',
  SCALED_OBSERVATION: 'Quan sát đã quy đổi về S-NPP',
  MODEL_REDISTRIBUTED: 'Ước lượng từ tổng tháng phân bổ xuống ngày',
  MIXED: 'Tổng hợp từ nhiều loại đóng góp',
}

export const sources: Record<Source, string> = {
  TERRA: 'Terra / MODIS',
  AQUA: 'Aqua / MODIS',
  SNPP: 'Suomi NPP / VIIRS',
  NOAA20: 'NOAA-20 / VIIRS',
}

export function valueLabel(value: number | null, status: Status) {
  return value != null && status === 'AVAILABLE' ? number(value) : statusLabels[status]
}

export function CoverageNotice({ coverage }: { coverage: Coverage }) {
  if (!coverage.coveredStartDate || !coverage.coveredEndDate) return <p className="notice">Ngoài phạm vi dữ liệu.</p>
  return (
    <p className={coverage.partial ? 'notice' : 'muted'}>
      {coverage.partial && <strong>Kỳ chưa đầy đủ · </strong>}
      {dateLabel(coverage.coveredStartDate)} – {dateLabel(coverage.coveredEndDate)}
      {' · '}{coverage.coveredDayCount}/{coverage.expectedDayCount} ngày
    </p>
  )
}

const errors: Record<string, string> = {
  NO_CELLS_IN_BOUNDS: 'Khung đã chọn không chứa ô dữ liệu. Hãy khoanh lại.',
  DATE_OUTSIDE_DATASET_RANGE: 'Ngày đã chọn nằm ngoài phạm vi dữ liệu.',
  DATASET_UNAVAILABLE: 'Nguồn dữ liệu tạm thời không khả dụng.',
  UNSUPPORTED_QUERY: 'Nguồn dữ liệu hiện tại chưa hỗ trợ vùng hoặc kỳ này.',
  ENDPOINT_UNAVAILABLE: 'API hiện chưa cung cấp phần dữ liệu này.',
}

export function ResourceNotice({ resource }: { resource: Resource<unknown> }) {
  if (resource.loading) return <p role="status" className="muted">Đang tải…</p>
  if (!resource.error) return null

  return (
    <div role="alert" className="notice">
      {errors[resource.error] ?? 'Không tải được dữ liệu.'}
      {resource.error !== 'NO_CELLS_IN_BOUNDS' && (
        <button type="button" className="quiet" onClick={resource.retry}>Thử lại</button>
      )}
    </div>
  )
}
