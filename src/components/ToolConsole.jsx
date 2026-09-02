import { useState } from 'react'
import './ToolConsole.css'

/** Prefill each tool's form with a plausible call, so trying one is one click. */
const EXAMPLES = {
  convertCurrency: { amount: 200, from: 'EUR', to: 'INR' },
  swapCurrencies: {},
  setBaseCurrency: { currency: 'GBP' },
  setQuoteCurrency: { currency: 'JPY' },
  listCurrencies: { query: 'rupee' },
  getHistoricalRate: { from: 'EUR', to: 'USD', date: '1999-01-04' },
  getRateTimeSeries: { from: 'EUR', to: 'USD', start: '2026-06-01', end: '2026-09-01' },
}

/**
 * Lets a person invoke the tools by hand, exactly as an agent would.
 *
 * This is what keeps the WebMCP layer demonstrable in a browser that has
 * no agent attached: same descriptors, same validation, same call log.
 */
export function ToolConsole({ tools }) {
  const [selected, setSelected] = useState(tools[0]?.name ?? '')
  const [draft, setDraft] = useState(() => JSON.stringify(EXAMPLES[tools[0]?.name] ?? {}, null, 2))
  const [response, setResponse] = useState(null)
  const [busy, setBusy] = useState(false)

  const tool = tools.find((entry) => entry.name === selected)

  function pick(name) {
    setSelected(name)
    setDraft(JSON.stringify(EXAMPLES[name] ?? {}, null, 2))
    setResponse(null)
  }

  async function run() {
    if (!tool) return
    let input
    try {
      input = draft.trim() === '' ? {} : JSON.parse(draft)
    } catch {
      setResponse({ isError: true, text: "That isn't valid JSON." })
      return
    }
    setBusy(true)
    try {
      const result = await tool.execute(input)
      setResponse({
        isError: Boolean(result.isError),
        text: result.content?.[0]?.text ?? '',
        structured: result.structuredContent,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="console agent__section">
      <h2 className="label">Try a tool</h2>

      <div className="console__tabs" role="group" aria-label="Choose a tool">
        {tools.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className={`console__tab${entry.name === selected ? ' console__tab--active' : ''}`}
            aria-pressed={entry.name === selected}
            onClick={() => pick(entry.name)}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <label className="visually-hidden" htmlFor="console-input">
        Tool input as JSON
      </label>
      <textarea
        id="console-input"
        className="console__input"
        spellCheck="false"
        rows={Math.min(8, Math.max(3, draft.split('\n').length))}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />

      <button type="button" className="agent__btn agent__btn--primary console__run" onClick={run} disabled={busy}>
        {busy ? 'Running…' : `Run ${selected}`}
      </button>

      {response ? (
        <output className={`console__output${response.isError ? ' console__output--error' : ''}`}>
          <p className="console__output-text">{response.text}</p>
          {response.structured ? (
            <details className="console__details">
              <summary className="meta">Structured result</summary>
              <pre className="console__pre">{JSON.stringify(response.structured, null, 2)}</pre>
            </details>
          ) : null}
        </output>
      ) : null}
    </div>
  )
}
