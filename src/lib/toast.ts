import { createStore } from './createStore'

export interface Toast {
  id: number
  text: string
  icon: 'check' | 'trash' | 'info'
  action?: { label: string; run: () => void }
}

export const toasts = createStore<Toast[]>([])
let n = 0

export function dismissToast(id: number) {
  toasts.set((t) => (t.some((x) => x.id === id) ? t.filter((x) => x.id !== id) : t))
}

export function toast(text: string, icon: Toast['icon'] = 'info', action?: Toast['action']) {
  const id = ++n
  toasts.set((t) => [...t.slice(-2), { id, text, icon, action }])
  window.setTimeout(() => dismissToast(id), action ? 5000 : 3200)
}
