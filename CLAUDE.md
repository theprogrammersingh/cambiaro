# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**Cambiaro** is a built, working single-screen currency converter, deployed at
`cambiaro.programmersingh.dev`. It doubles as a WebMCP reference implementation.

Two specification documents at the repo root remain the source of truth for
intent — read the relevant section before changing behaviour they cover:

- `Cambiaro-PRD.md` — scope, user stories, functional requirements, the WebMCP tool table, and Frankfurter API contract.
- `Cambiaro-Design-Guidelines.md` — layout, the CSS custom-property color tokens, type scale, per-component behavior, motion, a11y.

Both predate implementation and are out of date in four specific ways, verified
against the live API and the WebMCP spec:

| Docs say | Actually |
|---|---|
| `navigator.modelContext` | Spec and polyfills use `document.modelContext`; the adapter tries document → navigator → internal registry |
| `/v2/currencies` is a code→name map | An array of `{iso_code, name, symbol, start_date, end_date}` |
| 201 currencies | 165 |
| Future dates are rejected | They return `[]` with HTTP 200, so "no rate published" is a distinct state from an error |

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml`).

```bash
pnpm dev       # Vite dev server with HMR
pnpm build     # production build to dist/
pnpm preview   # serve the production build
pnpm lint      # oxlint (NOT eslint)
```

`pnpm gen:icons` regenerates every PNG in `public/` from the source SVGs in
`assets/brand/` via `@resvg/resvg-js`. ImageMagick is installed on this machine
but **cannot** rasterize these files — it has no librsvg delegate and silently
drops stroked paths and gradients, producing an empty image. Don't reach for it.

There is no test runner configured. If tests are needed, adding one (e.g. Vitest) is a deliberate setup step, not an assumed existing capability.

`pnpm lint` leaves ~6 warnings, all inherent to the fetch-on-input-change
pattern (`set-state-in-effect`, two deliberate `exhaustive-deps` omissions that
would otherwise loop, one false positive about a ref read inside an async
callback). That is the expected baseline, not a regression to fix.

## Architecture notes

**React Compiler is enabled** — `vite.config.js` runs `babel-plugin-react-compiler` via `@rolldown/plugin-babel` with `reactCompilerPreset()`. Write plain components and let the compiler memoize; do not hand-roll `useMemo`/`useCallback`/`React.memo` unless profiling shows the compiler bailed out. This also means the dev server and build are slower than a bare Vite React setup.

**Linting is oxlint, not ESLint** — config in `.oxlintrc.json`, with `react/rules-of-hooks` as an error and `react/only-export-components` as a warning. There is no `eslint.config.js`; don't add ESLint config files or `eslint-disable` comments.

**No backend, no API key, no build-time secrets.** All data comes from `https://api.frankfurter.dev/v2` fetched directly from the browser. There is no conversion endpoint — fetch the rate and multiply client-side. The app is deployed as static files.

**State**: component state + context only. The PRD explicitly rules out a global state library at this scope.

**The shared spine.** `src/state/ConverterProvider.jsx` owns all state and
exposes one `actions` object. UI event handlers and WebMCP tool handlers call
the *same* functions, differing only in an `origin` tag. This is what makes
"every tool call is reflected in the UI" structural rather than a convention —
preserve it. `useConverter` and `RANGES` live in `src/state/converterContext.js`
(split out so the provider file only exports a component, for fast refresh).

**PWA**: `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Rate responses are
cached stale-while-revalidate so the app opens offline with the last known
figures. `devOptions` is deliberately **disabled** — a dev-mode service worker on
`localhost:5173` is how a previous project's stale Workbox SW ended up hijacking
this port.

### The WebMCP layer

This is the point of the project, not an add-on. Every distinct user intent in the UI must also be registered as a typed tool on `document.modelContext` (see the table above — the PRD's `navigator` spelling is stale), per the tool table in PRD §7.5 — `convertCurrency`, `swapCurrencies`, `setBaseCurrency`/`setQuoteCurrency`, `listCurrencies`, `getHistoricalRate`, `getRateTimeSeries`. Do not collapse these into one general-purpose tool.

Invariants that shape most implementation decisions:

- Tools register on mount and unregister via a per-registration `AbortSignal` when preconditions change — dynamic registration, not a one-shot registry.
- **Every tool call must be visible in the UI.** A tool that mutates state must drive the same React state a human interaction would, so the change is on screen; the Agent Activity panel logs `{time, tool, input, result/error}` in memory.
- The panel's "Available tools" list reads each tool's own `description` field so agent-facing schemas and user-facing docs cannot drift.
- Tools validate input against their JSON Schema and validate currency codes against the cached `/v2/currencies` list before hitting the API; they return structured errors shaped like Frankfurter's `{ message }` rather than throwing.
- Feature-detect at load in `src/webmcp/adapter.js`. Without a surface the app must remain fully usable for a human, with the panel showing an explicit unsupported state and the built-in "Try a tool" console still exercising every tool.
- `--color-agent` (violet) is reserved for agent-driven UI — the panel and the ~600ms pulse on any control a tool just changed. It is the only signal distinguishing "a human did this" from "an agent did this"; never reuse it for ordinary accents.

### API usage discipline

Frankfurter is free and keyless but should not be hammered: debounce amount input ~300ms, cache `/v2/currencies` for the session, and cache repeat rate lookups briefly. Swap should reuse cached rates rather than refetching. Large time-series ranges request `group=week`/`month`.
