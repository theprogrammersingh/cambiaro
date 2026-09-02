# Design Guidelines — Currency Converter (WebMCP-Enabled)

**Doc type:** Design Guideline
**Owner:** Simar Preet Singh
**Last updated:** September 2026

---

## 1. Design Principles

1. **One screen, no scroll-hunting.** The entire core task — convert an amount between two currencies — must be completable above the fold, on both desktop and mobile.
2. **Numbers are the hero.** Typography and layout exist to make the amount, the rate, and the result unmistakably the most prominent things on screen.
3. **The agent is a visible collaborator, not a hidden process.** Because this app doubles as a WebMCP reference, the UI must make tool invocations *legible* — when a tool fires, the user should be able to see it happen, not just see the end state change.
4. **Quiet by default, confident when it matters.** Neutral surfaces and restrained color most of the time; color is reserved for state (loading, success, error) and for the one or two brand accent moments.
5. **No dead ends.** Every error state (bad currency pair, network failure, future date) has a clear, human-readable message and a way to recover, echoing the API's own plain-language error format.

## 2. Layout

- **Single-column card layout** centered in the viewport, max-width ~480–560px on desktop, full-width with safe padding on mobile.
- Primary card contains, top to bottom: amount input → from/to selectors with swap control → result → rate/date metadata.
- Secondary content (historical date picker, time-series chart, Agent Activity panel) lives *below* the primary card or in a collapsible section — never competing with the core conversion for initial attention.
- Use a **12px baseline spacing grid** (4/8/12/16/24/32/48) for all margins and padding — no arbitrary spacing values.
- Minimum tap target: 44×44px for all interactive controls (swap button, dropdown triggers, date picker).

## 3. Color System

Define as CSS custom properties (tokens), not hard-coded hex values in components, so the palette can be re-themed without touching component code.

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--color-bg` | App background | `#F7F8FA` | `#0F1115` |
| `--color-surface` | Card / panel background | `#FFFFFF` | `#181B21` |
| `--color-surface-raised` | Nested panels (Agent Activity, dropdown) | `#F1F2F5` | `#20242C` |
| `--color-border` | Dividers, input borders | `#E2E4E9` | `#2A2F3A` |
| `--color-text-primary` | Headlines, result figures | `#12141A` | `#F5F6F8` |
| `--color-text-secondary` | Labels, metadata (rate date, hints) | `#5B6270` | `#9AA1AE` |
| `--color-accent` | Primary action, focus rings, active tab | `#2F6FED` | `#5B8DF6` |
| `--color-success` | Successful conversion / tool call | `#1F9D55` | `#3FBE72` |
| `--color-warning` | Rate-limit / stale-data notices | `#B8860B` | `#D9A441` |
| `--color-error` | API errors, invalid input | `#D64545` | `#F0716B` |
| `--color-agent` | Agent Activity accents (tool calls) | `#7C4FE0` | `#A385F0` |

Notes:
- `--color-agent` (a distinct violet, separate from the primary blue accent) is used *only* in the Agent Activity panel and on any UI element currently being driven by a tool call — e.g. a brief highlight/pulse on an input the instant a WebMCP tool updates it. This keeps "a human did this" vs. "an agent just did this" visually distinguishable at a glance.
- Support `prefers-color-scheme` out of the box; do not ship light-only.
- Never convey state (error/success/agent-driven) through color alone — pair with icon and/or text.

## 4. Typography

- **Typeface:** a single variable sans-serif (e.g. Inter or system-ui stack) for both UI and numerals. Enable tabular figures (`font-variant-numeric: tabular-nums`) on all monetary/rate values so digits don't jitter as they update.
- Scale (desktop / mobile):

| Role | Size | Weight |
|---|---|---|
| Result amount (hero number) | 40 / 32px | 700 |
| Section labels ("From", "To", "Rate") | 13 / 12px, uppercase, letter-spacing +0.04em | 600 |
| Input values (amount field, dropdowns) | 20 / 18px | 500 |
| Body / helper text | 14px | 400 |
| Metadata (date, source note) | 12px | 400, `--color-text-secondary` |

- Line height: 1.4 for body text, 1.1 for the hero result number.
- Never let the result number reflow the layout — reserve width with a min-width or fixed container so a jump from "10.00" to "10,482.19" doesn't shift neighboring elements.

## 5. Components

### 5.1 Amount input
- Large, borderless-until-focus numeric field. Right-aligned currency code chip inside the field (not a separate label) so amount and currency read as one unit.
- Focus state: 2px `--color-accent` ring, no layout shift.
- Invalid input (non-numeric, negative): inline `--color-error` message directly beneath, field border switches to `--color-error`.

### 5.2 Currency selector (combobox)
- Searchable by code or name (must handle 201 currencies without lag — virtualize the list).
- Each row: flag/emoji or two-letter monogram, code (bold), full name (secondary color).
- Selected state shown in the closed control as `code — short name` (e.g. `USD — US Dollar`).

### 5.3 Swap control
- Circular icon button between the two selectors (↔ or a bidirectional-arrow icon), positioned so it visually "belongs" to both fields.
- On press: brief rotate animation (150–200ms) and both selectors' values transpose; result recalculates without a full-page loading state (use the cached rate if available, else a subtle inline spinner only on the result number).

### 5.4 Result block
- Hero number + destination currency code.
- Directly beneath: unit rate in smaller secondary text — "1 EUR = 1.0842 USD" — plus the rate's effective date.
- Loading state: skeleton/shimmer on the number only, everything else stays static (no full-card spinner — avoid whole-UI flicker on every keystroke).

### 5.5 Historical date picker
- Defaults to "Latest." Switching to a specific date visibly re-labels the result metadata ("Rate as of 4 Jan 1999") so it's never ambiguous whether the user is looking at live or historical data.
- Future dates are disabled/greyed in the picker, not just rejected after selection.

### 5.6 Time-series chart
- Minimal single-line chart, no gridlines clutter — axis labels only at start/end/midpoint of range.
- Hover/tap on the line shows a tooltip with exact date + rate.
- Range control as a small segmented control (7D / 30D / 90D / Custom) rather than a raw date-range form, to keep this section visually light relative to the primary conversion card.

### 5.7 Agent Activity panel
- Collapsed by default, labeled clearly (e.g. "Agent Activity" with a small violet dot indicator if tools are registered).
- Expanded view: two sub-sections —
  1. **Available tools** — static list of currently registered tool names + one-line descriptions (pulled straight from each tool's own `description` field, so the UI and the agent-facing schema never drift out of sync).
  2. **Call log** — reverse-chronological list of `{time · tool name · input summary · result/error}`, using `--color-agent` for the tool-name chip and `--color-error` for failed calls.
- Any UI element currently being updated by a live tool call gets a brief (≈600ms) `--color-agent` outline pulse, then settles back to its normal state styling — this is the main way the "agent made this change" feedback is communicated outside the log.

## 6. Motion

- Keep all transitions under 200ms; this is a fast-glance utility, not a showcase app — motion should confirm state changes, not entertain.
- Use ease-out for anything appearing (dropdown open, tooltip), ease-in for anything dismissing.
- Respect `prefers-reduced-motion`: disable the swap-rotate animation and the agent pulse animation (replace pulse with a static highlight instead).

## 7. Accessibility

- All interactive elements reachable and operable by keyboard alone (combobox included — arrow keys + type-ahead).
- Color contrast minimum 4.5:1 for body text, 3:1 for large hero numbers, checked in both light and dark tokens.
- Live region (`aria-live="polite"`) on the result block so screen readers announce updated conversion results without needing focus to move.
- Every WebMCP tool's `description` should also make sense read aloud — since it's effectively documentation for both AI agents and, indirectly, assistive-tech users inspecting the same semantic layer.

## 8. Content & Tone

- Microcopy is plain and short: "Rate as of 4 Jan 1999," not "Historical exchange rate data retrieved for the specified date." Mirror the plainness of Frankfurter's own API responses.
- Error messages are specific and actionable: "Couldn't find that currency" beats "Something went wrong."
- No exclamation points, no forced enthusiasm — this is a utility, and the tone should read as calm and precise, matching the "numbers are the hero" principle.

## 9. Do / Don't

**Do**
- Keep the primary conversion flow visible without scrolling.
- Make every visible UI change traceable to either a human action or a logged tool call.
- Use tabular numerals everywhere money or rates are displayed.

**Don't**
- Don't introduce a second accent color beyond `--color-accent` and `--color-agent` — resist the urge to color-code currencies.
- Don't block the UI with a full-screen loader for routine rate refreshes — only the result number should show loading state.
- Don't let the Agent Activity panel outweigh the primary card in size or visual weight by default; it's a transparency tool, not the main event.
