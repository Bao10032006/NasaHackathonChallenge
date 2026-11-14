import { useEffect, useState, type FormEvent } from 'react'
import type { Area, AreaType } from '../api/types'
import { Panel } from '../components/raw'
import { AREA_TYPE_LABEL, DIAGNOSTIC_REGION_NOTE, formatDate } from '../lib/format'
import { MONTHS, PENTADS, pentadRange } from '../lib/time'
import { GOLDEN_BBOX, useAppState, useDispatch, type SpatialFilter, type TimeMode } from '../state/AppState'
import { useMetadata, useSnapshot } from '../state/Metadata'

const TIME_MODES: Array<[TimeMode, string]> = [
  ['year', 'Cả năm'],
  ['month', 'Tháng'],
  ['pentad', 'Pentad (kỳ 5 ngày)'],
  ['date', 'Một ngày'],
]

const BBOX_LABELS = {
  west: 'Tây (kinh độ)',
  south: 'Nam (vĩ độ)',
  east: 'Đông (kinh độ)',
  north: 'Bắc (vĩ độ)',
} as const

type BboxFilter = Extract<SpatialFilter, { mode: 'bbox' }>

function areaLabel(area: Area): string {
  if (area.type === 'cell') {
    return `${area.id}${area.diagnosticRegion ? ` · ${area.diagnosticRegion}` : ''}`
  }
  return `${area.name ?? area.id} (${area.id})${area.cellCount ? ` · ${area.cellCount} ô` : ''}`
}

/** Named area and bounding box are mutually exclusive modes (wireframe v0.4 section 8). */
function SpatialFilterForm() {
  const { filters } = useAppState()
  const dispatch = useDispatch()
  const { areas } = useSnapshot()
  const spatial = filters.spatial
  const [mode, setMode] = useState<SpatialFilter['mode']>(spatial.mode)
  const [bbox, setBbox] = useState<BboxFilter>(() =>
    spatial.mode === 'bbox' ? spatial : { mode: 'bbox', ...GOLDEN_BBOX })

  useEffect(() => {
    setMode(spatial.mode)
    if (spatial.mode === 'bbox') {
      setBbox(spatial)
    }
  }, [spatial])

  const items = areas.status === 'success' ? areas.data.items : []
  const named = spatial.mode === 'named' ? spatial : null
  const areaType: AreaType = named?.areaType ?? 'national'
  const options = items.filter((item) => item.type === areaType)

  function selectNamed(type: AreaType, id?: string) {
    const areaId = id ?? items.find((item) => item.type === type)?.id
    if (areaId) {
      dispatch({ type: 'setSpatial', spatial: { mode: 'named', areaType: type, areaId } })
    }
  }

  function applyBbox(event: FormEvent) {
    event.preventDefault()
    dispatch({ type: 'setSpatial', spatial: bbox })
  }

  return (
    <fieldset>
      <legend>Không gian</legend>
      <label>
        <input
          type="radio"
          name="spatial-mode"
          checked={mode === 'named'}
          onChange={() => {
            setMode('named')
            selectNamed(areaType, named?.areaId)
          }}
        />
        Vùng có sẵn
      </label>
      <label>
        <input type="radio" name="spatial-mode" checked={mode === 'bbox'} onChange={() => setMode('bbox')} />
        Khoanh khung (bounding box)
      </label>

      {mode === 'named' && (
        <div data-spatial-mode="named">
          <label htmlFor="area-type">Loại phạm vi</label>
          <select id="area-type" value={areaType} onChange={(event) => selectNamed(event.target.value as AreaType)}>
            {(Object.keys(AREA_TYPE_LABEL) as AreaType[]).map((type) => (
              <option key={type} value={type}>{AREA_TYPE_LABEL[type]}</option>
            ))}
          </select>
          <label htmlFor="area-id">Vùng hoặc ô</label>
          <select
            id="area-id"
            value={named?.areaId ?? ''}
            disabled={areas.status !== 'success'}
            onChange={(event) => selectNamed(areaType, event.target.value)}
          >
            {named === null && <option value="">Chọn…</option>}
            {options.map((item) => (
              <option key={item.id} value={item.id}>{areaLabel(item)}</option>
            ))}
          </select>
          {areaType === 'diagnostic_region' && <p role="note">{DIAGNOSTIC_REGION_NOTE}</p>}
          {areas.status === 'error' && (
            <p role="alert">Không tải được danh sách vùng ({areas.error.code ?? areas.error.kind}).</p>
          )}
        </div>
      )}

      {mode === 'bbox' && (
        <form data-spatial-mode="bbox" onSubmit={applyBbox}>
          {(['west', 'south', 'east', 'north'] as const).map((side) => (
            <label key={side}>
              {BBOX_LABELS[side]}
              <input
                type="number"
                step="0.25"
                value={bbox[side]}
                onChange={(event) => setBbox({ ...bbox, [side]: Number(event.target.value) })}
              />
            </label>
          ))}
          <button type="submit">Áp dụng khung</button>
          <button type="button" onClick={() => dispatch({ type: 'setSpatial', spatial: { mode: 'bbox', ...GOLDEN_BBOX } })}>
            Khung ví dụ Tây Nguyên (107–108°E, 12–13°N)
          </button>
          <p>Ô được tính khi tâm ô nằm trong hoặc trên biên khung. Khung có thể đi qua nhiều vùng.</p>
        </form>
      )}
    </fieldset>
  )
}

function TimeFilterForm() {
  const { filters } = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const yearStart = metadata?.yearRange.start ?? 2000
  const yearEnd = metadata?.yearRange.end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearStart + index)

  return (
    <fieldset>
      <legend>Thời gian (chỉ một kiểu kỳ mỗi lần)</legend>
      <label htmlFor="year">Năm</label>
      <select id="year" value={filters.year} onChange={(event) => dispatch({ type: 'setYear', year: Number(event.target.value) })}>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>

      <div role="radiogroup" aria-label="Kiểu kỳ">
        {TIME_MODES.map(([mode, label]) => (
          <label key={mode}>
            <input
              type="radio"
              name="time-mode"
              checked={filters.timeMode === mode}
              onChange={() => dispatch({ type: 'setTimeMode', timeMode: mode })}
            />
            {label}
          </label>
        ))}
      </div>

      {filters.timeMode === 'month' && (
        <label>
          Tháng
          <select value={filters.month} onChange={(event) => dispatch({ type: 'setMonth', month: Number(event.target.value) })}>
            {MONTHS.map((month) => <option key={month} value={month}>Tháng {month}</option>)}
          </select>
        </label>
      )}
      {filters.timeMode === 'pentad' && (
        <label>
          Pentad
          <select value={filters.pentad} onChange={(event) => dispatch({ type: 'setPentad', pentad: Number(event.target.value) })}>
            {PENTADS.map((pentad) => {
              const range = pentadRange(filters.year, pentad)
              return (
                <option key={pentad} value={pentad}>
                  Pentad {pentad} ({formatDate(range.startDate)}–{formatDate(range.endDate)})
                </option>
              )
            })}
          </select>
        </label>
      )}
      {filters.timeMode === 'date' && (
        <label>
          Ngày
          <input
            type="date"
            value={filters.date}
            min={metadata?.dateRange.start}
            max={metadata?.dateRange.end}
            onChange={(event) => event.target.value && dispatch({ type: 'setDate', date: event.target.value })}
          />
        </label>
      )}
      {metadata && (
        <p>
          Dữ liệu có từ {formatDate(metadata.dateRange.start)} đến {formatDate(metadata.dateRange.end)}.
          Năm {metadata.yearRange.start} và {metadata.yearRange.end} chưa đầy đủ.
        </p>
      )}
    </fieldset>
  )
}

export function ExploreFilters() {
  const dispatch = useDispatch()
  return (
    <Panel id="explore-filters" title="Bộ lọc vùng và thời gian">
      <SpatialFilterForm />
      <TimeFilterForm />
      <button type="button" onClick={() => dispatch({ type: 'resetFilters' })}>Đặt lại về kịch bản demo</button>
    </Panel>
  )
}
