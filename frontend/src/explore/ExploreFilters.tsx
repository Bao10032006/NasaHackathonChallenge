import type { Area, Bounds, Metadata, Selection, SpatialQuery } from './api'
import { useI18n } from '../i18n'

export type Mode = 'year' | 'month' | 'day' | 'pentad'
export type Filters = { spatial: SpatialQuery; year: number; month: number; mode: Mode; date: string; pentad: number }
export const months = Array.from({ length: 12 }, (_, i) => i + 1)
const modes: Mode[] = ['year', 'month', 'day', 'pentad']

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
  const { t, number, monthLabel, areaLabel, boundsLabel } = useI18n()
  const { spatial, mode, year, month, pentad, date } = filters
  const availableModes = modes.filter((id) =>
    id === 'year' || id === 'month' || id === mode || (regional && id === 'pentad'))
  const areaId = 'areaId' in spatial ? spatial.areaId : ''
  const selectedArea = areas.find((area) => area.id === areaId)
  const years = Array.from({ length: metadata.yearRange.end - metadata.yearRange.start + 1 }, (_, i) => metadata.yearRange.end - i)
  return (
    <section className="panel filters" aria-label={t('areaFilters')}>
      <div className="filter-row">
        <label>{t('analysisArea')}
          <select aria-label={t('analysisArea')} value={areaId} onChange={(event) => {
            const area = areas.find((item) => item.id === event.target.value)
            if (area) onChange({ spatial: { areaId: area.id, areaType: area.type } })
          }}>
            {!areaId && <option value="">{t('drawnArea')}</option>}
            {areas.filter((area) => area.type === 'national').map((area) => <option key={area.id} value={area.id}>{areaLabel(area)}</option>)}
            <optgroup label={t('regions')}>
              {areas.filter((area) => area.type === 'socioeconomic_region').map((area) => <option key={area.id} value={area.id}>{areaLabel(area)}</option>)}
            </optgroup>
          </select>
        </label>
        <button className="outline" type="button" aria-pressed={drawing} aria-controls="fire-map" onClick={onDraw}>
          {drawing ? t('cancelDrawing') : t('drawArea')}
        </button>
        <label>{t('year')}
          <select aria-label={t('year')} value={year} onChange={(event) => onChange({ year: Number(event.target.value), ...(mode === 'day' ? { mode: 'month' as const } : {}) })}>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>{t('viewPeriod')}
          <select aria-label={t('viewPeriod')} value={mode} onChange={(event) => {
            const next = availableModes.find((item) => item === event.target.value)
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
            {availableModes.map((id) => <option key={id} value={id}>{t(id)}</option>)}
          </select>
        </label>
        {(mode === 'month' || mode === 'day') && <label>{t('month')}
          <select aria-label={t('month')} value={month} onChange={(event) => onChange({ month: Number(event.target.value), mode: 'month' })}>
            {months.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}
          </select>
        </label>}
        {mode === 'day' && <label>{t('day')}
          <input type="date" value={date} min={metadata.dateRange.start} max={metadata.dateRange.end}
            onChange={(event) => {
              const next = event.target.value
              if (next && next >= metadata.dateRange.start && next <= metadata.dateRange.end) onDay(next)
            }} />
        </label>}
        {mode === 'pentad' && <label>{t('pentad')}
          <select aria-label={t('pentad')} value={pentad} onChange={(event) => onChange({ pentad: Number(event.target.value) })}>
            {Array.from({ length: 73 }, (_, i) => <option key={i + 1} value={i + 1}>{t('pentadNumber', { period: i + 1 })}</option>)}
          </select>
        </label>}
        <button type="button" className="quiet" onClick={onReset}>{t('reset')}</button>
      </div>
      <div className="selection-line">
        <strong>{areaLabel(selectedArea)}</strong>
        {selection && <><span>{t('cellCount', { count: number(selection.cellCount) })}</span><span>{t('analysisExtent')} {boundsLabel(selection.selectedBounds)}</span></>}
        {'west' in spatial && <span>{t('requestedExtent')} {boundsLabel(spatial)}</span>}
      </div>
    </section>
  )
}
