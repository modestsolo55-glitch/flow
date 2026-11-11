# Flow

All-in-one Produktivitäts-App im Liquid-Glass-Design – React + TypeScript + Tailwind CSS + Framer Motion.

## Was Flow kann

- **Tagesplan** in «Heute»: Termine, eingeplante Aufgaben und freie Lücken als Zeitleiste. «Einplanen» legt offene Aufgaben von heute automatisch in die Lücken (wichtigste zuerst, 30 bzw. 60 Min., mit Puffer) – widerrufbar.
- **Aufgaben** als Liste oder Board, mit Prioritäten, Listen, Datum/Uhrzeit und **Wiederholung** (täglich, werktags, wöchentlich, monatlich). Schnelleingabe versteht «morgen 14:00 !1 #arbeit».
- **Kalender** (Tag/Woche) mit Drag & Drop von Aufgaben in Zeitblöcke.
- **Fokus** (Pomodoro) an eine Aufgabe gekoppelt: Fokuszeit wird an der Aufgabe gespeichert, am Ende fragt Flow «erledigt?». Benachrichtigung, wenn die Zeit im Hintergrund abläuft.
- **Notizen** mit Suche, **Gewohnheiten** mit Serien.
- **Einstellungen**: eigene Listen, Erscheinungsbild, Backup sichern/wiederherstellen, leer starten.
- **Installierbar** als App (Home-Bildschirm, offline) im Production-Build.

## Weitergeben

- **Online: https://modestsolo55-glitch.github.io/flow/** – immer erreichbar, auch auf dem Handy («Zum Home-Bildschirm» installiert Flow wie eine App). Nach dem ersten Öffnen funktioniert es auch ohne Internet. Einträge bleiben im jeweiligen Browser gespeichert. Jeder Push auf `main` testet, baut und veröffentlicht automatisch (`.github/workflows/pages.yml`).
- **`release/Flow.html`** – eine einzige Datei, alles eingebettet. Doppelklick öffnet Flow im Browser, ohne Server und ohne Internet. Einträge bleiben in diesem Browser gespeichert. Per Mail/AirDrop weitergeben: jede Person hat dann ihre eigene, getrennte Kopie.
- **Geteilter Link (claude.ai)** – angemeldete Personen mit dem Recht «Mitwirken» speichern ihre Einträge privat in ihrem Konto und haben sie auf allen Geräten. Reine Betrachter und nicht angemeldete Besucher nutzen den Browserspeicher.
- Neu erzeugen: `npm run release`.

## Starten

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Typecheck + Production-Build nach dist/
npm test         # Logik-Tests (Schnelleingabe, Wiederholungen, Board, Tagesplan, Gewohnheiten, Backup)
npm run release  # Einzeldateien nach release/
```

## Bedienung

| Taste | Aktion |
|---|---|
| `⌘K` / `Ctrl K` | Command-Bar: suchen, navigieren, Aufgaben erstellen |
| `N` | Neu – passend zur Ansicht (Aufgabe, Termin, Notiz, Gewohnheit) |
| `1`–`6` | Heute · Aufgaben · Kalender · Notizen · Fokus · Gewohnheiten |
| `Esc` | Popups schliessen, Fokus-Modus verlassen |

Schnelleingabe versteht `heute`, `morgen`, `übermorgen`, Wochentage, `14:00` / `14 Uhr`, `!1`–`!3` und `#projekt`.

## Aufbau

- `src/store.ts`, `src/actions.ts` – kleiner externer Store (useSyncExternalStore + Selektoren), Persistenz in `localStorage`
- `src/lib/dnd.ts` – Drag & Drop (Kanban + Kalender); Ghost-Position über Motion Values, React rendert nur bei Zielwechsel
- `src/lib/timer.ts` – Pomodoro mit Zeitstempeln (kein Zählen per Intervall)
- `src/components/` – Glas-Primitives, Navigation, Command-Bar, Quick Add, Editoren, Effekte
- `src/views/` – die sechs Bereiche

## Designprinzip

Wie in iOS 26 / macOS Tahoe: Inhalte liegen auf soliden Flächen (Gewicht, Lesbarkeit), Liquid Glass nur auf der Bedienebene – Sidebar, Tabbar, Toolbar-Knöpfe, Menüs, Suche. Systemfarben und -schrift, Sheets mit gruppierten Zeilen, Springs ohne Nachwippen.

Liquid Glass (`src/components/LiquidGlass.tsx`): echte Lichtbrechung per SVG-Displacement-Filter als `backdrop-filter` (pro Element berechnete Linsen-Karte), Rand-Glanzlicht folgt dem Zeiger, elastische Auswahl-Tropfen. Die Brechung läuft in Chromium-Browsern (Chrome, Edge, Arc, Brave); Safari und Firefox zeigen mattes Glas mit gleichem Rand und Glanz.

## Testen der Oberfläche

`http://localhost:5173/?e2e` startet einen Testmodus (nur Entwicklung): Animationen laufen auch im Hintergrund weiter, und `window.T` bietet Helfer für Klick-Tests in der Browser-Konsole.

## Performance-Regeln

- Animiert werden nur `transform` und `opacity` (Fortschrittsbalken via `scaleY`/`scaleX`, Kopf des Fokus-Rings via `rotate`).
- Alles läuft über Framer Motion bzw. `requestAnimationFrame` und folgt damit der echten Bildrate (60/90/120 Hz).
- Backdrop-Blur nur auf Top-Level-Glasflächen; verschachtelte Flächen (`.glass-soft`) sind nur transluzent.
- Die Aufgabenliste ist mit `@tanstack/react-virtual` virtualisiert; Zeilen gleiten per animiertem `translateY` nach.
- `prefers-reduced-motion` → `MotionConfig reducedMotion="user"`: nur noch Fades, Hintergrund steht still.
