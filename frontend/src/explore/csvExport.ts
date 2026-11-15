import type { Grid, SpatialQuery } from './api'

export function csvField(value: unknown): string {
  if (value == null) return ''
  let text = String(value)
  // Keep text from being evaluated as spreadsheet formulas on import.
  if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}

/** Export API values without map rounding, zoom filtering, or aggregation. */
export function gridCsv(grid: Grid, spatial: SpatialQuery): string {
  const coverage = grid.temporalSelector.coverage
  const headers = ['cell', 'latitude', 'longitude', 'west', 'south', 'east', 'north',
    'start_date', 'end_date', 'snpp_eq', 'value_status', 'origin', 'partial',
    'covered_start_date', 'covered_end_date', 'covered_day_count', 'expected_day_count',
    'selection', 'metric', 'unit', 'data_version', 'model_version', 'data_through', 'warnings']
  const rows = grid.cells.map((cell) => [
    cell.cellId, cell.center.lat, cell.center.lon,
    cell.bounds.west, cell.bounds.south, cell.bounds.east, cell.bounds.north,
    grid.temporalSelector.startDate, grid.temporalSelector.endDate,
    cell.valueStatus === 'AVAILABLE' ? cell.value : null,
    cell.valueStatus, cell.origin ?? null, cell.partial ?? coverage.partial,
    coverage.coveredStartDate, coverage.coveredEndDate, coverage.coveredDayCount, coverage.expectedDayCount,
    JSON.stringify(spatial), grid.meta.metric, grid.meta.unit,
    grid.meta.dataVersion, grid.meta.modelVersion, grid.meta.dataThrough, grid.meta.warnings.join('; '),
  ])
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

export function downloadGridCsv(grid: Grid, spatial: SpatialQuery): void {
  const region = 'areaId' in spatial ? spatial.areaId : 'custom-area'
  const safeRegion = region.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `hoalich_${safeRegion}_${grid.temporalSelector.startDate}_${grid.temporalSelector.endDate}.csv`
  const url = URL.createObjectURL(new Blob([gridCsv(grid, spatial)], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
