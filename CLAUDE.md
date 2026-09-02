# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a **greenfield project**: `src/` is still the unmodified `create-vite` React template (`App.jsx` is the Vite/React splash counter, `index.css`/`App.css` hold template styles, `README.md` is the template README). None of the currency-converter product exists yet.

The actual specification lives in two documents at the repo root, and they are the source of truth for what to build:

- `Currency-Converter-PRD.md` — scope, user stories, functional requirements, the WebMCP tool table, and Frankfurter API contract.
- `Currency-Converter-Design-Guidelines.md` — layout, the CSS custom-property color tokens, type scale, per-component behavior, motion, a11y.

Read the relevant sections before implementing a feature rather than inferring intent from the scaffold. When the two docs and the template scaffold disagree (e.g. `index.css` defines `--accent: #aa3bff`, the guidelines define `--color-accent: #2F6FED`), the docs win — the template styles are meant to be replaced.

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml`).

```bash
pnpm dev       # Vite dev server with HMR
pnpm build     # production build to dist/
pnpm preview   # serve the production build
pnpm lint      # oxlint (NOT eslint)
```

There is no test runner configured. If tests are needed, adding one (e.g. Vitest) is a deliberate setup step, not an assumed existing capability.

## Architecture notes

**React Compiler is enabled** — `vite.config.js` runs `babel-plugin-react-compiler` via `@rolldown/plugin-babel` with `reactCompilerPreset()`. Write plain components and let the compiler memoize; do not hand-roll `useMemo`/`useCallback`/`React.memo` unless profiling shows the compiler bailed out. This also means the dev server and build are slower than a bare Vite React setup.

**Linting is oxlint, not ESLint** — config in `.oxlintrc.json`, with `react/rules-of-hooks` as an error and `react/only-export-components` as a warning. There is no `eslint.config.js`; don't add ESLint config files or `eslint-disable` comments.

**No backend, no API key, no build-time secrets.** All data comes from `https://api.frankfurter.dev/v2` fetched directly from the browser. There is no conversion endpoint — fetch the rate and multiply client-side. The app is deployed as static files.

**State**: component state + context only. The PRD explicitly rules out a global state library at this scope.

### The WebMCP layer

This is the point of the project, not an add-on. Every distinct user intent in the UI must also be registered as a typed tool on `navigator.modelContext` (or a polyfill when unavailable), per the tool table in PRD §7.5 — `convertCurrency`, `swapCurrencies`, `setBaseCurrency`/`setQuoteCurrency`, `listCurrencies`, `getHistoricalRate`, `getRateTimeSeries`. Do not collapse these into one general-purpose tool.

Invariants that shape most implementation decisions:

- Tools register on mount and unregister via a per-registration `AbortSignal` when preconditions change — dynamic registration, not a one-shot registry.
- **Every tool call must be visible in the UI.** A tool that mutates state must drive the same React state a human interaction would, so the change is on screen; the Agent Activity panel logs `{time, tool, input, result/error}` in memory.
- The panel's "Available tools" list reads each tool's own `description` field so agent-facing schemas and user-facing docs cannot drift.
- Tools validate input against their JSON Schema and validate currency codes against the cached `/v2/currencies` list before hitting the API; they return structured errors shaped like Frankfurter's `{ message }` rather than throwing.
- Feature-detect `navigator.modelContext` at load. Without it the app must remain fully usable for a human, with the panel showing an explicit unsupported state.
- `--color-agent` (violet) is reserved for agent-driven UI — the panel and the ~600ms pulse on any control a tool just changed. It is the only signal distinguishing "a human did this" from "an agent did this"; never reuse it for ordinary accents.

### API usage discipline

Frankfurter is free and keyless but should not be hammered: debounce amount input ~300ms, cache `/v2/currencies` for the session, and cache repeat rate lookups briefly. Swap should reuse cached rates rather than refetching. Large time-series ranges request `group=week`/`month`.
