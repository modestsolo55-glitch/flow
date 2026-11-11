import { memo, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Ellipsis, Search, SquarePen, X } from 'lucide-react'
import type { Note } from '../types'
import { useStore } from '../lib/createStore'
import { db, ui } from '../store'
import { addNote, deleteNote, restoreNote, selectNote, togglePin, updateNote } from '../actions'
import { useIsMd } from '../lib/hooks'
import { smooth } from '../lib/motion'
import { toast } from '../lib/toast'
import { cn, norm } from '../lib/utils'
import { Glass, GlassButton, Menu, PageHeader } from '../components/ui'

function highlight(text: string, q: string): ReactNode {
  if (!q) return text
  const i = norm(text).indexOf(norm(q))
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function preview(body: string, q: string) {
  const flat = body.replace(/\s+/g, ' ').trim()
  if (!q) return flat.slice(0, 90)
  const i = norm(flat).indexOf(norm(q))
  if (i < 0) return flat.slice(0, 90)
  const s = Math.max(0, i - 24)
  return (s > 0 ? '…' : '') + flat.slice(s, s + 100)
}

const shortDate = (ts: number) => {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
  if (now.getTime() - d.getTime() < 6 * 86400e3) return d.toLocaleDateString('de-CH', { weekday: 'long' })
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
const longDate = (ts: number) =>
  new Date(ts).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }) + ' um ' + new Date(ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })

export default function NotesView() {
  const notes = useStore(db, (s) => s.notes)
  const selectedId = useStore(ui, (s) => s.noteId)
  const [q, setQ] = useState('')
  const isMd = useIsMd()

  const { pinned, rest } = useMemo(() => {
    const nq = norm(q.trim())
    const list = notes.filter((n) => !nq || norm(n.title).includes(nq) || norm(n.body).includes(nq)).sort((a, b) => b.updatedAt - a.updatedAt)
    return { pinned: list.filter((n) => n.pinned), rest: list.filter((n) => !n.pinned) }
  }, [notes, q])

  const selected = notes.find((n) => n.id === selectedId) ?? (isMd ? pinned[0] ?? rest[0] : undefined)
  const create = () => {
    setQ('')
    selectNote(addNote())
  }

  const list = (
    <div className="flex min-h-0 flex-col md:h-[calc(100dvh-200px)] md:min-h-[460px]">
      <label className="relative mb-4 block">
        <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label-2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" className="field pl-8 pr-8" />
        {q && (
          <button onClick={() => setQ('')} aria-label="Suche löschen" className="absolute right-2 top-1/2 grid h-[18px] w-[18px] -translate-y-1/2 place-items-center rounded-full bg-label-3 text-[var(--surface)]">
            <X size={11} strokeWidth={3} />
          </button>
        )}
      </label>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2">
        {pinned.length > 0 && <NoteGroup title="Angeheftet" notes={pinned} q={q} activeId={selected?.id} />}
        {rest.length > 0 && <NoteGroup title={pinned.length ? 'Notizen' : undefined} notes={rest} q={q} activeId={selected?.id} />}
        {!pinned.length && !rest.length && <p className="px-1 py-8 text-center text-[15px] text-label-2">{q ? `Keine Treffer für «${q}»` : 'Keine Notizen'}</p>}
      </div>
    </div>
  )

  return (
    <div>
      {(isMd || !selected) && (
        <PageHeader
          title="Notizen"
          subtitle={`${notes.length} ${notes.length === 1 ? 'Notiz' : 'Notizen'}`}
          actions={
            <GlassButton label="Neue Notiz" onClick={create}>
              <SquarePen size={19} />
            </GlassButton>
          }
        />
      )}
      {isMd ? (
        <div className="grid gap-5 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
          {list}
          {selected ? <Editor key={selected.id} note={selected} /> : <Empty key="empty" />}
        </div>
      ) : (
          selected ? (
            <motion.div key="ed" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={smooth}>
              <Editor note={selected} onBack={() => selectNote(null)} />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={smooth}>
              {list}
            </motion.div>
          )
      )}
    </div>
  )
}

function NoteGroup({ title, notes, q, activeId }: { title?: string; notes: Note[]; q: string; activeId?: string }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-1 text-[15px] font-semibold">{title}</h2>}
      <ul className="list">
        <AnimatePresence initial={false}>
          {notes.map((n) => (
            <motion.li key={n.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={smooth}>
              <NoteRow note={n} q={q} active={n.id === activeId} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  )
}

const NoteRow = memo(function NoteRow({ note, q, active }: { note: Note; q: string; active: boolean }) {
  return (
    <button onClick={() => selectNote(note.id)} className="row press w-full flex-col items-stretch gap-0 py-2.5 text-left">
      {active && <span className="absolute inset-0 -z-[1] bg-fill" />}
      <span className="t-body truncate font-semibold">{highlight(note.title || 'Neue Notiz', q)}</span>
      <span className="t-sub flex gap-2">
        <span className="shrink-0 text-label">{shortDate(note.updatedAt)}</span>
        <span className="truncate">{highlight(preview(note.body, q), q) || 'Kein zusätzlicher Text'}</span>
      </span>
    </button>
  )
})

function Editor({ note, onBack }: { note: Note; onBack?: () => void }) {
  const remove = () => {
    const n = deleteNote(note.id)
    selectNote(null)
    if (n) toast('Notiz gelöscht', 'trash', { label: 'Widerrufen', run: () => (restoreNote(n), selectNote(n.id)) })
  }
  return (
    <motion.div
      className="surface flex min-h-[70dvh] flex-col rounded-[18px] md:h-[calc(100dvh-200px)] md:min-h-[460px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-center gap-2 p-3">
        {onBack && (
          <button onClick={onBack} className="flex items-center text-[17px] text-accent">
            <ChevronLeft size={24} className="-ml-1" /> Notizen
          </button>
        )}
        <div className="flex-1" />
        <Menu
          label="Optionen"
          showCheck={false}
          onSelect={(a) => (a === 'pin' ? togglePin(note.id) : remove())}
          items={[
            { value: 'pin', label: note.pinned ? 'Loslösen' : 'Anheften' },
            { value: 'delete', label: 'Löschen', destructive: true },
          ]}
          className="relative grid h-9 w-9 place-items-center rounded-full"
        >
          <Glass radius="full" variant="clear" interactive className="!absolute inset-0" />
          <Ellipsis size={18} className="relative" />
        </Menu>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 md:px-10">
        <p className="mb-3 text-center text-[12px] text-label-2">{longDate(note.updatedAt)}</p>
        <input
          value={note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          placeholder="Titel"
          autoFocus={!note.title && !note.body}
          className="mb-2 w-full bg-transparent text-[28px] font-bold tracking-tight outline-none placeholder:text-label-3"
        />
        <textarea
          value={note.body}
          onChange={(e) => updateNote(note.id, { body: e.target.value })}
          placeholder="Text"
          className={cn('min-h-[40vh] w-full flex-1 resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-label-3 md:text-[16px]')}
        />
      </div>
    </motion.div>
  )
}

function Empty() {
  return (
    <motion.div className="surface grid place-items-center rounded-[18px] text-[15px] text-label-2 md:h-[calc(100dvh-200px)] md:min-h-[460px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      Keine Notiz ausgewählt
    </motion.div>
  )
}
