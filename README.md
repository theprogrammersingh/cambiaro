# Cambiaro

A fast, keyless currency converter, and a working WebMCP reference.

**Live at [cambiaro.programmersingh.dev](https://cambiaro.programmersingh.dev)**

Cambiaro is a single-screen currency converter built as a complete, readable reference for
[WebMCP](https://github.com/webmachinelearning/webmcp): every distinct user
intent in the UI is also registered as a typed, agent-invokable tool, so a
browser agent can operate the page exactly as a person would — without
scraping the DOM.

Rates come from the free, keyless [Frankfurter API](https://api.frankfurter.dev).
No backend, no API key, no accounts.

## Running it

```sh
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # static output in dist/
pnpm lint     # oxlint
```

## The tool surface

Seven tools, one per user intent rather than a single do-everything entry point:

| Tool | Does |
|---|---|
| `convertCurrency` | Convert an amount, optionally as of a past date |
| `swapCurrencies` | Swap the two currencies and reconvert |
| `setBaseCurrency` | Change the "from" currency |
| `setQuoteCurrency` | Change the "to" currency |
| `listCurrencies` | List or filter the supported currencies |
| `getHistoricalRate` | Read the rate for a pair on a given day |
| `getRateTimeSeries` | Read a range of rates and draw the chart |

They are registered on mount against `document.modelContext` and unregistered
by aborting a shared `AbortSignal`.

### Seeing it work

Open **Agent Activity** at the bottom of the page. It shows which surface the
tools bound to, lists each tool with its own `description` (the same string the
agent reads, so the two can't drift), and logs every call with its input and
result. **Try a tool** invokes any of them by hand, exactly as an agent would.

An agent can drive the page directly:

```js
const tools = await document.modelContext.getTools()
const convert = tools.find((t) => t.name === 'convertCurrency')
await document.modelContext.executeTool(convert, { amount: 200, from: 'EUR', to: 'INR' })
```

## How it's put together

```
src/
  api/frankfurter.js          rate fetching, URL-keyed cache, error normalisation
  state/ConverterProvider.jsx  all state, exposed as one `actions` object
  webmcp/                      surface adapter, tool definitions, schema validation
  components/                  the UI
```

The central idea is that **the UI and the tools share one implementation.**
`ConverterProvider` exposes a single `actions` object; a click handler and a
tool handler call the same function, differing only in an `origin` tag. An
agent therefore has no code path that changes state without the screen
following, and any control a tool just touched pulses violet so the change is
attributable at a glance.

Where WebMCP isn't available the page falls back to an internal registry: the
tools stay listed and runnable from the console, and a real agent is picked up
automatically once the browser supports it.
