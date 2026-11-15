import { useEffect, useRef, useState } from 'react'
import type { Coverage, Source, Value } from './api'
import { useI18n } from '../i18n'
import type { MessageKey } from '../messages'
import type { Resource } from './useResource'

export const sources: Record<Source, string> = {
  TERRA: 'Terra / MODIS',
  AQUA: 'Aqua / MODIS',
  SNPP: 'Suomi NPP / VIIRS',
  NOAA20: 'NOAA-20 / VIIRS',
}

/** Rolls a figure from its previous value to the new one. Jumps straight there under prefers-reduced-motion. */
export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const [shown, setShown] = useState(0)
  const current = useRef(0)
  useEffect(() => {
    const start = current.current
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || start === value) {
      current.current = value
      setShown(value)
      return
    }
    const began = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / 750)
      current.current = progress === 1 ? value : start + (value - start) * (1 - Math.pow(1 - progress, 3))
      setShown(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{format(shown)}</>
}

export function cellActivityStatus({ value, valueStatus }: Value): MessageKey {
  if (valueStatus !== 'AVAILABLE') return valueStatus
  if (value == null) return 'MISSING'
  return value > 0 ? 'heatSignal' : 'noHeatSignal'
}

export function CoverageNotice({ coverage }: { coverage: Coverage }) {
  const { t, dateLabel } = useI18n()
  if (!coverage.coveredStartDate || !coverage.coveredEndDate) return <p className="notice">{t('outsideCoverage')}</p>
  return (
    <p className={coverage.partial ? 'notice' : 'muted'}>
      {coverage.partial && <strong>{t('partialPeriod')} · </strong>}
      {dateLabel(coverage.coveredStartDate)} – {dateLabel(coverage.coveredEndDate)}
      {' · '}{t('coverageDays', { covered: coverage.coveredDayCount, expected: coverage.expectedDayCount })}
    </p>
  )
}

const errors: Partial<Record<string, MessageKey>> = {
  NO_CELLS_IN_BOUNDS: 'NO_CELLS_IN_BOUNDS',
  DATE_OUTSIDE_DATASET_RANGE: 'DATE_OUTSIDE_DATASET_RANGE',
  DATASET_UNAVAILABLE: 'DATASET_UNAVAILABLE',
  UNSUPPORTED_QUERY: 'UNSUPPORTED_QUERY',
  ENDPOINT_UNAVAILABLE: 'ENDPOINT_UNAVAILABLE',
}

export function ResourceNotice({ resource }: { resource: Resource<unknown> }) {
  const { t } = useI18n()
  if (resource.loading) return <p role="status" className="muted">{t('loading')}</p>
  if (!resource.error) return null

  return (
    <div role="alert" className="notice">
      {t(errors[resource.error] ?? 'loadError')}
      {resource.error !== 'NO_CELLS_IN_BOUNDS' && (
        <button type="button" className="quiet" onClick={resource.retry}>{t('retry')}</button>
      )}
    </div>
  )
}
