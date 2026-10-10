/**
 * Opt-in server timing. Set `PERF_LOG=1` to emit one line per measured
 * operation. Only fixed labels, route kinds and durations are logged; tokens,
 * cookies, user ids, phone numbers and customer data must never be passed here.
 */
const enabled = process.env.PERF_LOG === '1'

export function perfLog(label: string, fields: Record<string, number | string | boolean | null>): void {
  if (!enabled) return
  const parts = Object.entries(fields)
    .map(([key, value]) =>
      typeof value === 'number' ? `${key}=${Math.round(value)}ms` : `${key}=${String(value)}`,
    )
    .join(' ')
  console.log(`[perf] ${label} ${parts}`)
}
