import type { Area, Bounds, Metadata, Selection, SpatialQuery } from './api'
import { number } from './display'

export type Mode = 'year' | 'month' | 'day' | 'pentad'
export type Filters = { spatial: SpatialQuery; year: number; month: number; mode: Mode; date: string; pentad: number }
export const months = Array.from({ length: 12 }, (_, i) => i + 1)
const modes: { id: Mode; label: string }[] = [
  { id: 'year', label: 'Năm' }, { id: 'month', label: 'Tháng' },
  { id: 'day', label: 'Ngày' }, { id: 'pentad', label: 'Kỳ 5 ngày' },
]
export function boundsLabel(bounds: Bounds) {
  return `${number(bounds.west)}° – ${number(bounds.east)}° Đông · ${number(bounds.south)}° – ${number(bounds.north)}° Bắc`
}

export function ExploreFilters({ filters, regional, metadata, areas, selection, drawing, onDraw, onChange, onReset, onDay }: {
  filters: Filters
  regional: boolean
  metadata: Metadata
  areas: Area[]
  selection?: Selection
  drawing: boolean
  onDraw: () => void
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
  onDay: (date: string) => void
}) {
  const { spatial, mode, year, month, pentad, date } = filters
  const availableModes = modes.filter(({ id }) =>
    id === 'year' || id === 'month' || id === mode || (regional && id === 'pentad'))
  const areaId = 'areaId' in spatial ? spatial.areaId : ''
  const years = Array.from({ length: metadata.yearRange.end - metadata.yearRange.start + 1 }, (_, i) => metadata.yearRange.end - i)
  return (
    <section className="panel filters" aria-label="Bộ lọc vùng và thời gian">
      <div className="filter-row">
        <label>Vùng phân tích
          <select aria-label="Vùng phân tích" value={areaId} onChange={(event) => {
            const area = areas.find((item) => item.id === event.target.value)
            if (area) onChange({ spatial: { areaId: area.id, areaType: area.type } })
          }}>
            {!areaId && <option value="">Khung đã khoanh</option>}
            {areas.filter((area) => area.type === 'national').map((area) => <option key={area.id} value={area.id}>{area.name ?? 'Toàn quốc'}</option>)}
            <optgroup label="Vùng chẩn đoán">
              {areas.filter((area) => area.type === 'diagnostic_region').map((area) => <option key={area.id} value={area.id}>{area.name ?? area.id}</option>)}
            </optgroup>
            <optgroup label="Ô lưới 0,25°">
              {areas.filter((area) => area.type === 'cell').map((area) => <option key={area.id} value={area.id}>{area.id}</option>)}
            </optgroup>
          </select>
        </label>
        <button className="outline" type="button" aria-pressed={drawing} aria-controls="fire-map" onClick={onDraw}>
          {drawing ? 'Hủy khoanh vùng' : 'Khoanh vùng'}
        </button>
        <label>Năm
          <select aria-label="Năm" value={year} onChange={(event) => onChange({ year: Number(event.target.value), ...(mode === 'day' ? { mode: 'month' as const } : {}) })}>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Kỳ xem
          <select aria-label="Kỳ xem" value={mode} onChange={(event) => {
            const next = availableModes.find((item) => item.id === event.target.value)?.id
            if (next === 'day') {
              const prefix = `${year}-${String(month).padStart(2, '0')}-`
              const candidate = date.startsWith(prefix) ? date : prefix + '01'
              if (candidate < metadata.dateRange.start || candidate > metadata.dateRange.end) {
                onChange({ mode: 'month' })
              } else {
                onDay(candidate)
              }
            } else if (next) {
              onChange({ mode: next })
            }
          }}>
            {availableModes.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        {(mode === 'month' || mode === 'day') && <label>Tháng
          <select aria-label="Tháng" value={month} onChange={(event) => onChange({ month: Number(event.target.value), mode: 'month' })}>
            {months.map((item) => <option key={item} value={item}>Tháng {item}</option>)}
          </select>
        </label>}
        {mode === 'day' && <label>Ngày
          <input type="date" value={date} min={metadata.dateRange.start} max={metadata.dateRange.end}
            onChange={(event) => {
              const next = event.target.value
              if (next && next >= metadata.dateRange.start && next <= metadata.dateRange.end) onDay(next)
            }} />
        </label>}
        {mode === 'pentad' && <label>Kỳ 5 ngày
          <select aria-label="Kỳ 5 ngày" value={pentad} onChange={(event) => onChange({ pentad: Number(event.target.value) })}>
            {Array.from({ length: 73 }, (_, i) => <option key={i + 1} value={i + 1}>Kỳ {i + 1}</option>)}
          </select>
        </label>}
        <button type="button" className="quiet" onClick={onReset}>Đặt lại</button>
      </div>
      <div className="selection-line">
        <strong>{areas.find((area) => area.id === areaId)?.name ?? (areaId ? 'Ô ' + areaId : 'Khung đã khoanh')}</strong>
        {selection && <><span>{number(selection.cellCount)} ô được tính</span><span>Phạm vi tính {boundsLabel(selection.selectedBounds)}</span></>}
        {'west' in spatial && <span>Khung yêu cầu {boundsLabel(spatial)}</span>}
      </div>
    </section>
  )
}
