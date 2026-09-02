import { formatAmount, formatDate, formatRate } from '../lib/format.js'
import { useAgentPulse } from '../hooks/useAgentPulse.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { useConverter } from '../state/converterContext.js'
import './ResultBlock.css'

/**
 * The hero number plus its unit rate and effective date (§5.4).
 *
 * Only the number carries the loading state — the surrounding metadata
 * stays put, so a keystroke never flickers the whole card (§9).
 */
export function ResultBlock() {
  const { outcome, status, error, from, to, date, pulses } = useConverter()
  const pulsing = useAgentPulse(pulses.result)
  const online = useOnlineStatus()
  const isHistorical = Boolean(date)
  // Offline but still showing a figure means it came from the cached response.
  const showingCached = !online && Boolean(outcome)

  return (
    <div className={`result${pulsing ? ' is-agent-touched' : ''}`}>
      <span className="label">Converted</span>

      <div className="result__figure" aria-live="polite" aria-atomic="true">
        {status === 'loading' && !outcome ? (
          <span className="result__skeleton" aria-label="Converting" />
        ) : status === 'error' ? (
          <span className="result__hero result__hero--muted tabular">—</span>
        ) : status === 'empty' ? (
          <span className="result__hero result__hero--muted tabular">—</span>
        ) : (
          <span className={`result__hero tabular${status === 'loading' ? ' is-stale' : ''}`}>
            {formatAmount(outcome?.result, to)}
          </span>
        )}
        <span className="result__currency">{to}</span>
      </div>

      {status === 'error' ? (
        <p className="result__message result__message--error">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4.2M8 11.2v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : status === 'empty' ? (
        <p className="result__message result__message--warning">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M8 2.5 15 13.5H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6.8v3M8 11.6v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          No rate published for that date.
        </p>
      ) : outcome ? (
        <p className={`result__message${showingCached ? ' result__message--warning' : ' meta'}`}>
          {showingCached ? (
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M8 2.5 15 13.5H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 6.8v3M8 11.6v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : null}
          <span className="tabular">
            1 {from} = {formatRate(outcome.rate)} {to}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {showingCached ? 'Last known rate, ' : isHistorical ? 'Rate as of ' : ''}
            {formatDate(outcome.date)}
          </span>
        </p>
      ) : (
        <p className="result__message meta">&nbsp;</p>
      )}
    </div>
  )
}
