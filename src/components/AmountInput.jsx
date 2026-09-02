import { useAgentPulse } from '../hooks/useAgentPulse.js'
import { useConverter } from '../state/converterContext.js'
import './AmountInput.css'

/**
 * Borderless-until-focus numeric field with the currency code sitting inside
 * it, so amount and currency read as one unit (§5.1).
 */
export function AmountInput() {
  const { amount, from, actions, pulses, amountError } = useConverter()
  const pulsing = useAgentPulse(pulses.amount)
  const problem = amountError

  return (
    <div className="amount">
      <label className="label" htmlFor="amount-input">
        Amount
      </label>
      <div
        className={`amount__field${problem ? ' amount__field--invalid' : ''}${
          pulsing ? ' is-agent-touched' : ''
        }`}
      >
        <input
          id="amount-input"
          className="amount__input tabular"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          aria-invalid={problem ? 'true' : 'false'}
          aria-describedby={problem ? 'amount-error' : undefined}
          onChange={(event) => actions.setAmount(event.target.value)}
        />
        <span className="amount__chip" aria-hidden="true">
          {from}
        </span>
      </div>
      {problem ? (
        <p className="amount__error" id="amount-error">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4.2M8 11.2v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {problem}
        </p>
      ) : null}
    </div>
  )
}
