/** Shared number/date formatting. Money and rates always use tabular figures. */

export function formatAmount(value, currency) {
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: value >= 1000 ? 2 : 4,
      minimumFractionDigits: 2,
    })
      .format(value)
      .replace(currency, '')
      .trim()
  } catch {
    return value.toFixed(2)
  }
}

/** Rates need more precision than money — 1 EUR = 0.85686 GBP. */
export function formatRate(rate) {
  if (!Number.isFinite(rate)) return '—'
  const digits = rate >= 100 ? 2 : rate >= 1 ? 4 : 5
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 2,
  }).format(rate)
}

/**
 * "4 Jan 1999" — short and plain, matching the API's own tone (§8).
 *
 * Built from an explicit month table rather than Intl: the guidelines pin
 * this exact wording, and locale formatting drifts from it (en-US gives
 * "Jan 4, 1999", en-GB gives "Sept" for September).
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso) {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const [, year, month, day] = match
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
}

export function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}
