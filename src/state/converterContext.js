import { createContext, useContext } from 'react'

export const ConverterContext = createContext(null)

/** Preset windows for the time-series chart, in days. */
export const RANGES = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
}

export function useConverter() {
  const context = useContext(ConverterContext)
  if (!context) throw new Error('useConverter must be used inside ConverterProvider')
  return context
}
