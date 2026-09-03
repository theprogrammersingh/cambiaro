# Cambiaro

A currency converter for people and AI agents.

**Live at [cambiaro.programmersingh.dev](https://cambiaro.programmersingh.dev)**

Cambiaro converts between 165 world currencies using live and historical
European Central Bank reference rates. It installs as an offline-capable app,
and every action in its interface is also a typed tool an AI agent can call
through [WebMCP](https://github.com/webmachinelearning/webmcp) — so an agent
operates the converter the same way a person does, without scraping the DOM.

Rates come from the [Frankfurter API](https://api.frankfurter.dev). It runs
entirely in the browser: no backend, no build-time secrets.

## Running it

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # static output in dist/
pnpm preview    # serve the build — the service worker only runs here, not in dev
pnpm lint       # oxlint
pnpm gen:icons  # rebuild the icons and OG image from assets/brand/
```

## Install and offline

It's an installable PWA. The app shell is precached and rate responses are
cached stale-while-revalidate, so opening it without a network shows the last
known figures labelled "Last known rate, <date>" rather than an error.

Icons and the social card are generated from the SVGs in `assets/brand/` by
`scripts/generate-icons.mjs`, via resvg. ImageMagick can't be used here — it has
no librsvg delegate and silently drops stroked paths, writing a blank file.

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
by aborting a shared `AbortSignal`. Each carries `readOnlyHint` — true for the
four that answer a question (`convertCurrency`, `listCurrencies`,
`getHistoricalRate`, `getRateTimeSeries`), false for the three that exist only
to move the UI — and `untrustedContentHint`, always true, because every result
carries ECB rate data fetched from Frankfurter rather than authored here.

Note that `readOnlyHint` is deliberately *not* the inverse of the internal
`mutates` flag: `mutates` means "repaints the converter", which is what gates
the approval prompt, while `readOnlyHint` means "does not modify its
environment". Repainting our own view is not the latter.

### Embedding it in another app

A WebMCP tool is visible only to its own document by default, so an app that
embeds Cambiaro in an iframe discovers nothing at all. To be callable from the
embedding app, load the page with that app's origin in the `actuo` query
parameter:

```html
<iframe src="https://cambiaro.programmersingh.dev/?actuo=https%3A%2F%2Fyour-app.example"
        allow="tools"></iframe>
```

Registration then names that one origin in `exposedTo`, and the embedder's
`getTools({ fromOrigins: ['https://cambiaro.programmersingh.dev'] })` returns
all seven. Anything that is not a parseable absolute URL is ignored, and with no
parameter the page registers exactly as it did before — same-origin only.

The origin is read at runtime rather than baked into a constant because the
embedding app's hostname is its deployment detail, not ours; a hardcoded
allowlist would need a release here every time it changed.

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

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. The workflow lints, regenerates the icons (which
catches a stale committed asset), builds, and deploys `dist/`.

The custom domain is set by `public/CNAME`, and needs a DNS record pointing
`cambiaro` at `theprogrammersingh.github.io`.

## Discoverability

`public/llms.txt` gives answer engines a plain-text summary of what the app does
and how an agent can drive it. `index.html` carries `SoftwareApplication`,
`WebSite` and `FAQPage` structured data, and the static section below the app
states the same facts in markup — so a crawler that never runs the bundle still
reads a real page rather than an empty `<div id="root">`.
