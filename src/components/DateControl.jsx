import { todayIso } from '../api/frankfurter.js'
import { useAgentPulse } from '../hooks/useAgentPulse.js'
import { useConverter } from '../state/converterContext.js'
import './DateControl.css'

/**
 * Latest by default; picking a day re-labels the result so it is never
 * ambiguous whether the figure on screen is live or historical (§5.5).
 *
 * The upper bound is today and the lower bound is the later of the two
 * currencies' first quote, so unanswerable dates are greyed out in the
 * picker rather than rejected after the fact.
 */
export function DateControl() {
  const { date, actions, pulses, currencies, from, to } = useConverter()
  const pulsing = useAgentPulse(pulses.date)

  const earliest = ['from', 'to']
    .map((side) => currencies.find((entry) => entry.code === (side === 'from' ? from : to)))
    .filter(Boolean)
    .map((entry) => entry.startDate)
    .sort()
    .pop()

  return (
    <div className={`date${pulsing ? ' is-agent-touched' : ''}`}>
      <span className="label" id="date-label">
        Rate date
      </span>
      <div className="date__controls" role="group" aria-labelledby="date-label">
        <button
          type="button"
          className={`date__preset${date ? '' : ' date__preset--active'}`}
          aria-pressed={!date}
          onClick={() => actions.setDate(null)}
        >
          Latest
        </button>
        <input
          className="date__input tabular"
          type="date"
          aria-label="Historical date"
          value={date ?? ''}
          min={earliest}
          max={todayIso()}
          onChange={(event) => actions.setDate(event.target.value || null)}
        />
      </div>
    </div>
  )
}
