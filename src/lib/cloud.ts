import type { AppData } from '../types'
import { db as store } from '../store'
import { closeWelcome } from '../actions'
import { createStore } from './createStore'
import { toast } from './toast'

/*
 * Optional cloud storage.
 *
 * Flow always keeps a local copy (works offline, opens instantly). When it
 * runs as a shared claude.ai page and the visitor is signed in, their data is
 * also kept in their own private space (`data/users/<their id>/…`) – nobody
 * else can read it, not even whoever shared the link – and stays in sync
 * across their devices.
 *
 * Each section is its own document so a change only rewrites what changed
 * and every document stays well below the 256 KiB limit.
 */

type ClaudeHost = { use: (name: string) => Promise<any> }
const host = () => (window as Window & { claude?: ClaudeHost }).claude

export type SyncState = 'local' | 'connecting' | 'cloud' | 'error'
export const syncState = createStore<SyncState>('local')

const SECTIONS = ['tasks', 'events', 'notes', 'habits', 'meta'] as const
type Section = (typeof SECTIONS)[number]

/** the values whose identity tells us whether a section changed */
const parts = (d: AppData, s: Section): unknown[] => (s === 'meta' ? [d.projects, d.settings, d.focusLog] : [d[s]])
const body = (d: AppData, s: Section) =>
  s === 'meta' ? { projects: d.projects, settings: d.settings, focusLog: d.focusLog } : { items: d[s] }

function merge(d: AppData, s: Section, b: Record<string, unknown>): AppData {
  if (s === 'meta') {
    return {
      ...d,
      projects: Array.isArray(b.projects) ? (b.projects as AppData['projects']) : d.projects,
      settings: b.settings && typeof b.settings === 'object' ? { ...d.settings, ...(b.settings as AppData['settings']) } : d.settings,
      focusLog: b.focusLog && typeof b.focusLog === 'object' ? (b.focusLog as AppData['focusLog']) : d.focusLog,
    }
  }
  return Array.isArray(b.items) ? { ...d, [s]: b.items } : d
}

const same = (a: unknown[] | undefined, b: unknown[]) => !!a && a.length === b.length && a.every((x, i) => x === b[i])
const rid = () => Math.random().toString(36).slice(2, 10)

let started = false

export async function initCloud() {
  const c = host()
  if (started || !c?.use) return
  started = true
  syncState.set(() => 'connecting')

  let cdb: any = null
  let id: string | null = null
  try {
    const [d, u] = await Promise.all([c.use('db'), c.use('user')])
    cdb = d
    id = u ? await u.id() : null
  } catch {
    /* treated as unavailable below */
  }
  if (!cdb || !id) return void syncState.set(() => 'local')

  const ref = (s: Section) => cdb.doc(`data/users/${id}/flow-${s}`)
  const synced: Partial<Record<Section, unknown[]>> = {}
  /** revisions this device wrote – their echoes are never applied back */
  const mine = new Set<string>()
  /** newest local write per section; anything older from the server is stale */
  const lastWrite: Partial<Record<Section, number>> = {}
  let applying = false

  const apply = (s: Section, b: Record<string, unknown>) => {
    applying = true
    store.set((d) => merge(d, s, b))
    applying = false
    synced[s] = parts(store.get(), s)
  }

  // 1) Load what is stored for this person (if anything).
  try {
    const snaps = await Promise.all(SECTIONS.map((s) => ref(s).get()))
    const remote = snaps.some((x: any) => x.exists)
    if (remote) {
      SECTIONS.forEach((s, i) => snaps[i].exists && apply(s, snaps[i].data()))
      closeWelcome() // returning on another device: skip the first-launch screen
    }
  } catch {
    return void syncState.set(() => 'local')
  }

  // 2) Write changed sections, one write per document at a time.
  let busy = false
  let again = false
  let warned = false
  let wroteOnce = false
  let stopped = false
  const flush = async () => {
    if (stopped) return
    if (busy) return void (again = true)
    busy = true
    try {
      do {
        again = false
        const d = store.get()
        for (const s of SECTIONS) {
          const p = parts(d, s)
          if (same(synced[s], p)) continue
          const rev = rid()
          const at = Date.now()
          mine.add(rev)
          lastWrite[s] = at
          await ref(s).set({ ...body(d, s), rev, updatedAt: at })
          synced[s] = p
          wroteOnce = true
        }
      } while (again)
      syncState.set(() => 'cloud')
    } catch (e: any) {
      // People who may only view cannot keep data in their account: Flow quietly stays local for them.
      if (e?.code === 'invalid_argument' && !wroteOnce) {
        syncState.set(() => 'local')
        stopped = true
        return
      }
      syncState.set(() => 'error')
      if (!warned) {
        warned = true
        toast(e?.code === 'quota_exceeded' || e?.code === 'invalid_argument' ? 'Online-Speicher voll – bitte ein Backup sichern' : 'Speichern im Konto gerade nicht möglich – lokal gesichert', 'info')
      }
    } finally {
      busy = false
    }
  }
  let t: number | undefined
  store.subscribe(() => {
    if (applying) return
    window.clearTimeout(t)
    t = window.setTimeout(flush, 700)
  })
  await flush() // uploads a first copy for new people
  if (stopped) return

  // 3) Live: changes made on another device appear here.
  for (const s of SECTIONS) {
    ref(s).onSnapshot(
      (snap: any) => {
        if (!snap.exists || snap.metadata?.hasPendingWrites) return
        const b = snap.data() as Record<string, unknown>
        if (typeof b.rev === 'string' && mine.has(b.rev)) return
        if (typeof b.updatedAt === 'number' && b.updatedAt <= (lastWrite[s] ?? 0)) return
        // not while a local change is still waiting to be written
        if (!same(synced[s], parts(store.get(), s))) return
        apply(s, b)
      },
      () => syncState.set(() => 'error'),
    )
  }
}

