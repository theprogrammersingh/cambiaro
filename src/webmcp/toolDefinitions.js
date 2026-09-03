import { getRate, getSeries, todayIso } from '../api/frankfurter.js'
import { formatDate, formatRate } from '../lib/format.js'
import { currencyCodeSchema, isoDateSchema } from './validate.js'

/**
 * The tool surface: one tool per distinct user intent, not a single
 * do-everything entry point.
 *
 * Every handler goes through the same `actions` object the UI's own event
 * handlers use, so an agent physically cannot change state without the
 * screen following along — the "shared context" the spec is built around.
 *
 * Descriptions are written to read well aloud, since they double as the
 * documentation an agent (or a screen-reader user inspecting the same
 * semantic layer) sees.
 */

const AGENT = { origin: 'agent' }

/** Reject unknown codes before spending a request on them. */
function assertKnown(ctx, code) {
  const upper = String(code).toUpperCase()
  if (!ctx.isKnownCurrency(upper)) {
    throw new Error(`Couldn't find that currency: ${code}. Try listCurrencies to see the options.`)
  }
  return upper
}

function assertNotFuture(date) {
  if (date && date > todayIso()) {
    throw new Error("That date is in the future — there's no rate for it yet.")
  }
  return date
}

export function buildTools(getContext) {
  const ctx = () => getContext()

  return [
    {
      name: 'convertCurrency',
      mutates: true,
      readOnly: true,
      description:
        'Convert an amount from one currency to another, optionally as of a past date. Updates the converter on screen and returns the rate and converted total.',
      inputSchema: {
        type: 'object',
        properties: {
          amount: { type: 'number', minimum: 0, description: 'The amount to convert.' },
          from: currencyCodeSchema('Three-letter code to convert from, such as EUR.'),
          to: currencyCodeSchema('Three-letter code to convert to, such as USD.'),
          date: { ...isoDateSchema, description: 'Optional past date, in YYYY-MM-DD form.' },
        },
        required: ['amount', 'from', 'to'],
      },
      async run(input) {
        const context = ctx()
        const from = assertKnown(context, input.from)
        const to = assertKnown(context, input.to)
        const date = assertNotFuture(input.date ?? null)
        const outcome = await context.actions.convert(
          { amount: input.amount, from, to, date },
          AGENT,
        )
        if (!outcome) throw new Error('That conversion was superseded by a newer one.')
        return outcome
      },
      summarize(result) {
        if (result.result === null) return result.note ?? 'No rate published for that date.'
        return `${result.amount} ${result.from} = ${formatRate(result.result)} ${result.to} (1 ${result.from} = ${formatRate(result.rate)} ${result.to}, ${formatDate(result.date)}).`
      },
    },

    {
      name: 'swapCurrencies',
      mutates: true,
      readOnly: false,
      description:
        'Swap the "from" and "to" currencies and reconvert the current amount.',
      inputSchema: { type: 'object', properties: {} },
      async run() {
        const context = ctx()
        const { from, to } = context.actions.swapCurrencies(AGENT)
        const outcome = await context.actions.convert({ from, to }, AGENT)
        return {
          from,
          to,
          rate: outcome?.rate ?? null,
          result: outcome?.result ?? null,
          date: outcome?.date ?? null,
        }
      },
      summarize(result) {
        return `Now converting ${result.from} to ${result.to}${
          result.result === null ? '.' : ` — ${formatRate(result.result)} ${result.to}.`
        }`
      },
    },

    {
      name: 'setBaseCurrency',
      mutates: true,
      readOnly: false,
      description:
        'Change the currency being converted from, leaving the amount unchanged.',
      inputSchema: {
        type: 'object',
        properties: { currency: currencyCodeSchema('Three-letter code, such as GBP.') },
        required: ['currency'],
      },
      async run(input) {
        const context = ctx()
        const currency = assertKnown(context, input.currency)
        context.actions.setBaseCurrency(currency, AGENT)
        const outcome = await context.actions.convert({ from: currency }, AGENT)
        return { from: currency, to: context.to, rate: outcome?.rate ?? null, result: outcome?.result ?? null }
      },
      summarize(result) {
        return `Converting from ${result.from} to ${result.to}.`
      },
    },

    {
      name: 'setQuoteCurrency',
      mutates: true,
      readOnly: false,
      description:
        'Change the currency being converted to, leaving the amount unchanged.',
      inputSchema: {
        type: 'object',
        properties: { currency: currencyCodeSchema('Three-letter code, such as JPY.') },
        required: ['currency'],
      },
      async run(input) {
        const context = ctx()
        const currency = assertKnown(context, input.currency)
        context.actions.setQuoteCurrency(currency, AGENT)
        const outcome = await context.actions.convert({ to: currency }, AGENT)
        return { from: context.from, to: currency, rate: outcome?.rate ?? null, result: outcome?.result ?? null }
      },
      summarize(result) {
        return `Converting from ${result.from} to ${result.to}.`
      },
    },

    {
      name: 'listCurrencies',
      mutates: false,
      readOnly: true,
      description:
        'List the supported currencies, each with its three-letter code and full name. Pass a query to filter by code or name.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional filter, matched against code and name.' },
        },
      },
      async run(input) {
        const context = ctx()
        const query = (input.query ?? '').trim().toLowerCase()
        const matches = context.currencies.filter(
          (entry) =>
            !query ||
            entry.code.toLowerCase().includes(query) ||
            entry.name.toLowerCase().includes(query),
        )
        return {
          query: input.query ?? null,
          count: matches.length,
          currencies: matches.map((entry) => ({ code: entry.code, name: entry.name })),
        }
      },
      summarize(result) {
        if (result.count === 0) return `No currencies match "${result.query}".`
        const preview = result.currencies
          .slice(0, 5)
          .map((entry) => `${entry.code} (${entry.name})`)
          .join(', ')
        return `${result.count} ${result.count === 1 ? 'currency' : 'currencies'}: ${preview}${
          result.count > 5 ? ', …' : ''
        }`
      },
    },

    {
      name: 'getHistoricalRate',
      mutates: true,
      readOnly: true,
      description:
        'Get the exchange rate between two currencies on a specific past date. The converter on screen moves to that date so the result stays visible.',
      inputSchema: {
        type: 'object',
        properties: {
          from: currencyCodeSchema('Three-letter code to convert from.'),
          to: currencyCodeSchema('Three-letter code to convert to.'),
          date: isoDateSchema,
        },
        required: ['from', 'to', 'date'],
      },
      async run(input) {
        const context = ctx()
        const from = assertKnown(context, input.from)
        const to = assertKnown(context, input.to)
        const date = assertNotFuture(input.date)

        // Reflected in the UI for transparency, even though the read itself
        // does not need to mutate anything.
        await context.actions.convert({ from, to, date }, AGENT)

        const row = await getRate({ base: from, quote: to, date })
        if (!row) return { from, to, date, rate: null, note: 'No rate published for that date.' }
        return { from, to, date: row.date, rate: row.rate }
      },
      summarize(result) {
        if (result.rate === null) return result.note
        return `1 ${result.from} = ${formatRate(result.rate)} ${result.to} on ${formatDate(result.date)}.`
      },
    },

    {
      name: 'getRateTimeSeries',
      mutates: true,
      readOnly: true,
      description:
        'Get a series of exchange rates for a currency pair over a date range, and draw it on the chart. Long ranges are grouped by week or month to keep the response small.',
      inputSchema: {
        type: 'object',
        properties: {
          from: currencyCodeSchema('Three-letter code to convert from.'),
          to: currencyCodeSchema('Three-letter code to convert to.'),
          start: { ...isoDateSchema, description: 'First date of the range, YYYY-MM-DD.' },
          end: { ...isoDateSchema, description: 'Last date of the range, YYYY-MM-DD.' },
          group: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            description: 'Optional grouping for the points returned.',
          },
        },
        required: ['from', 'to', 'start', 'end'],
      },
      async run(input) {
        const context = ctx()
        const from = assertKnown(context, input.from)
        const to = assertKnown(context, input.to)
        if (input.start > input.end) throw new Error('The start date must come before the end date.')
        assertNotFuture(input.start)

        await context.actions.loadSeries(
          { from, to, start: input.start, end: input.end, group: input.group },
          AGENT,
        )

        const rows = await getSeries({
          base: from,
          quote: to,
          start: input.start,
          end: input.end,
          group: input.group,
        })
        return {
          from,
          to,
          start: input.start,
          end: input.end,
          group: input.group ?? 'auto',
          count: rows.length,
          rates: rows.map((row) => ({ date: row.date, rate: row.rate })),
        }
      },
      summarize(result) {
        if (result.count === 0) return 'No rates published in that range.'
        const first = result.rates[0]
        const last = result.rates[result.rates.length - 1]
        return `${result.count} points for ${result.from}/${result.to}: ${formatRate(first.rate)} on ${formatDate(first.date)} to ${formatRate(last.rate)} on ${formatDate(last.date)}.`
      },
    },
  ]
}
