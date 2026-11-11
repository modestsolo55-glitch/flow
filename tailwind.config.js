/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      colors: {
        label: 'var(--label)',
        'label-2': 'var(--label-2)',
        'label-3': 'var(--label-3)',
        sep: 'var(--sep)',
        fill: 'var(--fill)',
        'fill-2': 'var(--fill-2)',
        'fill-3': 'var(--fill-3)',
        surface: 'var(--surface)',
        bg: 'var(--bg)',
        accent: 'var(--accent)',
        ios: {
          red: 'var(--red)',
          orange: 'var(--orange)',
          yellow: 'var(--yellow)',
          green: 'var(--green)',
          teal: 'var(--teal)',
          indigo: 'var(--indigo)',
          purple: 'var(--purple)',
          pink: 'var(--pink)',
        },
      },
    },
  },
  plugins: [],
}
