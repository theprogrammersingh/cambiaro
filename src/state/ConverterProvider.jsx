import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FrankfurterError,
  getCurrencies,
  getRate,
  getSeries,
  shiftIso,
  todayIso,
} from '../api/frankfurter.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { amountProblem } from '../lib/amount.js'
import { ConverterContext, RANGES } from './converterContext.js'

const DEFAULTS = { amount: '1', from: 'EUR', to: 'USD' }

let logId = 0

/**
 * Owns every piece of converter state and exposes one `actions` object.
 *
 * Human event handlers and WebMCP tool handlers call the *same* actions,
 * differing only in an `origin` tag. That is what makes the PRD's "every
 * tool call must be reflected in the visible UI" structural rather than a
 * convention someone has to remember: an agent has no code path that can
 * change state without the UI following, and the two callers cannot drift
 * apart because there is only one implementation.
 */
export function ConverterProvider({ children }) {
  const [currencies, setCurrencies] = useState([])
  const [currenciesError, setCurrenciesError] = useState(null)

  const [amount, setAmountState] = useState(DEFAULTS.amount)
  const [from, setFromState] = useState(DEFAULTS.from)
  const [to, setToState] = useState(DEFAULTS.to)
  const [date, setDateState] = useState(null) // null = latest

  const [outcome, setOutcome] = useState(null) // { rate, result, date }
  const [status, setStatus] = useState('idle') // idle|loading|ready|empty|error
  const [error, setError] = useState(null)

  const [range, setRangeState] = useState('30D')
  const [series, setSeries] = useState([])
  const [seriesStatus, setSeriesStatus] = useState('idle')

  const [activity, setActivity] = useState([])
  const [pulses, setPulses] = useState({})
  const [approvalMode, setApprovalMode] = useState('auto') // auto|confirm

  const conversionId = useRef(0)
  const seriesId = useRef(0)

  const debouncedAmount = useDebouncedValue(amount, 300)

  // Derived during render, not stored: an unusable amount is a property of
  // the current input, so there is nothing to synchronise.
  const amountError = amountProblem(amount)

  /** Flash a control violet to show an agent just touched it (§5.7). */
  const pulse = useCallback((...fields) => {
    setPulses((prev) => {
      const next = { ...prev }
      for (const field of fields) next[field] = (next[field] ?? 0) + 1
      return next
    })
  }, [])

  const logToolCall = useCallback((entry) => {
    setActivity((prev) => [{ id: ++logId, time: Date.now(), ...entry }, ...prev].slice(0, 50))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getCurrencies(controller.signal)
      .then(setCurrencies)
      .catch((err) => {
        if (err.name !== 'AbortError') setCurrenciesError(err.message)
      })
    return () => controller.abort()
  }, [])

  const isKnownCurrency = useCallback(
    (code) => currencies.some((entry) => entry.code === code),
    [currencies],
  )

  /**
   * The one conversion path. Commits its inputs to state first (so the UI
   * shows what was asked for, whoever asked), then fetches and commits the
   * outcome, then returns the structured result for a tool to hand back.
   *
   * Stale responses are dropped by request id so a slow earlier fetch can
   * never overwrite a newer result.
   */
  const convert = useCallback(
    async (input = {}, { origin = 'human' } = {}) => {
      const nextAmount = input.amount ?? Number(amount)
      const nextFrom = input.from ?? from
      const nextTo = input.to ?? to
      const nextDate = input.date === undefined ? date : input.date

      if (input.amount !== undefined) setAmountState(String(input.amount))
      if (input.from !== undefined) setFromState(input.from)
      if (input.to !== undefined) setToState(input.to)
      if (input.date !== undefined) setDateState(input.date)

      if (origin === 'agent') {
        const touched = ['result']
        if (input.amount !== undefined) touched.push('amount')
        if (input.from !== undefined) touched.push('from')
        if (input.to !== undefined) touched.push('to')
        if (input.date !== undefined) touched.push('date')
        pulse(...touched)
      }

      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        setStatus('error')
        setError('Enter an amount of zero or more.')
        throw new FrankfurterError('Enter an amount of zero or more.')
      }

      const id = ++conversionId.current
      setStatus('loading')
      setError(null)

      try {
        const row = await getRate({ base: nextFrom, quote: nextTo, date: nextDate })
        if (id !== conversionId.current) return null // superseded

        if (!row) {
          setOutcome(null)
          setStatus('empty')
          return {
            amount: nextAmount,
            from: nextFrom,
            to: nextTo,
            rate: null,
            result: null,
            date: nextDate,
            note: 'No rate published for that date.',
          }
        }

        const result = nextAmount * row.rate
        setOutcome({ rate: row.rate, result, date: row.date })
        setStatus('ready')
        return {
          amount: nextAmount,
          from: nextFrom,
          to: nextTo,
          rate: row.rate,
          result,
          date: row.date,
        }
      } catch (err) {
        if (id !== conversionId.current || err.name === 'AbortError') return null
        setStatus('error')
        setError(err.message)
        throw err
      }
    },
    [amount, from, to, date, pulse],
  )

  const loadSeries = useCallback(
    async (input = {}, { origin = 'human' } = {}) => {
      const seriesFrom = input.from ?? from
      const seriesTo = input.to ?? to
      const end = input.end ?? todayIso()
      const start = input.start ?? shiftIso(end, -(RANGES[range] ?? 30))

      if (origin === 'agent') pulse('chart')

      const id = ++seriesId.current
      setSeriesStatus('loading')
      try {
        const rows = await getSeries({
          base: seriesFrom,
          quote: seriesTo,
          start,
          end,
          group: input.group,
        })
        if (id !== seriesId.current) return null
        setSeries(rows)
        setSeriesStatus(rows.length === 0 ? 'empty' : 'ready')
        return { from: seriesFrom, to: seriesTo, start, end, points: rows.length, rates: rows }
      } catch (err) {
        if (id !== seriesId.current || err.name === 'AbortError') return null
        setSeriesStatus('error')
        throw err
      }
    },
    [from, to, range, pulse],
  )

  const setAmount = useCallback(
    (value, { origin = 'human' } = {}) => {
      setAmountState(String(value))
      if (origin === 'agent') pulse('amount')
    },
    [pulse],
  )

  const setBaseCurrency = useCallback(
    (code, { origin = 'human' } = {}) => {
      setFromState(code)
      if (origin === 'agent') pulse('from')
    },
    [pulse],
  )

  const setQuoteCurrency = useCallback(
    (code, { origin = 'human' } = {}) => {
      setToState(code)
      if (origin === 'agent') pulse('to')
    },
    [pulse],
  )

  const swapCurrencies = useCallback(
    ({ origin = 'human' } = {}) => {
      setFromState(to)
      setToState(from)
      if (origin === 'agent') pulse('from', 'to', 'result')
      return { from: to, to: from }
    },
    [from, to, pulse],
  )

  const setDate = useCallback(
    (value, { origin = 'human' } = {}) => {
      setDateState(value)
      if (origin === 'agent') pulse('date')
    },
    [pulse],
  )

  const setRange = useCallback(
    (value, { origin = 'human' } = {}) => {
      setRangeState(value)
      if (origin === 'agent') pulse('chart')
    },
    [pulse],
  )

  // Re-convert whenever the inputs settle. A tool that changed state lands
  // here too; the response cache makes that second pass free.
  useEffect(() => {
    if (currencies.length === 0) return
    if (amountProblem(debouncedAmount)) return
    // `convert` is deliberately not a dependency: its identity changes on
    // every input edit, so depending on it would re-run this effect in a loop.
    convert({ amount: Number(debouncedAmount), from, to, date }).catch(() => {})
  }, [debouncedAmount, from, to, date, currencies.length])

  useEffect(() => {
    if (currencies.length === 0) return
    loadSeries().catch(() => {})
  }, [from, to, range, currencies.length])

  const value = {
    currencies,
    currenciesError,
    isKnownCurrency,
    amount,
    from,
    to,
    date,
    outcome,
    status: amountError ? 'error' : status,
    error: amountError ?? error,
    amountError,
    range,
    series,
    seriesStatus,
    activity,
    pulses,
    approvalMode,
    setApprovalMode,
    logToolCall,
    actions: {
      convert,
      loadSeries,
      setAmount,
      setBaseCurrency,
      setQuoteCurrency,
      swapCurrencies,
      setDate,
      setRange,
    },
  }

  return <ConverterContext.Provider value={value}>{children}</ConverterContext.Provider>
}
