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
      '/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        },
        rewrite: (path) => path.replace(/^\/yahoo/, ''),
      },
    },
  },
})
