import type { AppData, CalEvent, Habit, Note, Priority, Project, Status, Task } from '../types'
import { addDaysKey, todayKey } from './date'
import { uid } from './utils'

const rnd = (n: number) => {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function mkLog(streak: number, density: number, seed: number, doneToday: boolean) {
  const t = todayKey()
  const log: Record<string, true> = {}
  if (doneToday) log[t] = true
  for (let i = 1; i <= 50; i++) {
    const k = addDaysKey(t, -i)
    if (i <= streak) log[k] = true
    else if (i === streak + 1) continue
    else if (rnd(seed * 100 + i) < density) log[k] = true
  }
  return log
}

export function createSampleData(theme: AppData['settings']['theme'] = 'system'): AppData {
  const t = todayKey()
  const d = (n: number) => addDaysKey(t, n)
  const now = Date.now()

  const projects: Project[] = [
    { id: 'p-work', name: 'Arbeit', color: '#007aff' },
    { id: 'p-personal', name: 'Persönlich', color: '#ff2d55' },
    { id: 'p-health', name: 'Gesundheit', color: '#34c759' },
    { id: 'p-home', name: 'Zuhause', color: '#ff9500' },
    { id: 'p-side', name: 'Side Project', color: '#af52de' },
  ]

  let order = 0
  const mk = (
    title: string,
    projectId: string,
    priority: Priority,
    due: string | null,
    status: Status = 'todo',
    extra: Partial<Task> = {},
  ): Task => {
    order++
    return {
      id: uid() + order,
      title,
      notes: '',
      status,
      priority,
      due,
      projectId,
      order,
      createdAt: now - order * 3600e3,
      completedAt: status === 'done' ? now - order * 900e3 : null,
      schedule: null,
      ...extra,
    }
  }

  const tasks: Task[] = [
    mk('Quartalsbericht fertigstellen', 'p-work', 3, t, 'doing', {
      notes: 'Zahlen aus dem Dashboard übernehmen und die Grafiken aktualisieren.',
      schedule: { date: t, start: 10 * 60, duration: 90 },
    }),
    mk('Feedback an Design-Team senden', 'p-work', 2, t),
    mk('Yoga – 30 Minuten', 'p-health', 1, t, 'todo', { schedule: { date: t, start: 18 * 60, duration: 30 } }),
    mk('Geschenk für Mia bestellen', 'p-personal', 2, t),
    mk('Rechnungen bezahlen', 'p-home', 3, d(-1)),
    mk('Landingpage-Texte überarbeiten', 'p-side', 2, d(1), 'doing'),
    mk('Arzttermin vereinbaren', 'p-health', 1, d(1)),
    mk('Präsentation für Montag vorbereiten', 'p-work', 3, d(3)),
    mk('Pflanzen umtopfen', 'p-home', 0, d(2)),
    mk('1:1 mit Jonas vorbereiten', 'p-work', 1, d(2), 'todo', { schedule: { date: d(2), start: 9 * 60, duration: 45 } }),
    mk('Onboarding-Flow skizzieren', 'p-side', 1, d(5)),
    mk('Steuerunterlagen sortieren', 'p-home', 2, d(6)),
    mk('Wohnung putzen', 'p-home', 1, d(4)),
    mk('Wochenrückblick schreiben', 'p-personal', 1, d(6 - ((new Date().getDay() + 6) % 7)), 'todo', { repeat: 'weekly' }),
    mk('Vitamine nehmen', 'p-health', 0, t, 'todo', { repeat: 'daily' }),
    mk('Buch «Deep Work» weiterlesen', 'p-personal', 0, null),
    mk('Laufschuhe ersetzen', 'p-health', 0, null),
    mk('Fotoalbum Sommerferien gestalten', 'p-personal', 0, null),
    mk('API-Dokumentation lesen', 'p-side', 1, null, 'doing'),
    mk('E-Mails beantworten', 'p-work', 1, t, 'done'),
    mk('Morgenlauf 5 km', 'p-health', 1, t, 'done'),
    mk('Wocheneinkauf', 'p-home', 1, d(-1), 'done'),
    mk('Logo-Varianten exportieren', 'p-side', 2, d(-2), 'done'),
  ]

  const ev = (title: string, date: string, start: number, duration: number, color: string): CalEvent => ({
    id: uid() + title.length + start,
    title,
    date,
    start,
    duration,
    color,
  })
  const events: CalEvent[] = [
    ev('Team-Standup', t, 9 * 60 + 30, 30, '#007aff'),
    ev('Mittagessen mit Lea', t, 12 * 60 + 15, 60, '#ff2d55'),
    ev('Design-Review', t, 15 * 60, 45, '#af52de'),
    ev('Zahnarzt', d(1), 8 * 60 + 30, 45, '#34c759'),
    ev('Sprint Planning', d(1), 14 * 60, 90, '#007aff'),
    ev('Kino mit Freunden', d(2), 20 * 60, 150, '#ff2d55'),
    ev('Workshop: Liquid UI', d(3), 10 * 60, 120, '#af52de'),
    ev('Familienessen', d(4), 19 * 60, 120, '#ff9500'),
    ev('Squash', d(-1), 18 * 60 + 30, 60, '#34c759'),
    ev('Kundencall Nordlicht AG', d(-2), 11 * 60, 60, '#007aff'),
  ]

  const notes: Note[] = [
    {
      id: uid() + 'n1',
      title: 'Ideen für das Side Project',
      body:
        'Eine ruhige App für tägliche Reflexion.\n\n– Drei Fragen am Abend\n– Wochenrückblick mit Stimmungskurve\n– Export als PDF\n\nNächster Schritt: Interviews mit fünf Testpersonen.',
      pinned: true,
      updatedAt: now - 2 * 3600e3,
    },
    {
      id: uid() + 'n2',
      title: 'Meeting-Notizen Design-Review',
      body:
        'Feedback zur neuen Navigation:\n\n1. Sidebar wirkt leichter mit mehr Weissraum\n2. Kontraste im Dark Mode prüfen\n3. Animationen beim Seitenwechsel etwas kürzer\n\nVerantwortlich: Lea & Jonas',
      pinned: false,
      updatedAt: now - 26 * 3600e3,
    },
    {
      id: uid() + 'n3',
      title: 'Rezept: Ofengemüse mit Feta',
      body:
        'Süsskartoffeln, Peperoni, rote Zwiebeln, Zucchetti in Stücke schneiden. Mit Olivenöl, Salz, Paprika und Thymian mischen. 25 Min. bei 200 °C, dann Feta darüberbröseln und weitere 10 Min. backen.',
      pinned: false,
      updatedAt: now - 3 * 86400e3,
    },
    {
      id: uid() + 'n4',
      title: 'Bücher, die ich lesen will',
      body: 'Deep Work – Cal Newport\nAtomic Habits – James Clear\nDer Mensch erscheint im Holozän – Max Frisch\nFour Thousand Weeks – Oliver Burkeman',
      pinned: false,
      updatedAt: now - 6 * 86400e3,
    },
  ]

  const hb = (name: string, icon: string, color: string, log: Record<string, true>): Habit => ({
    id: uid() + name.length,
    name,
    icon,
    color,
    log,
    createdAt: now - 60 * 86400e3,
  })
  const habits: Habit[] = [
    hb('2 Liter Wasser trinken', 'droplet', '#30b0c7', mkLog(12, 0.8, 1, true)),
    hb('20 Minuten lesen', 'book', '#af52de', mkLog(5, 0.65, 2, false)),
    hb('Meditieren', 'sparkles', '#ff2d55', mkLog(3, 0.5, 3, true)),
    hb('Bewegung', 'dumbbell', '#34c759', mkLog(8, 0.7, 4, false)),
    hb('Vor 23 Uhr schlafen', 'moon', '#ff9500', mkLog(1, 0.45, 5, false)),
  ]

  const focusLog: AppData['focusLog'] = {}
  for (let i = 0; i < 7; i++) {
    const s = i === 0 ? 2 : Math.round(rnd(i + 7) * 5)
    if (s) focusLog[d(-i)] = { sessions: s, minutes: s * 25 }
  }

  return {
    version: 1,
    tasks,
    projects,
    events,
    notes,
    habits,
    settings: { theme, focus: { work: 25, short: 5, long: 15 } },
    focusLog,
  }
}

/** A clean start: two lists, nothing else. */
export function createEmptyData(theme: AppData['settings']['theme'] = 'system'): AppData {
  return {
    version: 1,
    tasks: [],
    projects: [
      { id: uid() + 'p', name: 'Persönlich', color: '#007aff' },
      { id: uid() + 'w', name: 'Arbeit', color: '#ff9500' },
    ],
    events: [],
    notes: [],
    habits: [],
    settings: { theme, focus: { work: 25, short: 5, long: 15 } },
    focusLog: {},
  }
}
