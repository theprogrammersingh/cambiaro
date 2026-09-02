import { useState } from 'react'
import { SUPPORT, SUPPORT_LABEL } from '../webmcp/adapter.js'
import { useConverter } from '../state/converterContext.js'
import { formatTime } from '../lib/format.js'
import { ToolConsole } from './ToolConsole.jsx'
import './AgentActivityPanel.css'

function summarizeInput(input) {
  const entries = Object.entries(input ?? {})
  if (entries.length === 0) return '{}'
  return entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')
}

/**
 * Transparency surface for the WebMCP layer: what is registered, and what
 * has been called. Collapsed by default so it never outweighs the primary
 * card (§5.7, §9).
 */
export function AgentActivityPanel({ tools, support }) {
  const [open, setOpen] = useState(false)
  const { activity, approvalMode, setApprovalMode, pendingApproval, resolveApproval } =
    useConverter()
  const registered = support !== SUPPORT.UNSUPPORTED

  return (
    <section className="agent">
      <button
        type="button"
        className="agent__header"
        aria-expanded={open}
        aria-controls="agent-body"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`agent__dot${registered ? ' agent__dot--live' : ''}`} aria-hidden="true" />
        <span className="agent__title">Agent Activity</span>
        <span className="agent__count meta">
          {activity.length > 0 ? `${activity.length} call${activity.length === 1 ? '' : 's'}` : ''}
        </span>
        <svg
          className={`agent__caret${open ? ' agent__caret--open' : ''}`}
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="agent__body" id="agent-body">
          <p className={`agent__support${registered ? '' : ' agent__support--off'}`}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              {registered ? (
                <path d="M3.5 8.5 6.5 11.5l6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 4.6v4.2M8 11.2v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </>
              )}
            </svg>
            {SUPPORT_LABEL[support]}
            {support === SUPPORT.UNSUPPORTED
              ? ' — the tools below still run from this page.'
              : null}
          </p>

          {pendingApproval ? (
            <div className="agent__approval" role="alertdialog" aria-label="Tool approval">
              <p className="agent__approval-text">
                Allow <strong>{pendingApproval.tool}</strong> to run?
                <span className="meta"> {summarizeInput(pendingApproval.input)}</span>
              </p>
              <div className="agent__approval-actions">
                <button type="button" className="agent__btn" onClick={() => resolveApproval(false)}>
                  Decline
                </button>
                <button
                  type="button"
                  className="agent__btn agent__btn--primary"
                  onClick={() => resolveApproval(true)}
                >
                  Allow
                </button>
              </div>
            </div>
          ) : null}

          <div className="agent__policy">
            <span className="label">Approval</span>
            <div className="agent__segmented" role="group" aria-label="Approval policy">
              {['auto', 'confirm'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`agent__segment${approvalMode === mode ? ' agent__segment--active' : ''}`}
                  aria-pressed={approvalMode === mode}
                  onClick={() => setApprovalMode(mode)}
                >
                  {mode === 'auto' ? 'Auto-approve' : 'Ask first'}
                </button>
              ))}
            </div>
          </div>

          <div className="agent__section">
            <h2 className="label">Available tools</h2>
            <ul className="agent__tools">
              {tools.map((tool) => (
                <li key={tool.name} className="agent__tool">
                  <code className="agent__chip">{tool.name}</code>
                  <span className="meta">{tool.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <ToolConsole tools={tools} />

          <div className="agent__section">
            <h2 className="label">Call log</h2>
            {activity.length === 0 ? (
              <p className="meta agent__empty">
                No tool calls yet. Run one above, or let an agent drive the page.
              </p>
            ) : (
              <ol className="agent__log">
                {activity.map((entry) => (
                  <li key={entry.id} className={`agent__entry${entry.error ? ' agent__entry--error' : ''}`}>
                    <div className="agent__entry-head">
                      <time className="meta tabular">{formatTime(entry.time)}</time>
                      <code className="agent__chip">{entry.tool}</code>
                      <span className="meta tabular">{entry.durationMs}ms</span>
                    </div>
                    <p className="agent__entry-input meta">{summarizeInput(entry.input)}</p>
                    <p className="agent__entry-result">
                      {entry.error ? (
                        <>
                          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                            <path d="M8 4.6v4.2M8 11.2v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          {entry.error}
                        </>
                      ) : (
                        entry.summary
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
