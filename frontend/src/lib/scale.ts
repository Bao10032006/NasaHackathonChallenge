import type { Origin, ValueStatus } from '../api/types'

/*
 * Visual encoding shared by the map, the day calendar and the legends.
 * Dark "fire" theme: activity goes from deep ember red (low) to bright flame yellow (high), so the most
 * active cells glow on the NASA Black Marble basemap. Square-root scale because values are strongly
 * skewed (many small cells, few very active ones). Zero and out-of-range have their own neutral styles
 * and are always labelled in text, never by colour alone.
 */

export const ACTIVITY_COLORS = ['#6d0a1f', '#a50f15', '#d7301f', '#f16913', '#fd9a44', '#fdd06a', '#fff6b0'] as const
export const ZERO_COLOR = 'rgba(148, 163, 184, 0.18)'
/** Classes from this index up get a soft glow on the map. */
export const HOT_CLASS = 4
/** From this class up, dark text (#1A0B05) has >= 6:1 contrast while white falls below 4.5:1. */
export const DARK_TEXT_CLASS = 3

export interface ActivityScale {
  max: number
  color: (value: number) => string
  /** 0..6 colour class of a positive value, -1 for zero. */
  classOf: (value: number) => number
  /** Upper bounds of each colour class, for the legend. */
  breaks: number[]
}

export function activityScale(max: number | null | undefined): ActivityScale {
  const top = max !== null && max !== undefined && max > 0 ? max : 1
  const classes = ACTIVITY_COLORS.length
  const breaks = ACTIVITY_COLORS.map((_, index) => top * ((index + 1) / classes) ** 2)
  const classOf = (value: number) => {
    if (value <= 0) {
      return -1
    }
    const position = Math.sqrt(Math.min(value, top) / top)
    return Math.min(classes - 1, Math.floor(position * classes))
  }
  return {
    max: top,
    breaks,
    classOf,
    color: (value) => {
      const index = classOf(value)
      return index < 0 ? ZERO_COLOR : ACTIVITY_COLORS[index]
    },
  }
}

/** Short, colour-independent origin badges. */
export const ORIGIN_BADGE: Record<Origin, { short: string; label: string }> = {
  DIRECT_OBSERVATION: { short: 'QS', label: 'Quan sát S-NPP trực tiếp' },
  SCALED_OBSERVATION: { short: 'QĐ', label: 'Quan sát NOAA-20 quy đổi về S-NPP' },
  MODEL_REDISTRIBUTED: { short: 'ƯL', label: 'Ước lượng: tổng tháng của mô hình phân bổ xuống ngày' },
  MIXED: { short: 'HH', label: 'Tổng hợp từ nhiều loại đóng góp' },
}

/** Marker shapes for charts (shape carries the origin, not only colour). */
export const ORIGIN_MARKER: Record<Origin, 'circle' | 'diamond' | 'ring' | 'half'> = {
  DIRECT_OBSERVATION: 'circle',
  SCALED_OBSERVATION: 'diamond',
  MODEL_REDISTRIBUTED: 'ring',
  MIXED: 'half',
}

export const STATUS_BADGE: Record<ValueStatus, { symbol: string; label: string }> = {
  AVAILABLE: { symbol: '', label: 'Có dữ liệu' },
  MISSING: { symbol: '∅', label: 'Không có dữ liệu cho kỳ này' },
  OUTSIDE_DATASET_RANGE: { symbol: '—', label: 'Ngoài phạm vi dữ liệu hiện có' },
  INSUFFICIENT_BASELINE: { symbol: '…', label: 'Không đủ dữ liệu lịch sử' },
}

/** Compact number for tight spaces (calendar cells, axes). */
export function compactValue(value: number): string {
  if (value === 0) {
    return '0'
  }
  if (value >= 10000) {
    return `${(value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}k`
  }
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`
  }
  if (value >= 10) {
    return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
  }
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

/** Readable number for cards: up to 2 decimals (exact value goes in the tooltip/details). */
export function readableValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return value.toLocaleString('vi-VN', { maximumFractionDigits: value >= 100 ? 1 : 2 })
}

/** "Nice" axis ticks from 0 to max. */
export function axisTicks(max: number, count = 4): number[] {
  if (max <= 0) {
    return [0, 1]
  }
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? raw
  const ticks: number[] = []
  for (let value = 0; value <= max + step * 0.001; value += step) {
    ticks.push(Number(value.toPrecision(6)))
  }
  if (ticks[ticks.length - 1] < max) {
    ticks.push(Number((ticks[ticks.length - 1] + step).toPrecision(6)))
  }
  return ticks
}
