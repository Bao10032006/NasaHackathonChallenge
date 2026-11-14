import type { MapCellValue, MapCellsResponse } from '../api/types'

/** Contract v0.4 section 7 local incompatibility reasons. */
export type IncompatibilityReason = 'VERSION_MISMATCH' | 'CELL_SET_MISMATCH' | 'COVERAGE_MISMATCH' | 'VALUE_UNAVAILABLE'

export const INCOMPATIBILITY_COPY: Record<IncompatibilityReason, string> = {
  VERSION_MISMATCH: 'Hai bản đồ khác phiên bản dữ liệu/mô hình, metric hoặc đơn vị.',
  CELL_SET_MISMATCH: 'Hai bản đồ không cùng tập ô lưới theo đúng thứ tự.',
  COVERAGE_MISMATCH: 'Hai kỳ khác độ dài hiệu lực hoặc có kỳ chưa đầy đủ.',
  VALUE_UNAVAILABLE: 'Một trong hai giá trị không ở trạng thái có dữ liệu.',
}

export interface CellComparison {
  cellId: string
  a: MapCellValue | undefined
  b: MapCellValue | undefined
  /** B minus A, only when the maps are compatible and both values are AVAILABLE. */
  delta: number | null
  reason: IncompatibilityReason | null
}

export interface MapComparison {
  differenceAvailable: boolean
  reasons: IncompatibilityReason[]
  /** summary.totalValue of B minus A; never re-summed from cells. */
  areaDelta: number | null
  /** Shared colour domain from both map summaries (wireframe v0.4 section 5). */
  colorDomain: { min: number; max: number } | null
  cells: CellComparison[]
}

export function compareMaps(a: MapCellsResponse, b: MapCellsResponse): MapComparison {
  const reasons: IncompatibilityReason[] = []
  if (
    a.meta.dataVersion !== b.meta.dataVersion
    || a.meta.modelVersion !== b.meta.modelVersion
    || a.meta.metric !== b.meta.metric
    || a.meta.unit !== b.meta.unit
  ) {
    reasons.push('VERSION_MISMATCH')
  }
  const sameCells = a.selection.cellIds.length === b.selection.cellIds.length
    && a.selection.cellIds.every((cellId, index) => cellId === b.selection.cellIds[index])
  if (!sameCells) {
    reasons.push('CELL_SET_MISMATCH')
  }
  const coverageA = a.temporalSelector.coverage
  const coverageB = b.temporalSelector.coverage
  if (coverageA.partial || coverageB.partial || coverageA.expectedDayCount !== coverageB.expectedDayCount) {
    reasons.push('COVERAGE_MISMATCH')
  }
  const compatible = reasons.length === 0

  const cellsA = new Map(a.cells.map((cell) => [cell.cellId, cell]))
  const cellsB = new Map(b.cells.map((cell) => [cell.cellId, cell]))
  const order = [...a.selection.cellIds, ...b.selection.cellIds.filter((cellId) => !cellsA.has(cellId))]
  const cells = order.map((cellId): CellComparison => {
    const cellA = cellsA.get(cellId)
    const cellB = cellsB.get(cellId)
    const bothAvailable = cellA?.valueStatus === 'AVAILABLE' && cellB?.valueStatus === 'AVAILABLE'
      && cellA.value !== null && cellB.value !== null
    if (!compatible) {
      return { cellId, a: cellA, b: cellB, delta: null, reason: reasons[0] }
    }
    if (!bothAvailable) {
      return { cellId, a: cellA, b: cellB, delta: null, reason: 'VALUE_UNAVAILABLE' }
    }
    return { cellId, a: cellA, b: cellB, delta: (cellB.value as number) - (cellA.value as number), reason: null }
  })

  const totals = a.summary.totalValue !== null && b.summary.totalValue !== null
  const mins = [a.summary.minCellValue, b.summary.minCellValue].filter((value): value is number => value !== null)
  const maxes = [a.summary.maxCellValue, b.summary.maxCellValue].filter((value): value is number => value !== null)
  return {
    differenceAvailable: compatible,
    reasons,
    areaDelta: compatible && totals ? (b.summary.totalValue as number) - (a.summary.totalValue as number) : null,
    colorDomain: mins.length && maxes.length ? { min: Math.min(...mins), max: Math.max(...maxes) } : null,
    cells,
  }
}
