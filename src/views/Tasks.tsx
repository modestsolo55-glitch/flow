import { memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Ellipsis, Plus } from 'lucide-react'
import type { Project, Status, Task } from '../types'
import { useStore } from '../lib/createStore'
import { db } from '../store'
import { addTask, deleteTasks, openCreate, openTask, restoreTasks, toggleTask } from '../actions'
import { toast } from '../lib/toast'
import { diffDays, relativeDay, todayKey } from '../lib/date'
import { parseQuick } from '../lib/parse'
import { ScrollContext } from '../lib/hooks'
import { dragStore, startDrag, wasJustDropped, type DragInfo } from '../lib/dnd'
import { smooth, snappy } from '../lib/motion'
import { cn } from '../lib/utils'
import { Glass, GlassButton, Menu, PageHeader, Segmented } from '../components/ui'
import { TaskRow } from '../components/TaskRow'
import { Checkbox } from '../components/Checkbox'
import { celebrate } from '../components/Effects'

type Mode = 'list' | 'board'
const MODE_KEY = 'flow:tasks:mode'
const DONE_KEY = 'flow:tasks:showDone'
const sortTasks = (a: Task, b: Task) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || b.priority - a.priority || a.order - b.order

export default function TasksView() {
  const tasks = useStore(db, (s) => s.tasks)
  const projects = useStore(db, (s) => s.projects)
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as Mode) || 'list'
    } catch {
      return 'list'
    }
  })
  const [project, setProject] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const [showDone, setShowDoneState] = useState(() => {
    try {
      return localStorage.getItem(DONE_KEY) === '1'
    } catch {
      return false
    }
  })
  const setShowDone = (v: boolean) => {
    setShowDoneState(v)
    if (v) setReveal((n) => n + 1)
    try {
      localStorage.setItem(DONE_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const filtered = useMemo(() => (project ? tasks.filter((t) => t.projectId === project) : tasks), [tasks, project])
  const open = filtered.filter((t) => t.status !== 'done').length
  const doneTasks = filtered.filter((t) => t.status === 'done')
  const clearDone = () => {
    const removed = deleteTasks(doneTasks.map((t) => t.id))
    if (removed.length) toast(`${removed.length} erledigte ${removed.length === 1 ? 'Aufgabe' : 'Aufgaben'} gelöscht`, 'trash', { label: 'Widerrufen', run: () => restoreTasks(removed) })
  }

  return (
    <div>
      <PageHeader
        title={project ? byId.get(project)?.name ?? 'Aufgaben' : 'Aufgaben'}
        subtitle={`${open} offen`}
        actions={
          <>
            <Segmented
              value={mode}
              onChange={setMode}
              layoutId="tasks-mode"
              options={[
                { value: 'list', label: 'Liste' },
                { value: 'board', label: 'Board' },
              ]}
            />
            <Menu
              label="Optionen"
              showCheck={false}
              onSelect={(a) => (a === 'done' ? setShowDone(!showDone) : clearDone())}
              items={[
                { value: 'done', label: showDone ? 'Erledigte ausblenden' : 'Erledigte einblenden' },
                ...(doneTasks.length ? [{ value: 'clear', label: `Erledigte löschen (${doneTasks.length})`, destructive: true }] : []),
              ]}
              className="relative grid h-10 w-10 place-items-center rounded-full"
            >
              <Glass radius="full" variant="clear" interactive className="!absolute inset-0" />
              <Ellipsis size={20} className="relative" />
            </Menu>
            <GlassButton label="Neue Aufgabe" onClick={() => openCreate('task', { projectId: project })}>
              <Plus size={20} strokeWidth={2.3} />
            </GlassButton>
          </>
        }
      />

      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Filter active={project === null} onClick={() => setProject(null)}>
          Alle
        </Filter>
        {projects.map((p) => (
          <Filter key={p.id} active={project === p.id} onClick={() => setProject(p.id)}>
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </Filter>
        ))}
      </div>

      {/* switching list/board replaces the view at once and fades the new one in (never waits on an exit) */}
      <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
          {mode === 'list' ? (
            <>
              <QuickEntry projects={projects} defaultProject={project} />
              <DoneBar count={doneTasks.length} shown={showDone} onToggle={() => setShowDone(!showDone)} onClear={clearDone} />
              <TaskList tasks={filtered} byId={byId} showDone={showDone} hideProject={!!project} reveal={reveal} />
            </>
          ) : (
            <Board tasks={filtered} byId={byId} showDone={showDone} onShowDone={() => setShowDone(true)} />
          )}
        </motion.div>
    </div>
  )
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium', active ? 'text-white' : 'bg-fill text-label')}
    >
      {active && <motion.span layoutId="filter-sel" className="absolute inset-0 rounded-full bg-accent" transition={snappy} style={{ borderRadius: 999 }} />}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  )
}

/** Reminders-style entry row: type and hit return. Understands "morgen 14:00 !1 #arbeit". */
function QuickEntry({ projects, defaultProject }: { projects: Project[]; defaultProject: string | null }) {
  const [value, setValue] = useState('')
  const submit = () => {
    const p = parseQuick(value, projects)
    if (!p.title) return
    addTask({
      title: p.title,
      due: p.due,
      priority: p.priority,
      projectId: p.projectId ?? defaultProject,
      schedule: p.time !== null && p.due ? { date: p.due, start: p.time, duration: 60 } : null,
    })
    setValue('')
  }
  return (
    <div className="list mb-6">
      <label className="row min-h-[52px]">
        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-accent text-white">
          <Plus size={15} strokeWidth={3} />
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Neue Aufgabe"
          className="t-body h-[52px] min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-3"
        />
        {value && <span className="t-sub hidden sm:inline">↵ zum Hinzufügen</span>}
      </label>
    </div>
  )
}

/* ───────── Virtualized, inset-grouped list ───────── */

type Pos = 'only' | 'first' | 'mid' | 'last'
type Row = { type: 'header'; key: string; label: string; count: number; tone?: 'red' } | { type: 'task'; key: string; task: Task; pos: Pos }

function buildRows(tasks: Task[], showDone: boolean): Row[] {
  const t = todayKey()
  const groups: { key: string; label: string; tone?: 'red'; items: Task[] }[] = [
    { key: 'overdue', label: 'Überfällig', tone: 'red', items: [] },
    { key: 'today', label: 'Heute', items: [] },
    { key: 'tomorrow', label: 'Morgen', items: [] },
    { key: 'week', label: 'Nächste 7 Tage', items: [] },
    { key: 'later', label: 'Später', items: [] },
    { key: 'none', label: 'Ohne Datum', items: [] },
    { key: 'done', label: 'Erledigt', items: [] },
  ]
  for (const task of tasks) {
    if (task.status === 'done') {
      if (showDone) groups[6].items.push(task)
      continue
    }
    if (!task.due) groups[5].items.push(task)
    else {
      const d = diffDays(task.due, t)
      groups[d < 0 ? 0 : d === 0 ? 1 : d === 1 ? 2 : d <= 7 ? 3 : 4].items.push(task)
    }
  }
  const rows: Row[] = []
  for (const g of groups) {
    if (!g.items.length) continue
    rows.push({ type: 'header', key: `h-${g.key}`, label: g.label, count: g.items.length, tone: g.tone })
    const list = g.key === 'done' ? g.items.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)) : g.items.sort(sortTasks)
    list.forEach((task, i) => {
      const pos: Pos = list.length === 1 ? 'only' : i === 0 ? 'first' : i === list.length - 1 ? 'last' : 'mid'
      rows.push({ type: 'task', key: task.id, task, pos })
    })
  }
  return rows
}

function TaskList({ tasks, byId, showDone, hideProject, reveal }: { tasks: Task[]; byId: Map<string, Project>; showDone: boolean; hideProject: boolean; reveal: number }) {
  const scrollRef = useContext(ScrollContext)
  const listRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => buildRows(tasks, showDone), [tasks, showDone])
  const [margin, setMargin] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const l = listRef.current
      const s = scrollRef?.current
      if (l && s) setMargin(l.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop)
    }
    measure()
    const t = window.setTimeout(measure, 350)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [scrollRef])

  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize: (i) => (rows[i].type === 'header' ? 48 : 60),
    overscan: 10,
    scrollMargin: margin,
    getItemKey: (i) => rows[i].key,
  })

  // "Einblenden" scrolls to the completed section so the change is visible
  useEffect(() => {
    if (!reveal) return
    const i = rows.findIndex((r) => r.key === 'h-done')
    if (i >= 0) requestAnimationFrame(() => v.scrollToIndex(i, { align: 'start', behavior: 'smooth' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal])

  if (!rows.length) return <div className="list row min-h-[56px] justify-center text-label-2">Keine offenen Aufgaben</div>

  return (
    <div ref={listRef} className="relative" style={{ height: v.getTotalSize() }}>
      {v.getVirtualItems().map((vi) => {
        const row = rows[vi.index]
        return (
          <VRow key={vi.key as string} index={vi.index} start={vi.start - margin} measure={v.measureElement}>
            {row.type === 'header' ? (
              <div className={cn('flex items-baseline gap-2 px-1 pb-2 pt-5', vi.index === 0 && 'pt-0')}>
                <span className={cn('t-section', row.tone === 'red' && 'text-ios-red')}>{row.label}</span>
                <span className="text-[15px] tabular-nums text-label-2">{row.count}</span>
              </div>
            ) : (
              <div
                className={cn(
                  'relative overflow-hidden bg-surface',
                  (row.pos === 'first' || row.pos === 'only') && 'rounded-t-[14px]',
                  (row.pos === 'last' || row.pos === 'only') && 'rounded-b-[14px]',
                )}
              >
                {(row.pos === 'mid' || row.pos === 'last') && <span className="absolute left-[50px] right-0 top-0 z-[1] h-px origin-top scale-y-50 bg-sep" />}
                <TaskRow task={row.task} project={row.task.projectId ? byId.get(row.task.projectId) : undefined} showProject={!hideProject} />
              </div>
            )}
          </VRow>
        )
      })}
    </div>
  )
}

/** Rows move with an animated translateY, so the list closes gaps smoothly. */
const VRow = memo(function VRow({ index, start, measure, children }: { index: number; start: number; measure: (el: Element | null) => void; children: ReactNode }) {
  return (
    <motion.div data-index={index} ref={measure} className="absolute left-0 right-0 top-0" initial={{ y: start, opacity: 0 }} animate={{ y: start, opacity: 1 }} transition={{ y: smooth, opacity: { duration: 0.2 } }}>
      {children}
    </motion.div>
  )
})

/* ───────── Board ───────── */

const COLS: { id: Status; label: string }[] = [
  { id: 'todo', label: 'Offen' },
  { id: 'doing', label: 'In Arbeit' },
  { id: 'done', label: 'Erledigt' },
]

function Board({ tasks, byId, showDone, onShowDone }: { tasks: Task[]; byId: Map<string, Project>; showDone: boolean; onShowDone: () => void }) {
  const drag = useStore(dragStore, (s) => s)
  const byCol = useMemo(() => {
    const m: Record<Status, Task[]> = { todo: [], doing: [], done: [] }
    for (const t of tasks) m[t.status].push(t)
    for (const k of Object.keys(m) as Status[]) m[k].sort((a, b) => a.order - b.order)
    return m
  }, [tasks])
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
      {COLS.map((c) => (
        <Column key={c.id} col={c} tasks={byCol[c.id]} drag={drag} byId={byId} collapsed={c.id === 'done' && !showDone} onExpand={onShowDone} />
      ))}
    </div>
  )
}

function Column({ col, tasks, drag, byId, collapsed, onExpand }: { col: (typeof COLS)[number]; tasks: Task[]; drag: DragInfo | null; byId: Map<string, Project>; collapsed: boolean; onExpand: () => void }) {
  const all = drag ? tasks.filter((t) => t.id !== drag.id) : tasks
  // collapsed: cards hidden, but the column still accepts drops
  const visible = collapsed ? [] : all
  const ph = drag?.over?.zone === 'kanban' && drag.over.col === col.id ? drag.over.index : -1
  const nodes: ReactNode[] = []
  visible.forEach((t, i) => {
    if (i === ph) nodes.push(<Slot key="ph" height={drag!.height} />)
    nodes.push(<Card key={t.id} task={t} project={t.projectId ? byId.get(t.projectId) : undefined} />)
  })
  if (ph >= visible.length) nodes.push(<Slot key="ph" height={drag!.height} />)

  return (
    <div data-drop="kanban" data-col={col.id} className="flex min-h-[420px] w-[82vw] max-w-[340px] shrink-0 snap-center flex-col rounded-[20px] bg-fill-2 p-2 md:w-auto md:max-w-none">
      <div className="flex items-baseline gap-2 px-2 pb-2.5 pt-1.5">
        <span className="text-[15px] font-semibold">{col.label}</span>
        <span className="text-[15px] tabular-nums text-label-2">{all.length}</span>
      </div>
      <div data-list className="relative flex flex-1 flex-col gap-2">
        {nodes}
        {collapsed && all.length > 0 && ph < 0 && (
          <button onClick={onExpand} className="press relative flex h-11 items-center justify-center rounded-[12px] text-[15px] text-accent">
            {all.length} {all.length === 1 ? 'erledigte Aufgabe' : 'erledigte Aufgaben'} einblenden
          </button>
        )}
      </div>
      {col.id === 'todo' && (
        <button onClick={() => openCreate('task')} className="press relative mt-2 flex h-10 items-center gap-2 rounded-[12px] px-2.5 text-[15px] text-accent">
          <Plus size={18} /> Aufgabe
        </button>
      )}
    </div>
  )
}

function Slot({ height }: { height: number }) {
  return <motion.div data-placeholder layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={smooth} className="shrink-0 rounded-[12px] bg-fill" style={{ height }} />
}

/** Not memoized on purpose: `layout` must re-measure whenever the column changes. */
function Card({ task, project }: { task: Task; project?: Project }) {
  return (
    <motion.div
      layout
      data-card={task.id}
      initial={wasJustDropped(task.id) ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={smooth}
      onPointerDown={(e) => startDrag(e, { id: task.id, type: 'task', title: task.title, color: project?.color ?? '#007aff' })}
      onClick={() => openTask(task.id)}
      className="draggable surface press relative cursor-grab rounded-[12px] p-3 active:cursor-grabbing"
    >
      <CardBody task={task} project={project} />
    </motion.div>
  )
}

const CardBody = memo(function CardBody({ task, project }: { task: Task; project?: Project }) {
  const ref = useRef<HTMLSpanElement>(null)
  const done = task.status === 'done'
  const overdue = !done && task.due && diffDays(task.due, todayKey()) < 0
  return (
    <div className="flex items-start gap-2.5">
      <span ref={ref} className="mt-[1px]">
        <Checkbox checked={done} size={20} color={project?.color} onToggle={() => (!done && celebrate(ref.current, project?.color), toggleTask(task.id))} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[15px] leading-5', done && 'text-label-2 line-through')}>
          {task.priority > 0 && <span className="mr-1 font-semibold text-accent">{'!'.repeat(task.priority)}</span>}
          {task.title}
        </div>
        {(project || task.due) && (
          <div className="t-sub mt-1 flex items-center gap-1.5">
            {project && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />}
            {task.due && <span className={cn(overdue && 'text-ios-red')}>{relativeDay(task.due)}</span>}
            {project && <span className="truncate">{task.due ? '· ' : ''}{project.name}</span>}
          </div>
        )}
      </div>
    </div>
  )
})

/** Reminders-style: how many are done, with show/hide and clear right where you look. */
function DoneBar({ count, shown, onToggle, onClear }: { count: number; shown: boolean; onToggle: () => void; onClear: () => void }) {
  if (!count) return null
  return (
    <div className="-mt-3 mb-5 flex items-center gap-1 px-1 text-[15px]">
      <span className="text-label-2">
        {count} erledigt
      </span>
      <span className="text-label-3">·</span>
      <button onClick={onToggle} className="rounded-md px-1 text-accent">
        {shown ? 'Ausblenden' : 'Einblenden'}
      </button>
      <span className="text-label-3">·</span>
      <button onClick={onClear} className="rounded-md px-1 text-accent">
        Löschen
      </button>
    </div>
  )
}
