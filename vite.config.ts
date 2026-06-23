import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

const TRADES_FILE = process.env.TRADES_FILE || path.resolve(process.cwd(), '..', 'Trading.xlsx')
const SYNC_BAT = path.resolve(process.cwd(), 'server', 'sync-sheet.bat')

// Serve the live trades workbook at /data/trades.xlsx so the app can auto-load it.
function tradesFilePlugin() {
  let syncing = false
  return {
    name: 'trades-file',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/data/trades.xlsx', (_req, res) => {
        try {
          const buf = fs.readFileSync(TRADES_FILE)
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          res.setHeader('Cache-Control', 'no-store')
          res.end(buf)
        } catch {
          res.statusCode = 404
          res.end('trades file not found')
        }
      })
      server.middlewares.use('/api/sync', (_req, res) => {
        if (syncing) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, already: true }))
          return
        }
        syncing = true
        execFile('cmd.exe', ['/c', SYNC_BAT, TRADES_FILE], { windowsHide: true, timeout: 60000 }, (err) => {
          syncing = false
          res.statusCode = err ? 500 : 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: !err }))
        })
      })
    },
  }
}

// Proxy Google Sheets export through the dev server to avoid browser CORS issues.
// The frontend fetches `/gsheet/spreadsheets/d/<id>/export?format=xlsx`.
export default defineConfig({
  plugins: [react(), tradesFilePlugin()],
  server: {
    proxy: {
      '/api/checkout': { target: 'http://localhost:8788', changeOrigin: true },
      '/api/license': { target: 'http://localhost:8788', changeOrigin: true },
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
