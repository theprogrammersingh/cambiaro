import { useState } from 'react'
import './SwapButton.css'

/**
 * Circular control sitting between the two selectors so it reads as
 * belonging to both (§5.3). The rotation is decorative and is dropped
 * under reduced-motion by the global rule in index.css.
 */
export function SwapButton({ onSwap, from, to }) {
  const [spin, setSpin] = useState(0)

  return (
    <button
      type="button"
      className="swap"
      title={`Swap ${from} and ${to}`}
      aria-label={`Swap ${from} and ${to}`}
      onClick={() => {
        setSpin((prev) => prev + 1)
        onSwap()
      }}
    >
      <svg
        className="swap__icon"
        style={{ transform: `rotate(${spin * 180}deg)` }}
        viewBox="0 0 20 20"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <path
          d="M6.5 3.5 3.5 6.5l3 3M3.5 6.5H14M13.5 16.5l3-3-3-3M16.5 13.5H6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
