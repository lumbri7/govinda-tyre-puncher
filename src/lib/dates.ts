/**
 * Date helpers.
 *
 * Every date the shop cares about (a bill, a salary payment, "today" on the
 * dashboard) belongs to the shop timezone, not to UTC and not to the phone's
 * timezone. A shop in Asia/Kolkata closes at midnight, so report boundaries are
 * computed from `yyyy-mm-dd` in that zone and converted to instants here.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

function partsIn(zone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function zoneOffsetMs(date: Date, zone: string): number {
  const p = partsIn(zone, date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** `2026-03-01 00:00` in `zone` as a real instant. */
export function zonedStartOfDay(dateISO: string, zone = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = dateISO.split('-').map(Number)
  const naive = Date.UTC(year, month - 1, day)
  let instant = naive - zoneOffsetMs(new Date(naive), zone)
  const corrected = naive - zoneOffsetMs(new Date(instant), zone)
  if (corrected !== instant) instant = corrected
  return new Date(instant)
}

/** Today in the shop timezone, as `yyyy-mm-dd`. */
export function todayISO(zone = DEFAULT_TIMEZONE): string {
  return toISODate(new Date(), zone)
}

export function toISODate(date: Date, zone = DEFAULT_TIMEZONE): string {
  const p = partsIn(zone, date)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function addDays(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

export function startOfMonthISO(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`
}

export function addMonths(dateISO: string, months: number): string {
  const [year, month] = dateISO.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/** Inclusive `from` day to exclusive `to` day, as ISO instants for Postgres. */
export function rangeToInstants(
  fromISO: string,
  toISO: string,
  zone = DEFAULT_TIMEZONE,
): { from: string; to: string } {
  return {
    from: zonedStartOfDay(fromISO, zone).toISOString(),
    to: zonedStartOfDay(addDays(toISO, 1), zone).toISOString(),
  }
}

export function monthRangeToInstants(
  monthISO: string,
  zone = DEFAULT_TIMEZONE,
): { from: string; to: string } {
  const next = addMonths(monthISO, 1)
  return rangeToInstants(monthISO, addDays(next, -1), zone)
}

export function formatDate(instant: string, zone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: zone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(instant))
}

export function formatTime(instant: string, zone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
}

export function formatDateTime(instant: string, zone = DEFAULT_TIMEZONE): string {
  return `${formatDate(instant, zone)}, ${formatTime(instant, zone)}`
}

/** "3 minutes ago", for the notification list. */
export function timeAgo(instant: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(instant).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(instant)
}

/** A `yyyy-mm` month value for `<input type="month">`. */
export function monthValue(dateISO: string): string {
  return dateISO.slice(0, 7)
}

/**
 * Report defaults, kept out of the filter component on purpose: that file is a
 * Client Component (`'use client'`), and a Server Component importing a value
 * from it is a build error rather than a working import.
 */
export function defaultRange(): { from: string; to: string } {
  const today = todayISO()
  return { from: addDays(today, -29), to: today }
}

/** `?staff=` values are uuids; anything else is ignored. */
export function normalizeUuid(value: string | undefined): string {
  if (!value) return ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : ''
}