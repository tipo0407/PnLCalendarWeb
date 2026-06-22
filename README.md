# PnL Calendar — Web

A web version of the PnL Calendar trading journal, built with **React + TypeScript + Vite**.
It reads your trading workbook in the browser and renders a monthly P&L calendar, a 12-month
activity heatmap, a Portfolio Lens sidebar, and a Trade Atlas analytics dashboard.

The companion desktop app (WPF) lives in `../PnLCalendar`. The web app reuses the same data
convention: it reads **only the 3rd worksheet**, with the same column names as the desktop app.

## Features

- **Calendar** — pastel P&L cells, trade counts, market-holiday badges, weekly totals, and
  month navigation
- **12-month activity heatmap** — colored by daily P&L magnitude; click any cell to jump to
  that month
- **Portfolio Lens sidebar** — total P&L, equity curve, win-rate bar, profit factor,
  expectancy, best/worst day, best week, monthly breakdown bars, and key insights
- **Trade Atlas** — equity curve, daily P&L, win/loss donut, setup edge, time-of-day edge,
  trade-by-trade P&L, P&L distribution histogram, and key metrics
- **Day detail modal** — a per-trade breakdown for the selected day
- **Light / dark theme** — toggle in the top bar; your choice is remembered

## Data sources

Two ways to load trades:

1. **Upload `.xlsx`** (most reliable) — click **Upload .xlsx** and pick your `Trading.xlsx`.
2. **Google Sheet link** — paste the link and click **Sync**.
   - The browser cannot carry your Google login session, so the sheet must be shared as
     **"Anyone with the link can view"**, otherwise the request returns 401.
   - In dev mode this goes through a Vite proxy (`/gsheet`) to avoid browser CORS issues.

## Workbook format

The app loads trades from a single Excel workbook (`.xlsx`). It always reads the
**3rd worksheet** (sheet index 3, i.e. the third tab) — the first two tabs can be anything
(e.g. a journal and a notes sheet). Put your trade log on the 3rd tab.

- **Row 1** must be the header row.
- **Each subsequent row** is one trade.
- A row is skipped if its `Date` cell is empty/non-numeric.
- Column **order does not matter** — columns are matched by header name (case-insensitive).
- Only the columns below are read; any extra columns are ignored.

### Columns

| Header           | Type                      | Required | Description                                            |
| ---------------- | ------------------------- | :------: | ----------------------------------------------------- |
| `Date`           | Excel date serial         |   yes    | Trade date. Must be a real Excel date, not text.      |
| `EntryTime`      | Excel time (day fraction) |    no    | Entry time of day (e.g. `0.5` = 12:00).               |
| `ExitTime`       | Excel time (day fraction) |    no    | Exit time of day.                                     |
| `NoOfDay`        | integer                   |    no    | Trade sequence number within the day (1, 2, 3 …).     |
| `Duration`       | Excel time (day fraction) |    no    | Holding time.                                         |
| `Direction`      | text                      |    no    | `Long` / `Short` (free text; pills detect long/short).|
| `Symbol`         | text                      |    no    | Instrument symbol (e.g. `MES`).                       |
| `EntryPrice`     | number                    |    no    | Entry price.                                          |
| `ExitPrice`      | number                    |    no    | Exit price.                                           |
| `Size`           | number                    |    no    | Position size / contracts.                            |
| `PL`             | number                    |    yes*  | Per-trade profit/loss. Drives every chart.            |
| `Setup`          | text                      |    no    | Strategy / setup label (used by "Setup Edge").        |
| `Reason&Emotion` | text                      |    no    | Free-text note about rationale / emotion.             |
| `APL`            | number                    |    no    | Running cumulative P&L after the trade.               |
| `Note`           | text                      |    no    | Free-text note.                                       |

\* `Date` is required for a row to be included; `PL` should be present for the analytics to be
meaningful (missing `PL` is treated as `0`).

### How dates and times are encoded

Excel stores dates and times as numbers, and this app reads those raw numbers:

- A **date** is the integer number of days since 1899-12-30 (the Excel epoch).
  Example: `2026-01-14` → `46036`.
- A **time** is the fraction of a 24-hour day.
  Example: `07:38` → `0.31806`, `12:00` → `0.5`, `00:30` → `0.02083`.

If you type dates/times normally into Google Sheets or Excel (formatted as Date / Time), they
are already stored this way — just keep the cells formatted as Date/Time, not Text.

### Example

The trade log tab (3rd sheet), as you would see it in a spreadsheet:

| Date       | EntryTime | ExitTime | NoOfDay | Duration | Direction | Symbol | EntryPrice | ExitPrice | Size | PL     | Setup     | Reason&Emotion   | APL    | Note            |
| ---------- | --------- | -------- | ------- | -------- | --------- | ------ | ---------- | --------- | ---- | ------ | --------- | ---------------- | ------ | --------------- |
| 2026-01-14 | 07:38     | 07:44    | 1       | 00:06    | Long      | MES    | 6947.75    | 6940.75   | 1    | -36.24 | Reversal  | bottom looked weak | -36.24 | waited too long |
| 2026-01-14 | 09:12     | 09:20    | 2       | 00:08    | Short     | MES    | 6131.00    | 6128.50   | 1    | 12.50  | Trend     | held the trend     | -23.74 |                 |

Trades are sorted automatically by `Date`, then `EntryTime`, then `NoOfDay`.

### Try it without your own data

To follow along, create a Google Sheet (or Excel file) with **any two tabs first**, then a
**third tab** containing the header row above plus a few sample trades. Either upload it with
**Upload .xlsx**, or share it as "Anyone with the link can view" and paste the link, then
**Sync**.

## Development

```powershell
cd PnLCalendarWeb
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build
npm run lint     # ESLint
```

## Notes

Google Sheet sync relies on the Vite dev proxy and only works under `npm run dev`. To deploy
as a static site with private-sheet sync, you'd need an additional backend/serverless proxy.
Uploading an `.xlsx` works in any deployment.

## Tech stack

- React 19 + TypeScript + Vite
- [SheetJS](https://sheetjs.com/) (`xlsx`) for workbook parsing
- [Recharts](https://recharts.org/) for charts

## License

[MIT](./LICENSE)
