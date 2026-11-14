import type { AreaType } from '../api/types'
import { DIAGNOSTIC_REGION_NOTE, formatDate } from '../lib/format'
import { MONTH_NAMES } from '../lib/labels'
import { PENTADS, pentadRange } from '../lib/time'
import { GOLDEN_BBOX, useAppState, useDispatch, type TimeMode } from '../state/AppState'
import { useMetadata, useSnapshot } from '../state/Metadata'

const TIME_MODES: Array<[TimeMode, string]> = [
  ['year', 'Năm'],
  ['month', 'Tháng'],
  ['pentad', 'Kỳ 5 ngày'],
  ['date', 'Ngày'],
]

/**
 * One filter bar for every Explore panel. Named area and drawn box are mutually exclusive; the
 * time selector always sends exactly one of year / year+month / year+pentad / date.
 */
export function FilterBar({ onOpenGuide }: { onOpenGuide: () => void }) {
  const { filters } = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const { areas } = useSnapshot()
  const items = areas.status === 'success' ? areas.data.items : []
  const spatial = filters.spatial
  const scope: AreaType | 'bbox' = spatial.mode === 'bbox' ? 'bbox' : spatial.areaType
  const yearStart = metadata?.yearRange.start ?? 2000
  const yearEnd = metadata?.yearRange.end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearEnd - index)

  function chooseScope(next: AreaType | 'bbox') {
    if (next === 'bbox') {
      dispatch({ type: 'setSpatial', spatial: { mode: 'bbox', ...GOLDEN_BBOX } })
      return
    }
    const first = next === 'national' ? 'ToanQuoc' : items.find((item) => item.type === next)?.id
    if (first) {
      dispatch({ type: 'setSpatial', spatial: { mode: 'named', areaType: next, areaId: first } })
    }
  }

  return (
    <section className="filter-bar" aria-label="Bộ lọc vùng và thời gian">
      <div className="filter-group">
        <span className="filter-label" id="scope-label">Phạm vi</span>
        <div className="segmented" role="radiogroup" aria-labelledby="scope-label">
          {([['national', 'Toàn quốc'], ['diagnostic_region', 'Vùng'], ['cell', 'Ô lưới'], ['bbox', 'Khung']] as const).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={scope === value}
                className={scope === value ? 'active' : ''}
                onClick={() => chooseScope(value)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        {spatial.mode === 'named' && spatial.areaType !== 'national' && (
          <select
            aria-label={spatial.areaType === 'cell' ? 'Chọn ô lưới' : 'Chọn vùng phân tích'}
            value={spatial.areaId}
            onChange={(event) => dispatch({
              type: 'setSpatial',
              spatial: { mode: 'named', areaType: spatial.areaType, areaId: event.target.value },
            })}
          >
            {items.filter((item) => item.type === spatial.areaType).map((item) => (
              <option key={item.id} value={item.id}>
                {item.type === 'cell' ? `${item.id} · ${item.diagnosticRegion ?? ''}` : `${item.name ?? item.id} (${item.cellCount} ô)`}
              </option>
            ))}
          </select>
        )}
        {spatial.mode === 'bbox' && (
          <span className="muted small">
            Khung {spatial.south}–{spatial.north}°B, {spatial.west}–{spatial.east}°Đ ·{' '}
            <button type="button" className="link" onClick={() => chooseScope('bbox')}>khung ví dụ Tây Nguyên</button>
            {' '}· hoặc dùng “Khoanh vùng trên bản đồ”
          </span>
        )}
        {spatial.mode === 'named' && spatial.areaType === 'diagnostic_region' && (
          <span className="muted small">{DIAGNOSTIC_REGION_NOTE}</span>
        )}
      </div>

      <div className="filter-group">
        <span className="filter-label" id="time-label">Thời gian</span>
        <div className="segmented" role="radiogroup" aria-labelledby="time-label">
          {TIME_MODES.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={filters.timeMode === mode}
              className={filters.timeMode === mode ? 'active' : ''}
              onClick={() => dispatch({ type: 'setTimeMode', timeMode: mode })}
            >
              {label}
            </button>
          ))}
        </div>
        {filters.timeMode !== 'date' && (
          <select aria-label="Năm" value={filters.year} onChange={(event) => dispatch({ type: 'setYear', year: Number(event.target.value) })}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}{year === yearStart || year === yearEnd ? ' (chưa đủ năm)' : ''}
              </option>
            ))}
          </select>
        )}
        {filters.timeMode === 'month' && (
          <select aria-label="Tháng" value={filters.month} onChange={(event) => dispatch({ type: 'setMonth', month: Number(event.target.value) })}>
            {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        )}
        {filters.timeMode === 'pentad' && (
          <select aria-label="Kỳ 5 ngày" value={filters.pentad} onChange={(event) => dispatch({ type: 'setPentad', pentad: Number(event.target.value) })}>
            {PENTADS.map((pentad) => {
              const range = pentadRange(filters.year, pentad)
              return (
                <option key={pentad} value={pentad}>
                  Kỳ {pentad}: {formatDate(range.startDate).slice(0, 5)}–{formatDate(range.endDate).slice(0, 5)}
                </option>
              )
            })}
          </select>
        )}
        {filters.timeMode === 'date' && (
          <input
            type="date"
            aria-label="Ngày"
            value={filters.date}
            min={metadata?.dateRange.start}
            max={metadata?.dateRange.end}
            onChange={(event) => event.target.value && dispatch({ type: 'setDate', date: event.target.value })}
          />
        )}
      </div>

      <div className="filter-group filter-actions">
        <button type="button" className="button" onClick={() => dispatch({ type: 'resetFilters' })}>Về toàn quốc</button>
        <button type="button" className="button" onClick={onOpenGuide}>ⓘ Nguồn và cách đọc dữ liệu</button>
      </div>
    </section>
  )
}
