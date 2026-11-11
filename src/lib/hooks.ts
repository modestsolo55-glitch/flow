import { createContext, useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

export function useMediaQuery(q: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = matchMedia(q)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    [q],
  )
  return useSyncExternalStore(subscribe, () => matchMedia(q).matches, () => false)
}

export const useIsMd = () => useMediaQuery('(min-width: 768px)')
export const useIsLg = () => useMediaQuery('(min-width: 1024px)')

/** Re-renders every `ms` – used for clocks (not animations). */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

export const ScrollContext = createContext<RefObject<HTMLElement> | null>(null)
