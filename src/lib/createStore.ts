import { useSyncExternalStore } from 'react'

/**
 * Tiny external store. Components subscribe with a selector and only
 * re-render when the selected slice changes (reference equality).
 */
export interface Store<T> {
  get: () => T
  set: (fn: (s: T) => T) => void
  subscribe: (l: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set: (fn) => {
      const next = fn(state)
      if (next === state) return
      state = next
      listeners.forEach((l) => l())
    },
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
  const get = () => selector(store.get())
  return useSyncExternalStore(store.subscribe, get, get)
}
