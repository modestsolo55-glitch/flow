// Dev-only test mode (open with ?e2e): drives animation frames from a MessageChannel
// loop, so automated UI tests also run while the browser window is in the background
// (background pages get almost no requestAnimationFrame and heavily throttled timers;
// MessageChannel is not throttled). Stripped from production builds.
if (import.meta.env.DEV && location.search.includes('e2e')) {
  const channel = new MessageChannel()
  let queue: [number, FrameRequestCallback][] = []
  let nextId = 0
  let last = performance.now()
  let pumping = false
  channel.port1.onmessage = () => {
    const now = performance.now()
    if (now - last >= 16) {
      last = now
      const due = queue
      queue = []
      for (const [, cb] of due) cb(now)
    }
    if (queue.length) channel.port2.postMessage(0)
    else pumping = false
  }
  window.requestAnimationFrame = (cb) => {
    queue.push([++nextId, cb])
    if (!pumping) {
      pumping = true
      channel.port2.postMessage(0)
    }
    return nextId
  }
  window.cancelAnimationFrame = (id) => {
    queue = queue.filter(([i]) => i !== id)
  }
  /** unthrottled sleep for test scripts */
  ;(window as unknown as { e2eSleep: (ms: number) => Promise<void> }).e2eSleep = (ms) =>
    new Promise((resolve) => {
      const end = performance.now() + ms
      const c = new MessageChannel()
      c.port1.onmessage = () => (performance.now() >= end ? resolve() : c.port2.postMessage(0))
      c.port2.postMessage(0)
    })

  // Small helper kit for scripted UI checks in the dev browser (window.T).
  const sleep = (window as unknown as { e2eSleep: (ms: number) => Promise<void> }).e2eSleep
  const all = (s: string) => [...document.querySelectorAll<HTMLElement>(s)]
  const T = {
    w: sleep,
    async until<V>(fn: () => V, ms = 4000): Promise<V | false> {
      const end = performance.now() + ms
      while (performance.now() < end) {
        try {
          const v = fn()
          if (v) return v
        } catch {
          /* not there yet */
        }
        await sleep(40)
      }
      return false
    },
    all,
    find: (s: string, t: string) => all(s).find((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim().includes(t)),
    exact: (s: string, t: string) => all(s).find((e) => (e.textContent ?? '').trim() === t),
    label: (l: string) => document.querySelector<HTMLElement>(`[aria-label="${l}"]`),
    type(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    key(el: EventTarget, key: string, extra: KeyboardEventInit = {}) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }))
    },
    dialog: (l?: string) => document.querySelector<HTMLElement>(l ? `[role=dialog][aria-label="${l}"]` : '[role=dialog]'),
    h1: () => document.querySelector('h1')?.textContent ?? '',
    async nav(n: number, title: string) {
      this.key(document.body, String(n))
      return this.until(() => this.h1().includes(title))
    },
    results: [] as string[],
    ok(name: string, cond: unknown, info?: unknown) {
      this.results.push((cond ? '✓ ' : '✗ ') + name + (cond ? '' : '  → ' + JSON.stringify(info ?? '')))
      return !!cond
    },
  }
  ;(window as unknown as { T: typeof T }).T = T
}
export {}
