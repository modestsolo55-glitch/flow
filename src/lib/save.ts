type ClaudeHost = { use: (name: string) => Promise<any> }
const host = () => (window as Window & { claude?: ClaudeHost }).claude

/** Backup download – through the viewer's save dialog when running as a shared page. */
export async function saveFile(filename: string, data: string): Promise<'saved' | 'declined' | 'fallback'> {
  const c = host()
  if (c?.use) {
    try {
      const dl = await c.use('downloads')
      if (dl) {
        await dl.save({ filename, data })
        return 'saved'
      }
    } catch (e: any) {
      if (e?.code === 'declined') return 'declined'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'fallback'
}
