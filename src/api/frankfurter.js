/**
 * Frankfurter v2 client — https://api.frankfurter.dev
 *
 * Keyless and CORS-open, so every call runs straight from the browser.
 * Latest, historical and time-series reads all hit /v2/rates and come back
 * as the same flat row shape, so one parser covers all three:
 *
 *   [{ date: "2026-09-02", base: "EUR", quote: "USD", rate: 1.1603 }]
 *
 * There is no server-side conversion endpoint and no `amount` parameter
 * (the API rejects it) — fetch the rate and multiply client-side.
 */

const BASE_URL = 'https://api.frankfurter.dev/v2'

const CURRENCIES_TTL = Infinity // stable for a session
const RATES_TTL = 60_000

/** Cache keyed by full request URL, so identical lookups collapse. */
const cache = new Map()

/**
 * An API failure carrying a message fit to show the user. Frankfurter's own
 * error bodies are already plain language ("invalid currency: ZZZ"), so we
 * surface them verbatim rather than inventing our own copy.
 */
export class FrankfurterError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'FrankfurterError'
    this.status = status
  }
}

function buildUrl(path, params = {}) {
  const url = new URL(BASE_URL + path)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function request(url, ttl, signal) {
  const hit = cache.get(url)
  if (hit && hit.expires > Date.now()) return hit.value

  let response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new FrankfurterError("Couldn't reach the rates service. Check your connection.")
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    // 400/404/422 bodies look like { status, message }.
    const message = body?.message ?? `Rates service returned ${response.status}.`
    throw new FrankfurterError(message, response.status)
  }

  cache.set(url, { value: body, expires: ttl === Infinity ? Infinity : Date.now() + ttl })
  return body
}

/**
 * Supported currencies, normalised from the API's row shape.
 * `start_date`/`end_date` bound the range a currency has quotes for, which
 * the date picker uses to avoid asking for rates that cannot exist.
 */
export async function getCurrencies(signal) {
  const rows = await request(buildUrl('/currencies'), CURRENCIES_TTL, signal)
  return rows.map((row) => ({
    code: row.iso_code,
    name: row.name,
    symbol: row.symbol ?? '',
    startDate: row.start_date,
    endDate: row.end_date,
  }))
}

/**
 * Rate rows for a pair or a set of quotes.
 * Pass `date` for a single historical day, or `start`/`end` for a series.
 */
export async function getRates({ base, quotes, date, start, end, group }, signal) {
  const params = { base }
  if (Array.isArray(quotes)) {
    if (quotes.length > 0) params.quotes = quotes.join(',')
  } else if (quotes) {
    params.quotes = quotes
  }
  if (date) params.date = date
  if (start) params.from = start
  if (end) params.to = end
  if (group && group !== 'day') params.group = group

  const rows = await request(buildUrl('/rates', params), RATES_TTL, signal)
  return Array.isArray(rows) ? rows : []
}

/**
 * A single pair's rate, or `null` when the API has no quote for that day.
 *
 * The empty case is deliberately not an error: a future date returns `[]`
 * with HTTP 200, and callers should say "no rate published" rather than
 * showing a failure.
 */
export async function getRate({ base, quote, date }, signal) {
  if (base === quote) {
    return { date: date ?? todayIso(), base, quote, rate: 1 }
  }
  const rows = await getRates({ base, quotes: quote, date }, signal)
  return rows.find((row) => row.quote === quote) ?? null
}

/**
 * Rate history for a pair. Long windows are grouped so the payload stays
 * small, per the API's own guidance.
 */
export async function getSeries({ base, quote, start, end, group }, signal) {
  if (base === quote) return []
  const rows = await getRates(
    { base, quotes: quote, start, end, group: group ?? groupForRange(start, end) },
    signal,
  )
  return rows
    .filter((row) => row.quote === quote)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Daily points stay readable up to ~6 months; beyond that, group them. */
export function groupForRange(start, end) {
  const days = daysBetween(start, end)
  if (days > 730) return 'month'
  if (days > 180) return 'week'
  return 'day'
}

export function daysBetween(start, end) {
  const from = Date.parse(start)
  const to = Date.parse(end)
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  return Math.round((to - from) / 86_400_000)
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function shiftIso(iso, days) {
  const date = new Date(iso + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Test seam / demo aid: drop cached responses. */
export function clearCache() {
  cache.clear()
}
