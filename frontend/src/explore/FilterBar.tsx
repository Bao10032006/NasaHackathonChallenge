import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Area, SpatialSelection } from '../api/types'
import { Icon } from '../components/Icon'
import { SegmentedControl } from '../components/SegmentedControl'
import { DIAGNOSTIC_REGION_NOTE, formatDate } from '../lib/format'
import { MONTH_NAMES, boundsLabel, periodLabel } from '../lib/labels'
import { PENTADS, pentadRange } from '../lib/time'
import { NARROW_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { GOLDEN_BBOX, NATIONAL_SPATIAL, useAppState, useDispatch, type SpatialFilter, type TimeMode } from '../state/AppState'
import { useMetadata, useSnapshot } from '../state/Metadata'

type BboxFilter = Extract<SpatialFilter, { mode: 'bbox' }>

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

/** Keyboard/form alternative to drawing a box on the map. Opened only on request. */
function BboxForm({ id, current, onDone }: { id: string; current: BboxFilter; onDone: () => void }) {
  const dispatch = useDispatch()
  const formId = useId()
  const firstInput = useRef<HTMLInputElement | null>(null)
  const toDraft = (bounds: BboxFilter): BboxDraft => ({
    west: String(bounds.west), south: String(bounds.south), east: String(bounds.east), north: String(bounds.north),
  })
  const [draft, setDraft] = useState<BboxDraft>(() => toDraft(current))
  const [errors, setErrors] = useState<ReturnType<typeof validateBbox>['errors']>({})

  useEffect(() => {
    setDraft(toDraft(current))
    setErrors({})
  }, [current.west, current.south, current.east, current.north]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    firstInput.current?.focus()
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = validateBbox(draft)
    setErrors(result.errors)
    if (result.bounds) {
      dispatch({ type: 'setSpatial', spatial: result.bounds })
      onDone()
    }
  }

  return (
    <form id={id} className="bbox-form" aria-label="Nhập tọa độ khung" onSubmit={submit} noValidate aria-describedby={errors.form ? `${formId}-form` : undefined}>
      <div className="bbox-grid">
        {SIDES.map(([side, name, unit], index) => (
          <label key={side} className="field">
            <span>{name} <span className="muted">({unit})</span></span>
            <input
              ref={index === 0 ? firstInput : undefined}
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
        <button type="submit" className="button button-small primary">Áp dụng khung</button>
        <button type="button" className="button button-small" onClick={() => setDraft(toDraft({ mode: 'bbox', ...GOLDEN_BBOX }))}>
          Điền khung ví dụ Tây Nguyên
        </button>
        <button type="button" className="button button-small" onClick={onDone}>Đóng</button>
      </div>
      <p className="muted small">Ô được tính khi tâm ô nằm trong hoặc trên biên khung; khung có thể đi qua nhiều vùng.</p>
    </form>
  )
}

const areaValue = (spatial: SpatialFilter) => (spatial.mode === 'bbox' ? 'bbox' : `${spatial.areaType}:${spatial.areaId}`)

function areaName(spatial: SpatialFilter, items: Area[]): string {
  if (spatial.mode === 'bbox') {
    return 'Khung đã khoanh'
  }
  if (spatial.areaType === 'national') {
    return 'Toàn quốc'
  }
  const item = items.find((candidate) => candidate.type === spatial.areaType && candidate.id === spatial.areaId)
  return spatial.areaType === 'cell' ? `Ô ${spatial.areaId}` : item?.name ?? spatial.areaId
}

/**
 * One compact, non-sticky filter row (it never overlaps the map), followed by a selection line that
 * says exactly what is being counted. Explore adds drawing, the previous-area shortcut and the
 * selection returned by /map/cells.
 */
export function FilterBar({
  onOpenGuide,
  showTime = true,
  drawing = false,
  onDrawingChange,
  selection,
  onBack,
}: {
  onOpenGuide?: () => void
  showTime?: boolean
  /** Map drawing mode (Explore only). */
  drawing?: boolean
  onDrawingChange?: (drawing: boolean) => void
  /** Selection actually used by the map response (cell count and extent). */
  selection?: SpatialSelection
  /** Returns to the previous area, when there is one. */
  onBack?: () => void
}) {
  const { filters } = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const { areas } = useSnapshot()
  const narrow = useMediaQuery(NARROW_QUERY)
  const [expanded, setExpanded] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const panelId = useId()
  const editorId = useId()
  const editorButtonRef = useRef<HTMLButtonElement | null>(null)
  const items = areas.status === 'success' ? areas.data.items : []
  const spatial = filters.spatial
  const yearStart = metadata?.yearRange.start ?? 2000
  const yearEnd = metadata?.yearRange.end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearEnd - index)
  const name = areaName(spatial, items)
  const areaSummary = spatial.mode === 'bbox' ? `Khung ${boundsLabel(spatial)}` : name
  const showPanel = !narrow || expanded

  function closeEditor() {
    setEditorOpen(false)
    // After applying, "Nhập tọa độ" is replaced by "Chỉnh tọa độ" (same ref): focus once it renders.
    setTimeout(() => editorButtonRef.current?.focus({ preventScroll: true }), 0)
  }

  function chooseArea(value: string) {
    const [type, ...rest] = value.split(':')
    const id = rest.join(':')
    const item = items.find((candidate) => candidate.type === type && candidate.id === id)
    if (type === 'national') {
      dispatch({ type: 'setSpatial', spatial: NATIONAL_SPATIAL })
    } else if (item) {
      dispatch({ type: 'setSpatial', spatial: { mode: 'named', areaType: item.type, areaId: item.id } })
    }
  }

  function toggleDrawing() {
    setEditorOpen(false)
    onDrawingChange?.(!drawing)
  }

  return (
    <section className="filter-bar" aria-label="Bộ lọc vùng và thời gian">
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
        <div className="filter-row">
          <label className="field">
            <span className="field-label">Vùng phân tích</span>
            <select value={areaValue(spatial)} onChange={(event) => chooseArea(event.target.value)}>
              {spatial.mode === 'bbox' && <option value="bbox">Khung đã khoanh</option>}
              <option value="national:ToanQuoc">Toàn quốc</option>
              <optgroup label="Vùng phân tích">
                {items.filter((item) => item.type === 'diagnostic_region').map((item) => (
                  <option key={item.id} value={`diagnostic_region:${item.id}`}>{item.name ?? item.id} ({item.cellCount} ô)</option>
                ))}
              </optgroup>
              <optgroup label="Ô lưới 0,25°">
                {items.filter((item) => item.type === 'cell').map((item) => (
                  <option key={item.id} value={`cell:${item.id}`}>{item.id}{item.diagnosticRegion ? ` · ${item.diagnosticRegion}` : ''}</option>
                ))}
              </optgroup>
            </select>
          </label>
          {onDrawingChange && (
            <button
              id="draw-toggle"
              type="button"
              className={`button button-outline${drawing ? ' is-active' : ''}`}
              aria-pressed={drawing}
              aria-controls="explore-map"
              onClick={toggleDrawing}
            >
              <Icon name="select" size={16} />{drawing ? 'Hủy khoanh vùng' : 'Khoanh vùng'}
            </button>
          )}
          {spatial.mode !== 'bbox' && (
            <button
              ref={editorButtonRef}
              type="button"
              className="button button-quiet"
              aria-expanded={editorOpen}
              aria-controls={editorId}
              onClick={() => (editorOpen ? closeEditor() : setEditorOpen(true))}
            >
              Nhập tọa độ
            </button>
          )}

          {showTime && (
            <>
              <span className="filter-divider" aria-hidden="true" />
              <div className="field">
                <span className="field-label" aria-hidden="true">Kỳ xem</span>
                <SegmentedControl label="Kỳ xem" options={TIME_MODES} value={filters.timeMode} onChange={(mode) => dispatch({ type: 'setTimeMode', timeMode: mode })} />
              </div>
              {filters.timeMode !== 'date' && (
                <label className="field">
                  <span className="field-label">Năm</span>
                  <select value={filters.year} onChange={(event) => dispatch({ type: 'setYear', year: Number(event.target.value) })}>
                    {years.map((year) => (
                      <option key={year} value={year}>{year}{year === yearStart || year === yearEnd ? ' (chưa đủ năm)' : ''}</option>
                    ))}
                  </select>
                </label>
              )}
              {filters.timeMode === 'month' && (
                <label className="field">
                  <span className="field-label">Tháng</span>
                  <select value={filters.month} onChange={(event) => dispatch({ type: 'setMonth', month: Number(event.target.value) })}>
                    {MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                  </select>
                </label>
              )}
              {filters.timeMode === 'pentad' && (
                <label className="field">
                  <span className="field-label">Kỳ 5 ngày</span>
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
                <label className="field">
                  <span className="field-label">Ngày</span>
                  <input
                    type="date"
                    value={filters.date}
                    min={metadata?.dateRange.start}
                    max={metadata?.dateRange.end}
                    onChange={(event) => event.target.value && dispatch({ type: 'setDate', date: event.target.value })}
                  />
                </label>
              )}
            </>
          )}

        </div>

        <div className="selection-line">
          <strong className="selection-name">{name}</strong>
          {selection && <span className="num">{selection.cellCount} ô được tính</span>}
          {selection && spatial.mode === 'bbox' && <span className="num">Phạm vi tính {boundsLabel(selection.selectedBounds)}</span>}
          {spatial.mode === 'bbox' && <span className="num">Khung yêu cầu {boundsLabel(spatial)}</span>}
          {spatial.mode === 'named' && spatial.areaType === 'diagnostic_region' && <span>{DIAGNOSTIC_REGION_NOTE}</span>}
          <span className="selection-actions">
            {spatial.mode === 'bbox' && (
              <>
                <button
                  ref={editorButtonRef}
                  type="button"
                  className="button button-small"
                  aria-expanded={editorOpen}
                  aria-controls={editorId}
                  onClick={() => (editorOpen ? closeEditor() : setEditorOpen(true))}
                >
                  Chỉnh tọa độ
                </button>
                {onDrawingChange && <button type="button" className="button button-small" onClick={() => { setEditorOpen(false); onDrawingChange(true) }}>Vẽ lại</button>}
                <button type="button" className="button button-small" onClick={() => dispatch({ type: 'setSpatial', spatial: NATIONAL_SPATIAL })}>Xóa</button>
              </>
            )}
            {onBack && (
              <button type="button" className="button button-small" onClick={onBack}>
                <Icon name="chevronDown" size={14} className="icon icon-back" />Vùng trước
              </button>
            )}
            <button type="button" className="button button-small button-quiet" onClick={() => dispatch({ type: 'resetFilters' })}>Đặt lại</button>
            {onOpenGuide && (
              <button type="button" className="button button-small button-quiet" onClick={onOpenGuide}>
                <Icon name="info" size={14} />Cách đọc dữ liệu
              </button>
            )}
          </span>
        </div>

        {editorOpen && (
          <BboxForm
            id={editorId}
            current={spatial.mode === 'bbox' ? spatial : { mode: 'bbox', ...GOLDEN_BBOX }}
            onDone={closeEditor}
          />
        )}
      </div>
    </section>
  )
}
