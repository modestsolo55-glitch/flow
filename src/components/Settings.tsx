import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Download, Target, Trash2, Upload, Wand2 } from 'lucide-react'
import type { Project } from '../types'
import { useStore } from '../lib/createStore'
import { db, ui } from '../store'
import { addProject, closeWelcome, deleteProject, exportData, importData, resetDemo, setSettingsOpen, startEmpty, updateProject } from '../actions'
import { setAppearance } from '../lib/theme'
import { toast } from '../lib/toast'
import { syncState, type SyncState } from '../lib/cloud'
import { PALETTE } from '../lib/utils'
import { snappy } from '../lib/motion'
import { Group, Sheet } from './Sheet'
import { Button, Menu, RowIcon, Segmented } from './ui'

const STORAGE_NOTE: Record<SyncState, string> = {
  local: 'Gespeichert in diesem Browser auf diesem Gerät – auch offline. Ein Backup schützt vor Verlust und bringt deine Daten auf ein anderes Gerät.',
  connecting: 'Verbinde mit deinem Konto …',
  cloud: 'Privat in deinem Konto gespeichert und auf deinen Geräten synchronisiert. Nur du siehst deine Einträge.',
  error: 'Gerade nicht mit deinem Konto verbunden – Änderungen bleiben in diesem Browser gespeichert.',
}

export function SettingsSheet() {
  const open = useStore(ui, (s) => s.settingsOpen)
  return <AnimatePresence>{open && <SettingsPanel key="settings" />}</AnimatePresence>
}

function SettingsPanel() {
  const theme = useStore(db, (s) => s.settings.theme)
  const projects = useStore(db, (s) => s.projects)
  const tasks = useStore(db, (s) => s.tasks)
  const [newName, setNewName] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const sync = useStore(syncState, (s) => s)
  const close = () => setSettingsOpen(false)

  const add = () => {
    const name = newName.trim()
    if (!name) return
    addProject(name, PALETTE[projects.length % PALETTE.length])
    setNewName('')
  }

  return (
    <Sheet title="Einstellungen" onClose={close}>
      <h3 className="mb-2 px-4 text-[13px] text-label-2">Erscheinungsbild</h3>
      <div className="mb-6 flex justify-center">
        <Segmented
          value={theme}
          onChange={(m) => setAppearance(m)}
          layoutId="settings-theme"
          slide={false}
          options={[
            { value: 'system', label: 'Automatisch' },
            { value: 'light', label: 'Hell' },
            { value: 'dark', label: 'Dunkel' },
          ]}
        />
      </div>

      <h3 className="mb-2 px-4 text-[13px] text-label-2">Listen</h3>
      <Group footer="Eine Liste zu löschen behält ihre Aufgaben – sie haben dann einfach keine Liste mehr.">
        <AnimatePresence initial={false}>
          {projects.map((p) => (
            <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProjectRow project={p} count={tasks.filter((t) => t.projectId === p.id && t.status !== 'done').length} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="row sep min-h-[50px]" style={{ ['--sep-inset' as string]: '57px' }}>
          <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-full bg-fill text-[18px] text-accent">+</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Neue Liste"
            className="h-[50px] min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-label-3 md:text-[15px]"
          />
          {newName && (
            <Button variant="plain" size="sm" onClick={add}>
              Hinzufügen
            </Button>
          )}
        </div>
      </Group>

      <h3 className="mb-2 px-4 text-[13px] text-label-2">Daten</h3>
      <Group footer={STORAGE_NOTE[sync]}>
        <button
          onClick={async () => {
            const r = await exportData()
            if (r === 'saved') toast('Backup gesichert', 'check')
          }} className="row press w-full min-h-[50px] text-left" style={{ ['--sep-inset' as string]: '57px' }}>
          <RowIcon color="var(--accent)">
            <Download size={16} />
          </RowIcon>
          <span className="t-body flex-1">Backup sichern</span>
        </button>
        <button onClick={() => file.current?.click()} className="row press w-full min-h-[50px] text-left" style={{ ['--sep-inset' as string]: '57px' }}>
          <RowIcon color="var(--green)">
            <Upload size={16} />
          </RowIcon>
          <span className="t-body flex-1">Backup wiederherstellen</span>
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            toast((await importData(f)) ? 'Backup wiederhergestellt' : 'Diese Datei ist kein Flow-Backup', 'info')
          }}
        />
      </Group>

      <Group>
        <button onClick={() => (resetDemo(), toast('Beispieldaten geladen', 'check'))} className="row press w-full min-h-[50px] justify-center text-[17px] text-accent md:text-[15px]">
          Beispieldaten laden
        </button>
        <button
          onClick={() => {
            if (!confirmReset) return setConfirmReset(true)
            startEmpty()
            setConfirmReset(false)
            toast('Alles gelöscht – Flow ist leer', 'trash')
          }}
          className="row press w-full min-h-[50px] justify-center text-[17px] text-ios-red md:text-[15px]"
        >
          {confirmReset ? 'Wirklich alles löschen? Nochmals tippen' : 'Alles löschen und leer starten'}
        </button>
      </Group>
    </Sheet>
  )
}

function ProjectRow({ project, count }: { project: Project; count: number }) {
  const [name, setName] = useState(project.name)
  return (
    <div className="row min-h-[50px]" style={{ ['--sep-inset' as string]: '57px' }}>
      <Menu
        label="Farbe"
        value={project.color}
        align="start"
        onSelect={(color) => updateProject(project.id, { color })}
        items={PALETTE.map((c) => ({ value: c, label: ' ', icon: <span className="h-4 w-4 rounded-full" style={{ background: c }} /> }))}
        className="grid h-[29px] w-[29px] shrink-0 place-items-center"
      >
        <motion.span whileTap={{ scale: 0.85 }} transition={snappy} className="h-[22px] w-[22px] rounded-full" style={{ background: project.color }} />
      </Menu>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => (name.trim() ? updateProject(project.id, { name: name.trim() }) : setName(project.name))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Name der Liste"
        className="h-[50px] min-w-0 flex-1 bg-transparent text-[17px] outline-none md:text-[15px]"
      />
      <span className="text-[15px] tabular-nums text-label-2">{count}</span>
      <button onClick={() => deleteProject(project.id)} aria-label={`${project.name} löschen`} className="grid h-8 w-8 place-items-center rounded-full text-label-3 hover:text-ios-red">
        <Trash2 size={16} />
      </button>
    </div>
  )
}

/* ───────── First launch ───────── */

export function WelcomeSheet() {
  const open = useStore(ui, (s) => s.welcome)
  return <AnimatePresence>{open && <Welcome key="welcome" />}</AnimatePresence>
}

function Welcome() {
  const points = [
    { icon: <CalendarClock size={18} />, color: 'var(--red)', title: 'Aufgaben und Termine an einem Ort', text: 'Ziehe Aufgaben in den Kalender oder lass Flow freie Lücken automatisch füllen.' },
    { icon: <Target size={18} />, color: 'var(--orange)', title: 'Fokus auf eine Sache', text: 'Starte eine Fokus-Session direkt an einer Aufgabe – Flow merkt sich die Zeit.' },
    { icon: <Wand2 size={18} />, color: 'var(--accent)', title: 'Einfach drauflos tippen', text: '«Bericht senden morgen 14:00 !1 #arbeit» – Datum, Zeit und Priorität erkennt Flow selbst.' },
  ]
  return (
    <Sheet title="Willkommen bei Flow" onClose={closeWelcome}>
      <div className="mb-6 space-y-5 px-2 pt-2">
        {points.map((p) => (
          <div key={p.title} className="flex gap-4">
            <RowIcon color={p.color}>{p.icon}</RowIcon>
            <div>
              <div className="text-[17px] font-semibold leading-snug md:text-[15px]">{p.title}</div>
              <div className="t-sub mt-0.5 text-[15px] md:text-[13px]">{p.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 pb-2">
        <Button className="w-full" onClick={closeWelcome}>
          Mit Beispielen ansehen
        </Button>
        <Button
          variant="gray"
          className="w-full"
          onClick={() => {
            startEmpty()
            closeWelcome()
          }}
        >
          Leer starten
        </Button>
      </div>
      <p className="t-sub px-4 pb-2 text-center">Beispiele lassen sich später in den Einstellungen löschen.</p>
    </Sheet>
  )
}
