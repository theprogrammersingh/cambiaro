import { AmountInput } from './AmountInput.jsx'
import { CurrencyCombobox } from './CurrencyCombobox.jsx'
import { ResultBlock } from './ResultBlock.jsx'
import { SwapButton } from './SwapButton.jsx'
import { useConverter } from '../state/converterContext.js'
import './ConverterCard.css'

/**
 * The primary card: amount -> from/to with swap -> result -> metadata.
 * Everything above the fold, nothing competing with it (§2).
 */
export function ConverterCard() {
  const { from, to, actions, pulses, currenciesError } = useConverter()

  return (
    <section className="card" aria-label="Currency converter">
      {currenciesError ? (
        <p className="card__notice" role="alert">
          {currenciesError}
        </p>
      ) : null}

      <AmountInput />

      <div className="card__pair">
        <CurrencyCombobox
          id="currency-from"
          label="From"
          value={from}
          pulseToken={pulses.from}
          onChange={(code) => actions.setBaseCurrency(code)}
        />
        <div className="card__swap">
          <SwapButton from={from} to={to} onSwap={() => actions.swapCurrencies()} />
        </div>
        <CurrencyCombobox
          id="currency-to"
          label="To"
          value={to}
          pulseToken={pulses.to}
          onChange={(code) => actions.setQuoteCurrency(code)}
        />
      </div>

      <ResultBlock />
    </section>
  )
}
