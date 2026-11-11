// Turns the Vite build into self-contained single files:
//   release/Flow.html          – complete document, double-click to open, works offline
//   release/flow-shared.html   – page body for the shared claude.ai link
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const html = readFileSync(join(dist, 'index.html'), 'utf8')

const jsPath = html.match(/<script type="module"[^>]*src="\.?\/([^"]+)"[^>]*><\/script>/)[1]
const cssPath = html.match(/<link rel="stylesheet"[^>]*href="\.?\/([^"]+)"[^>]*>/)[1]
const js = readFileSync(join(dist, jsPath), 'utf8').replace(/<\/script/gi, '<\\/script')
const css = readFileSync(join(dist, cssPath), 'utf8')
const favicon = 'data:image/svg+xml;base64,' + readFileSync(join(root, 'public/favicon.svg')).toString('base64')
const boot = html.match(/<script>\s*try \{[\s\S]*?<\/script>/)[0]
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />'

mkdirSync(join(root, 'release'), { recursive: true })

const standalone = `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#f2f2f7" />
<meta name="description" content="Aufgaben, Kalender, Notizen, Fokus und Gewohnheiten an einem Ort." />
<link rel="icon" type="image/svg+xml" href="${favicon}" />
${fonts}
<title>Flow</title>
${boot}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`
writeFileSync(join(root, 'release/Flow.html'), standalone)

// The claude.ai viewer wraps the page in its own document skeleton.
const shared = `<title>Flow</title>
<meta name="theme-color" content="#f2f2f7" />
${fonts}
${boot}
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
writeFileSync(join(root, 'release/flow-shared.html'), shared)

const kb = (s) => Math.round(Buffer.byteLength(s) / 1024) + ' KB'
console.log('release/Flow.html', kb(standalone))
console.log('release/flow-shared.html', kb(shared))
