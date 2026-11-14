import type { SpatialSelection, TemporalSelector } from '../api/types'
import type { AreaListResponse } from '../api/types'
import type { Filters } from '../state/AppState'
import { formatDate } from './format'
import { pentadRange } from './time'

export const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

/** Human label of the period the user picked. */
export function periodLabel(filters: Filters): string {
  switch (filters.timeMode) {
    case 'year':
      return `Năm ${filters.year}`
    case 'month':
      return `${MONTH_NAMES[filters.month - 1]}/${filters.year}`
    case 'pentad': {
      const range = pentadRange(filters.year, filters.pentad)
      return `Pentad ${filters.pentad} (${formatDate(range.startDate)}–${formatDate(range.endDate)})`
    }
    case 'date':
      return `Ngày ${formatDate(filters.date)}`
  }
}

export function selectorLabel(selector: TemporalSelector): string {
  switch (selector.type) {
    case 'YEAR':
      return `Năm ${selector.year}`
    case 'MONTH':
      return `${MONTH_NAMES[(selector.month ?? 1) - 1]}/${selector.year}`
    case 'PENTAD':
      return `Pentad ${selector.pentad} (${formatDate(selector.startDate)}–${formatDate(selector.endDate)})`
    case 'DATE':
      return `Ngày ${formatDate(selector.date)}`
  }
}

/** Name of the area for a selection: Vietnamese name for named areas, bbox text otherwise. */
export function selectionLabel(selection: SpatialSelection, areas: AreaListResponse | null): string {
  if (selection.type === 'NAMED_AREA' && selection.area) {
    if (selection.area.type === 'cell') {
      return `Ô lưới ${selection.area.id}`
    }
    const area = areas?.items.find((item) => item.type === selection.area?.type && item.id === selection.area.id)
    return area?.name ?? selection.area.id
  }
  return 'Vùng khoanh trên bản đồ'
}

export function boundsLabel(bounds: { west: number; south: number; east: number; north: number }): string {
  const lon = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}°Đ`
  const lat = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}°B`
  return `${lat(bounds.south)}–${lat(bounds.north)}, ${lon(bounds.west)}–${lon(bounds.east)}`
}
