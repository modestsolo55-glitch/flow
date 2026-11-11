import { fileURLToPath } from 'node:url'

// resolve the Tailwind config relative to this file (works from any cwd)
const config = fileURLToPath(new URL('./tailwind.config.js', import.meta.url))

export default { plugins: { tailwindcss: { config }, autoprefixer: {} } }
