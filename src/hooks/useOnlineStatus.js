import { useEffect, useState } from 'react'

/**
 * Tracks connectivity so the result block can label cached figures as stale.
 *
 * `navigator.onLine` only tells us the browser has *a* network interface, not
 * that the rates service is reachable — a false positive is possible. It is
 * enough for labelling a cached figure, and a genuinely failed fetch still
 * surfaces its own error.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
