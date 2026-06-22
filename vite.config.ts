import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy Google Sheets export through the dev server to avoid browser CORS issues.
// The frontend fetches `/gsheet/spreadsheets/d/<id>/export?format=xlsx`.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/gsheet': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/gsheet/, ''),
      },
    },
  },
})
