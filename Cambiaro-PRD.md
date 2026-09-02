# Product Requirements Document — Cambiaro (WebMCP-Enabled)

**Status:** Draft
**Owner:** Simar Preet Singh
**Doc type:** PRD
**Last updated:** September 2026

---

## 1. Summary

A single-page React application that converts amounts between world currencies using live and historical exchange rates. The app is deliberately small in scope — one screen, one job — but is built to demonstrate WebMCP to its full extent: every meaningful user action in the UI is also exposed as a typed, agent-invokable tool via `navigator.modelContext` (or an approved polyfill), so a browser-based AI agent can operate the converter exactly as a human would, without scraping the DOM.

Exchange rate data is sourced entirely from the free, keyless [Frankfurter API](https://api.frankfurter.dev) (v2).

## 2. Problem Statement

Two separate problems, addressed by one app:

1. **User-facing:** Most "simple" currency converters are cluttered with ads, account walls, or crypto up-sells. There's room for a fast, clean, zero-friction converter — type an amount, pick two currencies, get a rate — with no login and no key required.
2. **Learning/demo-facing:** WebMCP is an emerging W3C proposal (Web Machine Learning Community Group) for exposing page functionality as structured, agent-callable tools through `navigator.modelContext`. Most public examples of WebMCP are either toy snippets or too complex (multi-entity apps) to clearly show the pattern end-to-end. A currency converter is small enough that *every* interactive element can become a tool, making it a clean, complete reference implementation.

## 3. Goals

- Ship a working, deployable currency converter that a human can use with zero instructions.
- Register a WebMCP tool for every distinct user intent in the app (convert, swap, change base, list currencies, get historical/time-series rate, change date) — not just a single "do everything" tool.
- Make the WebMCP layer transparent: the user can see, in-app, which tools are currently registered and watch them fire in real time when an agent (or the user via a "try it" console) invokes them.
- Keep the app entirely client-side and keyless: no backend, no API key, no user accounts.
- Make the codebase small and readable enough to serve as a teaching reference for WebMCP patterns (registration, schemas, lifecycle/unregistration, approval gating).

## 4. Non-Goals

- No multi-currency "basket" or portfolio tracking.
- No user accounts, saved preferences synced across devices, or backend persistence.
- No support for cryptocurrencies (Frankfurter covers fiat/central-bank-tracked currencies only).
- No monetization, ads, or analytics tracking of personal data.
- No native mobile app — responsive web only.
- Not building a general-purpose MCP *server*; this is a browser-side WebMCP *page* (tools live in the tab, not on a remote server), consistent with WebMCP's client-side architecture.

## 5. Target Users

| User | Need |
|---|---|
| Traveler / shopper | Quick manual conversion, e.g. "200 EUR in INR" |
| Developer/learner exploring agentic browsers | Wants to see a real, working WebMCP tool registry they can inspect and invoke |
| AI agent operating on the user's behalf (e.g. a browser copilot) | Needs structured tools to perform conversions inside the page without brittle DOM automation |

## 6. Core User Stories

1. As a user, I can enter an amount, pick a "from" and "to" currency, and see the converted result update live.
2. As a user, I can swap the "from" and "to" currencies with one click and the result recalculates.
3. As a user, I can pick a historical date and see what the rate/conversion would have been on that date.
4. As a user, I can view a short time-series chart of a currency pair's rate over a date range.
5. As a user, I can search/filter the currency list by code or name (201 currencies is too many to scroll).
6. As an agent, I can discover the page's tools, read each tool's description and input schema, and call `convertCurrency`, `swapCurrencies`, `setBaseCurrency`, `getHistoricalRate`, or `getRateTimeSeries` and receive a structured, typed result — without clicking anything.
7. As a user, I can see a small "Agent Activity" panel that logs when a tool was invoked, by what input, and what it returned, so the WebMCP layer isn't an invisible black box.

## 7. Functional Requirements

### 7.1 Conversion (core flow)
- Amount input (numeric, defaults to `1`), "From" currency selector, "To" currency selector.
- Live conversion on input change, debounced (~300ms) to avoid hammering the API.
- Display: converted amount, the unit exchange rate ("1 EUR = 1.0842 USD"), and the rate's `date` (Frankfurter returns the date the rate is valid for).
- Swap button (↔) that exchanges "from"/"to" and re-converts instantly using cached data where possible.

### 7.2 Currency list
- Populated from `GET /v2/currencies` (code → name map) on load; cached in memory for the session.
- Searchable dropdown/combobox (type to filter by code or name).

### 7.3 Historical rate
- Date picker (defaults to "latest"). Selecting a past date re-fetches via `GET /v2/rates?date=YYYY-MM-DD&base=...&quotes=...` (or `GET /v2/rate/{base}/{quote}?date=...`) and updates the result + label ("Rate as of 4 Jan 1999").
- Disallow future dates in the picker.

### 7.4 Time series (chart)
- A compact date-range picker (e.g. last 7/30/90 days, or custom `from`/`to`).
- Fetches `GET /v2/rates?from=...&to=...&quotes={to}&base={from}`, renders a simple line chart of the pair's rate over that window.
- Large ranges should request grouped data (`group=week`/`month`) per Frankfurter's guidance to keep payloads small.

### 7.5 WebMCP tool layer
Each tool below is registered on mount (or when its preconditions are met) and unregistered on unmount/state change, using an `AbortSignal` per WebMCP's dynamic-registration pattern.

| Tool name | Description (agent-facing) | Input schema (JSON Schema, illustrative) | Behavior |
|---|---|---|---|
| `convertCurrency` | Convert an amount from one currency to another, optionally on a given date | `{ amount: number, from: string(3), to: string(3), date?: string }` | Updates form state, fetches rate, returns `{ amount, from, to, rate, result, date }` |
| `swapCurrencies` | Swap the current "from" and "to" currencies | `{}` | Swaps state, re-converts, returns new `{ from, to, result }` |
| `setBaseCurrency` / `setQuoteCurrency` | Change just the "from" or "to" currency without altering amount | `{ currency: string(3) }` | Validates against the loaded currency list, updates state |
| `listCurrencies` | Return the full supported currency list (code + name) | `{ query?: string }` | Returns filtered/full list from cached `/v2/currencies` data |
| `getHistoricalRate` | Get the rate between two currencies on a specific past date | `{ from: string(3), to: string(3), date: string }` | Read-only fetch; does not require mutating visible UI, but should still reflect in the UI for transparency |
| `getRateTimeSeries` | Get a series of rates for a pair over a date range | `{ from: string(3), to: string(3), start: string, end: string, group?: 'day'|'week'|'month' }` | Populates the chart |

Requirements for this layer:
- Tools with side effects that change visible state (`convertCurrency`, `swapCurrencies`, `set*Currency`) are tagged **low-risk / auto-approved** by default (no destructive or financial-transaction risk — this app doesn't move money), per WebMCP's risk-level/approval-rule concept. This should still be configurable, since approval policy is a judgment call the app can expose as a setting.
- Every tool call must be reflected in the visible UI (WebMCP's design goal is "shared context" between user, page, and agent — the human should always be able to see what the agent just did).
- The "Agent Activity" panel (7.6) subscribes to tool invocations and logs them.
- Tools must validate input against their JSON Schema and return structured errors (matching Frankfurter's own `{ message }` error shape where applicable) rather than throwing raw exceptions.
- Currency codes passed to tools are validated against the cached currency list before hitting the API.

### 7.6 Agent Activity panel
- Collapsible panel showing a running log: timestamp, tool name, input, result/error.
- Not persisted across reloads (in-memory only) — this is a debugging/transparency aid, not an audit system.
- Includes a small "Tools available" list showing currently registered tool names + descriptions, so a curious user can see the WebMCP surface without opening devtools.

### 7.7 Feature detection & fallback
- On load, detect whether `navigator.modelContext` (or the project's chosen WebMCP polyfill) is available.
- If unavailable, the app functions identically for a human user; the Agent Activity panel shows a clear "WebMCP not supported in this browser" state rather than failing silently.

## 8. API Integration Details (Frankfurter v2)

- Base: `https://api.frankfurter.dev/v2`
- No API key required; respect the API's rate-limiting (no hard quota, but avoid unnecessary request volume — debounce input, cache `/currencies` for the session, cache same-query rate lookups briefly).
- Key endpoints used:
  - `GET /v2/currencies` — supported currency list
  - `GET /v2/rates?base=X&quotes=Y` — latest rate(s)
  - `GET /v2/rates?date=YYYY-MM-DD&base=X&quotes=Y` — historical rate
  - `GET /v2/rates?from=...&to=...&quotes=Y&base=X&group=...` — time series
  - `GET /v2/rate/{base}/{quote}` — single-pair convenience lookup
- There is no server-side conversion endpoint; the app fetches the rate and multiplies client-side, per Frankfurter's own documented pattern.
- Error handling: surface Frankfurter's `{ message }` body on 400/404/422 as a friendly inline error, not a console-only failure.

## 9. Tech Stack

- React (function components + hooks), no backend.
- WebMCP registration via the imperative API (`navigator.modelContext` / equivalent React hook wrapper), matching whatever WebMCP support/polyfill the runtime environment provides at build time.
- No global state library required at this scope — component state + context is sufficient.
- Charting: a lightweight library for the single line chart (final choice left to implementation, e.g. a minimal SVG chart rather than a heavy dependency).
- Deployment target: static hosting (e.g. Vercel/Netlify/Firebase Hosting) — the app is 100% client-side.

## 10. Success Metrics

Since this is a demo/learning project rather than a commercial product, success is qualitative:
- A human can complete a conversion in under 10 seconds with no instructions.
- Every core user story in Section 6 has a corresponding, working, independently invocable WebMCP tool.
- The Agent Activity panel correctly and visibly reflects every tool call during a live demo.
- The app degrades gracefully (fully usable, clearly labeled) in browsers without WebMCP support.

## 11. Risks & Open Questions

- **WebMCP is experimental** (behind Chrome flags / origin trial at time of writing) — the app depends on a moving spec and may need a polyfill (e.g. an `navigator.modelContext` shim) to be demoable across environments. This should be revisited as the spec stabilizes.
- **Rate-limiting on Frankfurter** if the Agent Activity demo triggers rapid repeated tool calls — mitigate with caching/debounce (Section 8).
- **Open question:** should tools be scoped to be invocable cross-origin (`exposedTo`), e.g. for an embedded copilot iframe, or kept same-origin only for v1? Recommend same-origin only for v1, revisit later.
- **Open question:** default approval policy for state-changing tools — auto-approve vs. always show a confirm toast. Recommend auto-approve given no financial/destructive risk, but make it a visible toggle so the demo can show both behaviors.
