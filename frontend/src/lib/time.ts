/** Calendar helpers matching the backend period rules (BR07: pentad 73 includes day 366). */

export const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function isoFromDayOfYear(year: number, dayOfYear: number): string {
  const date = new Date(Date.UTC(year, 0, dayOfYear))
  return date.toISOString().slice(0, 10)
}

/** Inclusive range of pentad 1..73 in `year`. */
export function pentadRange(year: number, pentad: number): { startDate: string; endDate: string } {
  const startDay = (pentad - 1) * 5 + 1
  const endDay = pentad === 73 ? (isLeapYear(year) ? 366 : 365) : startDay + 4
  return { startDate: isoFromDayOfYear(year, startDay), endDate: isoFromDayOfYear(year, endDay) }
}

export const PENTADS = Array.from({ length: 73 }, (_, index) => index + 1)

/** Month (1..12) that contains the first day of a pentad. */
export function monthOfPentad(year: number, pentad: number): number {
  return Number(pentadRange(year, pentad).startDate.slice(5, 7))
}

export function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4))
}

export function monthOf(isoDate: string): number {
  return Number(isoDate.slice(5, 7))
}

/** Keep the day of month when switching year, clamping 29/02 to 28/02 in non-leap years. */
export function moveDateToYear(isoDate: string, year: number): string {
  const month = monthOf(isoDate)
  const day = Math.min(Number(isoDate.slice(8, 10)), daysInMonth(year, month))
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
