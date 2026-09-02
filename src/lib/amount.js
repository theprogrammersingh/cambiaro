/**
 * Single source of truth for what counts as a usable amount, shared by the
 * input's inline message and the provider's conversion guard so the two
 * can't disagree about whether a value is valid.
 */
export function amountProblem(raw) {
  const text = String(raw).trim()
  if (text === '') return 'Enter an amount.'
  if (!Number.isFinite(Number(text))) return 'Enter a number.'
  if (Number(text) < 0) return 'Enter an amount of zero or more.'
  return null
}
