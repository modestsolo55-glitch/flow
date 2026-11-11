import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useStore } from '../lib/createStore'
import { db } from '../store'
import { autoPlanToday, freeSlots, navigate, openCreate, openEvent, openTask } from '../actions'
import { fmtTime, nowMinutes, todayKey } from '../lib/date'
import { toast } from '../lib/toast'
import { smooth } from '../lib/motion'
import { Button, SectionHeader } from './ui'

const fmtLen = (m: number) => (m < 60 ? `${m} Min.` : m % 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m / 60} Std.`)

type Entry =
  | { kind: 'event' | 'task'; key: string; id: string; title: string; start: number; end: number; color: string }
  | { kind: 'free'; key: string; start: number; end: number }

/**
 * The rest of today as a timeline: appointments, time-blocked tasks and the
 * free gaps in between – with one tap to fill the gaps with what is due.
 */
export function DayPlan() {
  const data = useStore(db, (s) => s)
  const t = todayKey()
  const now = nowMinutes()

  const { entries, unplanned } = useMemo(() => {
    const byId = new Map(data.projects.map((p) => [p.id, p]))
    const items: Entry[] = [
      ...data.events.filter((e) => e.date === t).map((e) => ({ kind: 'event' as const, key: 'e' + e.id, id: e.id, title: e.title, start: e.start, end: e.start + e.duration, color: e.color })),
      ...data.tasks
        .filter((x) => x.status !== 'done' && x.schedule?.date === t)
        .map((x) => ({
          kind: 'task' as const,
          key: 't' + x.id,
          id: x.id,
          title: x.title,
          start: x.schedule!.start,
          end: x.schedule!.start + x.schedule!.duration,
          color: (x.projectId && byId.get(x.projectId)?.color) || 'var(--accent)',
        })),
    ].filter((i) => i.end > now)
    const from = Math.max(8 * 60, Math.ceil(now / 15) * 15)
    for (const [a, b] of freeSlots(t, from, 20 * 60, 45, data)) items.push({ kind: 'free', key: `f${a}`, start: a, end: b })
    items.sort((a, b) => a.start - b.start || (a.kind === 'free' ? 1 : -1))
    const unplanned = data.tasks.filter((x) => x.status !== 'done' && !x.schedule && x.due && x.due <= t).length
    return { entries: items, unplanned }
  }, [data, t, now])

  const plan = () => {
    const r = autoPlanToday()
    if (!r.count) return toast('Heute ist keine passende Lücke mehr frei', 'info')
    toast(`${r.count} ${r.count === 1 ? 'Aufgabe' : 'Aufgaben'} eingeplant`, 'check', { label: 'Widerrufen', run: r.undo })
  }

  return (
    <section>
      <SectionHeader
        action={
          <button onClick={() => navigate('calendar')} className="text-[15px] text-accent">
            Kalender
          </button>
        }
      >
        Tagesplan
      </SectionHeader>
      <ul className="list">
        <AnimatePresence initial={false}>
          {entries.map((e) => {
            const live = e.start <= now && e.end > now
            return (
              <motion.li key={e.key} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={smooth}>
                {e.kind === 'free' ? (
                  <button
                    onClick={() => openCreate('event', { date: t, start: e.start })}
                    className="row press w-full min-h-[44px] py-1.5 text-left"
                    style={{ ['--sep-inset' as string]: '76px' }}
                  >
                    <span className="w-12 shrink-0 text-right text-[13px] tabular-nums text-label-2">{fmtTime(e.start)}</span>
                    <span className="h-6 w-[3px] shrink-0 rounded-full border border-dashed border-label-3" />
                    <span className="flex-1 text-[15px] text-label-2">Frei · {fmtLen(e.end - e.start)}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => (e.kind === 'task' ? openTask(e.id) : openEvent(e.id))}
                    className="row press w-full min-h-[56px] py-2 text-left"
                    style={{ ['--sep-inset' as string]: '76px' }}
                  >
                    <span className="w-12 shrink-0 text-right tabular-nums leading-tight">
                      <span className="block text-[15px] font-semibold">{fmtTime(e.start)}</span>
                      <span className="block text-[12px] text-label-2">{fmtTime(e.end)}</span>
                    </span>
                    <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: e.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="t-body block truncate">{e.title}</span>
                      {e.kind === 'task' && <span className="t-sub block">Aufgabe</span>}
                    </span>
                    {live && <span className="text-[13px] font-semibold text-ios-red">Jetzt</span>}
                  </button>
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
        {entries.length === 0 && <li className="row min-h-[52px] text-label-2">Für heute ist nichts mehr geplant.</li>}
      </ul>
      {unplanned > 0 && (
        <div className="mt-3 flex items-center gap-3 px-1">
          <p className="t-sub flex-1">
            {unplanned} {unplanned === 1 ? 'Aufgabe hat' : 'Aufgaben haben'} heute noch keine Zeit.
          </p>
          <Button variant="tinted" size="sm" onClick={plan}>
            <Sparkles size={15} /> Einplanen
          </Button>
        </div>
      )}
    </section>
  )
}
