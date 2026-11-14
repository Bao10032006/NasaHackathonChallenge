import { useEffect, useId, useState, type FormEvent } from 'react'
import type { AreaType } from '../api/types'
import { Icon } from '../components/Icon'
import { SegmentedControl } from '../components/SegmentedControl'
import { DIAGNOSTIC_REGION_NOTE, formatDate } from '../lib/format'
import { MONTH_NAMES, periodLabel } from '../lib/labels'
import { PENTADS, pentadRange } from '../lib/time'
import { NARROW_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { GOLDEN_BBOX, useAppState, useDispatch, type SpatialFilter, type TimeMode } from '../state/AppState'
import { useMetadata, useSnapshot } from '../state/Metadata'

type Scope = AreaType | 'bbox'
type BboxFilter = Extract<SpatialFilter, { mode: 'bbox' }>

const SCOPES: ReadonlyArray<{ value: Scope; label: string }> = [
  { value: 'national', label: 'Toàn quốc' },
  { value: 'diagnostic_region', label: 'Vùng' },
  { value: 'cell', label: 'Ô lưới' },
  { value: 'bbox', label: 'Khung tọa độ' },
]

const TIME_MODES: ReadonlyArray<{ value: TimeMode; label: string }> = [
  { value: 'year', label: 'Năm' },
  { value: 'month', label: 'Tháng' },
  { value: 'pentad', label: 'Kỳ 5 ngày' },
  { value: 'date', label: 'Ngày' },
]

const SIDES = [
  ['west', 'Tây', 'kinh độ', -180, 180],
  ['east', 'Đông', 'kinh độ', -180, 180],
  ['south', 'Nam', 'vĩ độ', -90, 90],
  ['north', 'Bắc', 'vĩ độ', -90, 90],
] as const

type BboxDraft = Record<'west' | 'south' | 'east' | 'north', string>

function validateBbox(draft: BboxDraft): { errors: Partial<Record<keyof BboxDraft | 'form', string>>; bounds: BboxFilter | null } {
  const errors: Partial<Record<keyof BboxDraft | 'form', string>> = {}
  const values: Partial<Record<keyof BboxDraft, number>> = {}
  for (const [side, name, unit, min, max] of SIDES) {
    const raw = draft[side].trim().replace(',', '.')
    const value = Number(raw)
    if (raw === '' || !Number.isFinite(value)) {
      errors[side] = `Nhập ${unit} ${name.toLowerCase()} bằng số.`
    } else if (value < min || value > max) {
      errors[side] = `${name} phải nằm trong khoảng ${min} đến ${max}.`
    } else {
      values[side] = value
    }
  }
  if (values.west !== undefined && values.east !== undefined && values.west >= values.east) {
    errors.east = 'Đông phải lớn hơn Tây.'
  }
  if (values.south !== undefined && values.north !== undefined && values.south >= values.north) {
    errors.north = 'Bắc phải lớn hơn Nam.'
  }
  if (Object.keys(errors).length > 0) {
    errors.form = 'Khung chưa hợp lệ, xem các trường được đánh dấu.'
    return { errors, bounds: null }
  }
  return { errors, bounds: { mode: 'bbox', west: values.west!, south: values.south!, east: values.east!, north: values.north! } }
}

/** Keyboard/form alternative to drawing a box on the map. */
function BboxForm({ current }: { current: BboxFilter }) {
  const dispatch = useDispatch()
  const formId = useId()
  const toDraft = (bounds: BboxFilter): BboxDraft => ({
    west: String(bounds.west), south: String(bounds.south), east: String(bounds.east), north: String(bounds.north),
  })
  const [draft, setDraft] = useState<BboxDraft>(() => toDraft(current))
  const [errors, setErrors] = useState<ReturnType<typeof validateBbox>['errors']>({})

  useEffect(() => {
    setDraft(toDraft(current))
    setErrors({})
  }, [current.west, current.south, current.east, current.north]) // eslint-disable-line react-hooks/exhaustive-deps

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = validateBbox(draft)
    setErrors(result.errors)
    if (result.bounds) {
      dispatch({ type: 'setSpatial', spatial: result.bounds })
    }
  }

  return (
    <form className="bbox-form" onSubmit={submit} noValidate aria-describedby={errors.form ? `${formId}-form` : undefined}>
      <div className="bbox-grid">
        {SIDES.map(([side, name, unit]) => (
          <label key={side} className="field">
            <span>{name} <span className="muted">({unit})</span></span>
            <input
              inputMode="decimal"
              value={draft[side]}
              aria-invalid={errors[side] ? true : undefined}
              aria-describedby={errors[side] ? `${formId}-${side}` : undefined}
              onChange={(event) => setDraft({ ...draft, [side]: event.target.value })}
            />
            {errors[side] && <span id={`${formId}-${side}`} className="field-error">{errors[side]}</span>}
          </label>
        ))}
      </div>
      {errors.form && <p id={`${formId}-form`} className="field-error" role="alert">{errors.form}</p>}
      <div className="bbox-actions">
        <button type="submit" className="button primary">Áp dụng khung</button>
        <button type="button" className="button" onClick={() => dispatch({ type: 'setSpatial', spatial: { mode: 'bbox', ...GOLDEN_BBOX } })}>
          Khung ví dụ Tây Nguyên
        </button>
      </div>
      <p className="muted small">Ô được tính khi tâm ô nằm trong hoặc trên biên khung; khung có thể đi qua nhiều vùng.</p>
    </form>
  )
}

export function FilterBar({ onOpenGuide, showTime = true }: { onOpenGuide?: () => void; showTime?: boolean }) {
  const { filters } = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const { areas } = useSnapshot()
  const narrow = useMediaQuery(NARROW_QUERY)
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const items = areas.status === 'success' ? areas.data.items : []
  const spatial = filters.spatial
  const scope: Scope = spatial.mode === 'bbox' ? 'bbox' : spatial.areaType
  const yearStart = metadata?.yearRange.start ?? 2000
  const yearEnd = metadata?.yearRange.end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearEnd - index)

  function chooseScope(next: Scope) {
    if (next === 'bbox') {
      dispatch({ type: 'setSpatial', spatial: spatial.mode === 'bbox' ? spatial : { mode: 'bbox', ...GOLDEN_BBOX } })
      return
    }
    const first = next === 'national' ? 'ToanQuoc' : items.find((item) => item.type === next)?.id
    if (first) {
      dispatch({ type: 'setSpatial', spatial: { mode: 'named', areaType: next, areaId: first } })
    }
  }

  const areaSummary = spatial.mode === 'bbox'
    ? `Khung ${spatial.south}–${spatial.north}°B, ${spatial.west}–${spatial.east}°Đ`
    : spatial.areaType === 'national'
      ? 'Toàn quốc'
      : items.find((item) => item.type === spatial.areaType && item.id === spatial.areaId)?.name ?? `Ô ${spatial.areaId}`
  const showPanel = !narrow || expanded

  return (
    <section className="filter-bar" aria-label="Bộ lọc khu vực và thời gian">
      {narrow && (
        <button
          type="button"
          className="filter-toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
        >
          <Icon name="filter" />
          <span className="filter-toggle-text">
            <strong>Bộ lọc</strong>
            <span className="muted">{areaSummary}{showTime ? ` · ${periodLabel(filters)}` : ''}</span>
          </span>
          <Icon name="chevronDown" className={`icon chevron${expanded ? ' open' : ''}`} />
        </button>
      )}
      <div id={panelId} className="filter-panel" hidden={!showPanel}>
        <fieldset className="filter-group">
          <legend className="filter-label">Khu vực</legend>
          <div className="filter-row">
            <SegmentedControl label="Phạm vi" options={SCOPES} value={scope} onChange={chooseScope} />
            {spatial.mode === 'named' && spatial.areaType !== 'national' && (
              <label className="inline-field">
                <span className="visually-hidden">{spatial.areaType === 'cell' ? 'Chọn ô lưới' : 'Chọn vùng phân tích'}</span>
                <select
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
              </label>
            )}
          </div>
          {spatial.mode === 'named' && spatial.areaType === 'diagnostic_region' && (
            <p className="muted small">{DIAGNOSTIC_REGION_NOTE}</p>
          )}
          {spatial.mode === 'bbox' && <BboxForm current={spatial} />}
        </fieldset>

        {showTime && (
        <fieldset className="filter-group">
          <legend className="filter-label">Thời gian</legend>
          <div className="filter-row">
            <SegmentedControl label="Kiểu kỳ" options={TIME_MODES} value={filters.timeMode} onChange={(mode) => dispatch({ type: 'setTimeMode', timeMode: mode })} />
            {filters.timeMode !== 'date' && (
              <label className="inline-field">
                <span className="visually-hidden">Năm</span>
                <select value={filters.year} onChange={(event) => dispatch({ type: 'setYear', year: Number(event.target.value) })}>
                  {years.map((year) => (
                    <option key={year} value={year}>{year}{year === yearStart || year === yearEnd ? ' (chưa đủ năm)' : ''}</option>
                  ))}
                </select>
              </label>
            )}
            {filters.timeMode === 'month' && (
              <label className="inline-field">
                <span className="visually-hidden">Tháng</span>
                <select value={filters.month} onChange={(event) => dispatch({ type: 'setMonth', month: Number(event.target.value) })}>
                  {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
              </label>
            )}
            {filters.timeMode === 'pentad' && (
              <label className="inline-field">
                <span className="visually-hidden">Kỳ 5 ngày</span>
                <select value={filters.pentad} onChange={(event) => dispatch({ type: 'setPentad', pentad: Number(event.target.value) })}>
                  {PENTADS.map((pentad) => {
                    const range = pentadRange(filters.year, pentad)
                    return (
                      <option key={pentad} value={pentad}>
                        Kỳ {pentad}: {formatDate(range.startDate).slice(0, 5)}–{formatDate(range.endDate).slice(0, 5)}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}
            {filters.timeMode === 'date' && (
              <label className="inline-field">
                <span className="visually-hidden">Ngày</span>
                <input
                  type="date"
                  value={filters.date}
                  min={metadata?.dateRange.start}
                  max={metadata?.dateRange.end}
                  onChange={(event) => event.target.value && dispatch({ type: 'setDate', date: event.target.value })}
                />
              </label>
            )}
          </div>
        </fieldset>
        )}

        <div className="filter-actions">
          <button type="button" className="button" onClick={() => dispatch({ type: 'resetFilters' })}>Về toàn quốc</button>
          {onOpenGuide && (
            <button type="button" className="button" onClick={onOpenGuide}>
              <Icon name="info" size={16} />Cách đọc dữ liệu
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
