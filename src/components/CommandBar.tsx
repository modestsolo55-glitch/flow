import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { Circle, CircleCheck, Moon, NotebookPen, Play, Plus, RotateCcw, Search, Settings, Sun } from 'lucide-react'
import { useStore } from '../lib/createStore'
import { db, ui } from '../store'
import { addNote, addTask, closeCommand, navigate, openCreate, openTask, resetDemo, selectNote, setSettingsOpen, toggleHabit } from '../actions'
import { parseQuick } from '../lib/parse'
import { fmtTime, relativeDay, todayKey } from '../lib/date'
import { toggleTheme, resolve } from '../lib/theme'
import { startTimer } from '../lib/timer'
import { toast } from '../lib/toast'
import { HABIT_ICONS } from '../lib/icons'
import { cn, norm, PRIORITY_LABELS } from '../lib/utils'
import { smooth } from '../lib/motion'
import { NAV } from './Navigation'
import { Glass } from './LiquidGlass'

interface Item {
  id: string
  group: string
  label: ReactNode
  sub?: string
  icon: ReactNode
  run: () => void
}

export function CommandBar() {
  const open = useStore(ui, (s) => s.commandOpen)
  return createPortal(<AnimatePresence>{open && <Panel key="cmd" />}</AnimatePresence>, document.body)
}

function Panel() {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  const data = useStore(db, (s) => s)

  const items = useMemo<Item[]>(() => {
    const nq = norm(q.trim())
    const nav: Item[] = NAV.map((n) => ({ id: `nav-${n.id}`, group: 'Gehe zu', label: n.label, icon: <n.icon size={17} style={{ color: n.color }} />, run: () => navigate(n.id) }))
    const actions: Item[] = [
      { id: 'a-task', group: 'Aktionen', label: 'Neue Aufgabe', icon: <Plus size={17} />, run: () => openCreate('task') },
      { id: 'a-event', group: 'Aktionen', label: 'Neuer Termin', icon: <Plus size={17} />, run: () => openCreate('event') },
      { id: 'a-note', group: 'Aktionen', label: 'Neue Notiz', icon: <NotebookPen size={17} />, run: () => (selectNote(addNote()), navigate('notes')) },
      { id: 'a-focus', group: 'Aktionen', label: 'Fokus-Session starten', icon: <Play size={17} />, run: () => (navigate('focus'), startTimer()) },
      {
        id: 'a-theme',
        group: 'Aktionen',
        label: resolve(data.settings.theme) === 'dark' ? 'Helles Erscheinungsbild' : 'Dunkles Erscheinungsbild',
        icon: resolve(data.settings.theme) === 'dark' ? <Sun size={17} /> : <Moon size={17} />,
        run: () => toggleTheme(),
      },
      { id: 'a-settings', group: 'Aktionen', label: 'Einstellungen', icon: <Settings size={17} />, run: () => setSettingsOpen(true) },
    ]
    if (!nq) return [...actions, ...nav]

    const out: Item[] = []
    const p = parseQuick(q, data.projects)
    if (p.title) {
      const proj = data.projects.find((x) => x.id === p.projectId)
      const sub = [p.due && relativeDay(p.due), p.time !== null && fmtTime(p.time), p.priority && `Priorität ${PRIORITY_LABELS[p.priority]}`, proj?.name].filter(Boolean).join(' · ')
      out.push({
        id: 'create',
        group: 'Erstellen',
        label: <>Neue Aufgabe «{p.title}»</>,
        sub: sub || undefined,
        icon: <Plus size={17} />,
        run: () => {
          const id = addTask({
            title: p.title,
            due: p.due,
            priority: p.priority,
            projectId: p.projectId,
            schedule: p.time !== null && p.due ? { date: p.due, start: p.time, duration: 60 } : null,
          })
          toast('Aufgabe hinzugefügt', 'check', { label: 'Anzeigen', run: () => openTask(id) })
        },
      })
    }
    for (const t of data.tasks.filter((t) => norm(t.title).includes(nq)).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')).slice(0, 6)) {
      const proj = data.projects.find((x) => x.id === t.projectId)
      out.push({
        id: `t-${t.id}`,
        group: 'Aufgaben',
        label: t.title,
        sub: [t.due && relativeDay(t.due), proj?.name].filter(Boolean).join(' · ') || undefined,
        icon: t.status === 'done' ? <CircleCheck size={17} className="text-ios-green" /> : <Circle size={17} style={{ color: proj?.color }} />,
        run: () => openTask(t.id),
      })
    }
    for (const n of data.notes.filter((n) => norm(n.title).includes(nq) || norm(n.body).includes(nq)).slice(0, 4))
      out.push({ id: `n-${n.id}`, group: 'Notizen', label: n.title || 'Ohne Titel', icon: <NotebookPen size={17} className="text-ios-yellow" />, run: () => (selectNote(n.id), navigate('notes')) })
    for (const h of data.habits.filter((h) => norm(h.name).includes(nq))) {
      const I = HABIT_ICONS[h.icon] ?? Circle
      const done = !!h.log[todayKey()]
      out.push({
        id: `h-${h.id}`,
        group: 'Gewohnheiten',
        label: h.name,
        sub: done ? 'Heute erledigt' : 'Heute abhaken',
        icon: <I size={17} style={{ color: h.color }} />,
        run: () => toggleHabit(h.id),
      })
    }
    out.push(...[...actions, ...nav].filter((a) => typeof a.label === 'string' && norm(a.label).includes(nq)))
    if ('beispieldaten'.includes(nq) || nq.includes('reset'))
      out.push({ id: 'reset', group: 'Aktionen', label: 'Beispieldaten wiederherstellen', icon: <RotateCcw size={17} />, run: () => (resetDemo(), toast('Beispieldaten wiederhergestellt', 'check')) })
    return out
  }, [q, data])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeCommand()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const exec = (it?: Item) => {
    if (!it) return
    closeCommand()
    it.run()
  }

  let last = ''
  return (
    <div className="fixed inset-0 z-[70] flex justify-center px-3 pt-[max(12px,env(safe-area-inset-top))] md:pt-[14vh]" style={{ pointerEvents: present ? 'auto' : 'none' }}>
      <motion.div className="absolute inset-0 bg-[var(--dim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={closeCommand} />
      <Glass
        role="dialog"
        aria-label="Suche"
        radius={26}
        interactive
        className="h-fit w-full max-w-[620px] overflow-hidden"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
        transition={smooth}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <Search size={20} className="shrink-0 text-label-2" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(items.length - 1, a + 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
              else if (e.key === 'Enter') (e.preventDefault(), exec(items[active]))
            }}
            placeholder="Suchen oder Aufgabe erstellen"
            className="min-w-0 flex-1 bg-transparent text-[20px] outline-none placeholder:text-label-3"
          />
        </div>
        <div ref={listRef} className="max-h-[min(58vh,460px)] overflow-y-auto border-t border-sep p-1.5">
          {items.map((it, i) => {
            const header = it.group !== last
            last = it.group
            const on = i === active
            return (
              <div key={it.id}>
                {header && <div className="px-3 pb-1 pt-2.5 text-[12px] font-semibold text-label-2">{it.group}</div>}
                <button
                  data-idx={i}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => exec(it)}
                  className={cn('relative flex min-h-[40px] w-full items-center gap-3 rounded-[11px] px-3 py-1.5 text-left text-[15px]', on && 'text-white')}
                >
                  {on && <span className="absolute inset-0 rounded-[11px] bg-accent" />}
                  <span className={cn('relative grid w-5 shrink-0 place-items-center', on && '[&_svg]:!text-white')}>{it.icon}</span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate">{it.label}</span>
                    {it.sub && <span className={cn('block truncate text-[12px]', on ? 'text-white/75' : 'text-label-2')}>{it.sub}</span>}
                  </span>
                </button>
              </div>
            )
          })}
          {!items.length && <div className="px-3 py-8 text-center text-[15px] text-label-2">Keine Treffer</div>}
        </div>
      </Glass>
    </div>
  )
}
