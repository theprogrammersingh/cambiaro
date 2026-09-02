import { useEffect, useState } from 'react'

const PULSE_MS = 620

/**
 * Turns a monotonically increasing pulse token into a short-lived `true`,
 * so a control can flash violet the instant a tool changes it (§5.7).
 *
 * The animation is restarted by dropping the class for one frame rather
 * than remounting, which would steal focus from an input mid-edit.
 */
export function useAgentPulse(token) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!token) return undefined
    setActive(false)
    const frame = requestAnimationFrame(() => setActive(true))
    const timer = setTimeout(() => setActive(false), PULSE_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [token])

  return active
}
