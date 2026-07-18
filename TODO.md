# PnL Calendar Web — 代码审查 TODO / Code Review Backlog

> 本文件由项目负责人审查代码后整理，逐条列出发现的 Bug、安全隐患、改进点与增强项。
> 每条任务前有复选框 `[ ]`，其他 agent 完成后请改为 `[x]` 并可在末尾追加简短说明。
>
> This backlog was produced from a full review of the server, data-parsing,
> metrics, export and frontend code. Each item is independent and actionable.
> When an item is done, tick the box (`[x]`) and optionally note the commit.

Severity legend: 🔴 HIGH · 🟠 MEDIUM · 🟡 LOW

> ✅ **Status: all items completed (sections 1–10).** Server hardening
> (auth/SSRF/CORS/atomic store/async scrypt), CSV-injection fix, data-parsing &
> metrics bug fixes, a safe-storage helper, frontend leak/timer fixes,
> accessibility improvements, UI/design polish (responsive, skeletons, unified
> toasts & tooltip, colorblind cues, contrast, radius tokens, landing preview &
> sample-data CTA), the testing backlog (RTL + jsdom component tests, more lib
> tests, server auth/sync/security tests, expanded e2e journeys), and the
> additional findings are all done. Validated with `npm run lint`, `npm test`
> (142), `npm run test:server` (34), `npm run build`, and `npx playwright test`
> (12) — all passing.

---

## 1. Security — Server (`server/`)

- [x] 🔴 **`serve.cjs`: `/data/trades.xlsx` is served with no authentication.** Anyone who can reach the server can download the user's live trading workbook. Gate it behind `auth.verifySession` (or bind it to localhost only), and document the change.
- [x] 🔴 **`serve.cjs`: open proxies `/yahoo` and `/gsheet` follow redirects to arbitrary URLs (SSRF).** `forward()` does `new URL(up.headers.location, u)` up to depth 5, so an upstream redirect can point at internal/metadata addresses. Restrict redirects to the original allow-listed host (`query1.finance.yahoo.com` / `docs.google.com`), and reject private/loopback IPs.
- [x] 🟠 **`serve.cjs`: `/api/sync` (Google-Sheet sync trigger) is unauthenticated.** Any caller can invoke the `sync-sheet.bat` child process. Require auth, or bind the endpoint to localhost.
- [x] 🟠 **`ratelimit.cjs`: `clientIp()` trusts `X-Forwarded-For` unconditionally.** When the server is not strictly behind a trusted proxy, a client can spoof the header to bypass the per-IP rate limiter and login lockout. Only honor `X-Forwarded-For` when an explicit `TRUST_PROXY` flag is set; otherwise use `socket.remoteAddress`.
- [x] 🟠 **`auth.cjs` / `api.cjs`: default secrets fall back to `'pnlcal-dev-secret-change-me'`.** If deployed without `LICENSE_SECRET`/`AUTH_SECRET`, all tokens and license keys are forgeable. Refuse to start (or log a loud warning) when `NODE_ENV=production` and the secret is unset/default.
- [x] 🟠 **`store.cjs`: `saveUsers()` is a non-atomic full-file write with no locking.** Concurrent auth operations can corrupt or lose `.users.json`. Write to a temp file and `fs.renameSync` atomically; consider a simple write queue/mutex.
- [x] 🟠 **`auth.cjs`: password-reset token is returned in the HTTP response body (`resetToken`).** Documented as a stub, but in production this hands a valid reset token to any caller who knows an email. Wire it to email delivery and stop returning it in the response (keep the always-200 anti-enumeration behavior).
- [x] 🟠 **`api.cjs`: `Access-Control-Allow-Origin: *` is set on every endpoint, including `/api/auth/*`.** Any website can drive the auth/checkout API from a victim's browser. Restrict CORS to the app's own origin(s) via an allow-list env var.
- [x] 🟡 **`auth.cjs`: `crypto.timingSafeEqual` throws if buffers differ in length.** A corrupted/legacy `user.hash` (not 128 hex chars) makes login/change-password/delete return 500. Guard with a length check before `timingSafeEqual` and treat mismatched length as "invalid".
- [x] 🟡 **`auth.cjs`: `scryptSync` runs synchronously with default cost.** It blocks the event loop on every login/signup and the cost isn't tuned. Switch to async `crypto.scrypt` and set explicit `{ N, r, p }` cost parameters.
- [x] 🟡 **`api.cjs`: `verifyStripeSignature` only checks one `v1` value.** `Object.fromEntries(header.split(',').map(kv => kv.split('=')))` collapses duplicate `v1` entries and breaks if a value contains `=`. Parse all `v1` signatures and accept if any matches.
- [x] 🟡 **`serve.cjs`: security headers are only applied to static responses.** `/api/*`, `/data/*` and proxy responses don't get `X-Content-Type-Options`, `X-Frame-Options`, etc. Apply the baseline headers to all responses.

## 2. Security — Client / Data export

- [x] 🔴 **`lib/exportCsv.ts`: CSV formula injection.** `csvCell()` only quotes cells containing `"`, `,`, `\n`; it does not neutralize leading `=`, `+`, `-`, `@`, tab or CR. Malicious `setup`/`note`/`symbol`/`reasonEmotion` text executes as a formula when the CSV is opened in Excel/Sheets. Prefix any cell whose first char is dangerous with a `'` (or space). Add a unit test.

## 3. Bugs / Correctness — Data parsing & metrics

- [x] 🟠 **`lib/parseWorkbook.ts` `parseTimeCell()`: numeric times are always treated as Excel fraction-of-day.** `Math.round((v % 1) * 86400)` turns any whole-number seconds/minutes value into `0` and discards the integer part. Detect and handle plain seconds / `HH` integers vs. Excel day-fractions.
- [x] 🟠 **`lib/parseWorkbook.ts` `parseDateCell()`: `Date.parse()` fallback uses local-time getters.** Date-only strings can shift by a day depending on the runtime timezone. Normalize via UTC getters (or drop the loose fallback) so imports are timezone-stable.
- [x] 🟠 **`lib/taxSummary.ts`: gross loss sign inconsistency.** `grossLoss` is accumulated as negative numbers but reported under a "Gross Loss" label. Store/report it as a positive magnitude for a consistent report.
- [x] 🟡 **`lib/metrics.ts` `pnlHistogram()` / other `Math.min(...vals)` spreads.** Spreading a very large trade array into `Math.min`/`Math.max` can overflow the call stack. Use a reduce-based min/max.
- [x] 🟡 **`lib/metrics.ts` `profitFactor` returns `Infinity`** when there are wins but no losses. Ensure every consumer/formatter renders this gracefully (e.g. "∞" or "—") rather than the literal `Infinity`.
- [x] 🟡 **`lib/marketData.ts` `vwap()`: `c.volume || 1` substitutes volume 1 for zero-volume bars**, distorting VWAP. Skip zero-volume bars or use typical-price fallback instead.
- [x] 🟡 **`lib/risk.ts`: drawdown percentage baseline is `accountSize + peak`**, which is hard to interpret when starting equity is zero/negative and understates risk after gains. Define drawdown % against a clear baseline (initial account size or peak equity).

## 4. Bugs / Reliability — Client state & storage

- [x] 🟠 **Unguarded `localStorage` access can throw.** `settings.ts`, `profiles.ts`, `userTags.ts`, `playbook.ts`, `customTags.ts`, `tablePrefs.ts` touch `localStorage` (and `JSON.parse`) at module scope / in read-write helpers with no try/catch. In privacy mode, disabled-storage, or corrupt data this throws and can break app startup. Wrap access in a safe storage helper that falls back to in-memory state and tolerates parse errors.
- [x] 🟡 **`lib/checkout.ts` `startCheckout()` does not validate the response shape** before returning it as `CheckoutResult`. Validate fields and fail closed on malformed JSON.
- [x] 🟡 **`lib/useThemeColors.ts` only observes `data-theme`.** Charts won't recolor when accent / high-contrast CSS variables change (via `setAccent`/`setHighContrast`). Subscribe to the theme-preference change too.

## 5. Frontend — Bugs & performance

- [x] 🔴 **`components/DayChart.tsx`: chart callbacks are never unsubscribed.** The effect calls `subscribeVisibleLogicalRangeChange` / `subscribeCrosshairMove` but the cleanup only removes the chart / disconnects the `ResizeObserver`. Store and call the unsubscribe handles (and cancel any pending `requestAnimationFrame`) on cleanup to avoid stale-listener leaks across re-renders.
- [x] 🟠 **`components/TradeAtlas.tsx`: `printAtlas()` uses `setTimeout(cleanup, 1000)` that is never cleared.** If the component unmounts first, the delayed cleanup mutates document state. Capture and clear the timer; prefer the `afterprint` event with a guarded cleanup.
- [x] 🟡 **`App.tsx`: global `Cmd/Ctrl+K` shortcut fires even when another modal/overlay is open**, producing conflicting overlays. Gate global shortcuts through a single overlay manager or skip them when a modal is open.
- [x] 🟡 **`components/ErrorBoundary.tsx`: `componentDidCatch` logs only `error.message`.** Log the full error + component stack and add a reset/retry path on the crash screen.

## 6. Frontend — Accessibility

- [x] 🟠 **`components/TradeTable.tsx`: sortable headers and clickable rows are not keyboard-operable and lack ARIA.** Make header controls real `<button>`s with `aria-sort`; make rows focusable/activatable via keyboard (or add a per-row action button).
- [x] 🟠 **`components/TourOverlay.tsx`: modal tour does not trap or restore focus.** Add focus trapping, set initial focus, and restore the previously focused element on close.
- [x] 🟠 **`components/ImportWizard.tsx`: dialog has no accessible name.** Add `aria-labelledby` referencing the visible heading (or `aria-label`).
- [x] 🟡 **`components/SettingsModal.tsx`: accent color-swatch buttons don't expose selection state.** Add `aria-pressed`/`aria-current` to the active accent; verify the focus trap has a fallback.
- [x] 🟡 **`components/CommandPalette.tsx`: results list lacks listbox semantics.** Add `role="listbox"`/`role="option"` + `aria-activedescendant` (or `aria-selected`) so screen readers announce the active item.
- [x] 🟡 **`components/CalendarView.tsx`: interactive day cells lack visible focus styling / keyboard help**, and non-interactive cells give no explanation. Add focus styles and `aria-disabled`/help text.

## 7. Enhancements / Hardening

- [x] 🟡 **No automated tests for `server/serve.cjs`, `sync.cjs`, `store.cjs`, `ratelimit.cjs`.** Add `node --test` coverage (proxy path traversal, SPA fallback, rate-limit windows, atomic store writes) alongside the existing `api.test.cjs`.
- [x] 🟡 **`serve.cjs`: no cache headers for hashed assets and no compression.** Emit `Cache-Control: public, immutable` for `/assets/*` and consider gzip/br so the server doesn't depend on an external proxy for this.
- [x] 🟡 **No graceful shutdown / structured logging on the server.** Handle `SIGTERM`/`SIGINT` to close the HTTP server cleanly, and replace ad-hoc `console.log` with a minimal structured logger (timestamp + level).
- [x] 🟡 **`package.json` has no `engines` field.** Pin the supported Node version (CI + Docker both use Node 20) to prevent accidental drift.
- [x] 🟡 **Add dependency/security automation.** Enable Dependabot (or `npm audit` in CI) so vulnerable transitive deps are surfaced; the CI workflow currently runs no security step.
- [x] 🟡 **`Dockerfile`: build stage runs `npm ci` but the runtime stage ships no lockfile pin for the base image.** Pin `node:20-alpine` by digest for reproducible/secure builds.

---

## 8. UI / Design — 界面美化与体验优化

> 由 UI 设计师视角审查得出。整体设计系统已很成熟（极光背景、光标聚光、tabular
> 数字、`focus-visible`、`prefers-reduced-motion`、高对比模式、暗色主题、各视图
> 已有加载/空/错误态）。以下为可进一步打磨、提升质感与可用性的事项。
> Design-impact severity: 🔴 明显影响可用性/观感 · 🟠 中等打磨 · 🟡 细节润色。

### 8.1 Responsive / 响应式
- [x] 🔴 **Topbar 在手机上不换行（真实 bug）。** `App.css` 的 `@media (max-width:720px)` 里写的是 `.topbar { flex-wrap: wrap }`，但 flex 容器其实是 `.topbar-inner`（`.topbar` 是 sticky 块级元素），因此该规则无效，窄屏顶栏（品牌 + 视图 tab + 账户筛选 + 数据源 + 设置/主题按钮）会拥挤或溢出。改为 `.topbar-inner { flex-wrap: wrap; row-gap: 12px; }` 并检查各元素在 <420px 的排布。
- [x] 🟠 **日历网格缺少手机断点。** `.cal-grid` 为 `repeat(5,1fr) 0.85fr`（周一~周五 + 周汇总，共 6 列），在 <560px 时单元格过小、数字与徽标拥挤。为窄屏提供更紧凑的排版（缩小内边距/字号，或改为可横向滚动/按周堆叠的布局）。
- [x] 🟠 **TradeTable 在窄屏溢出。** 表格用固定 `grid-template-columns`（`2fr 0.8fr …`），手机上会横向溢出且无滚动提示。加入横向滚动容器 + 渐隐阴影提示，或在 <640px 改为「每笔交易一张卡片」的堆叠布局。
- [x] 🟡 **落地页标题使用硬换行 `<br>`。** `landing-title` 内的 `<br>` 在小屏和中文（zh）下会造成尴尬折行。改用响应式排版（去掉硬 `<br>`，靠容器宽度自然换行）。

### 8.2 Loading / feedback / 反馈
- [x] 🟠 **缺少骨架屏（skeleton）。** 异步视图目前只显示纯文字（`lazy-fallback` 的「Loading…」、`dc-overlay` 文本、同步 toast）。为 Trade Atlas 面板、日历网格、Sidebar、Day 图表加入 shimmer 骨架占位，降低感知延迟并避免加载完成时的布局跳动（CLS）。
- [x] 🟠 **统一的 Toast / 通知系统。** 目前只有一个「每日同步」toast，其余成功/失败反馈（导入完成、CSV/PDF 导出、License 激活、「在所有设备登出」等）要么内联要么缺失。建立一套一致、可堆叠、可自动消失、`aria-live` 友好且支持手动关闭的通知组件，替换零散的 `ds-error` 等内联提示。
- [x] 🟡 **主 CTA 的微交互。** 按钮已有 hover 抬升，可再补充按下(`:active`)反馈，以及导入/激活成功后的短暂成功动画（对勾），增强「操作已生效」的确定感。

### 8.3 Accessibility & color / 可访问性与配色
- [x] 🟠 **盈亏仅靠颜色区分。** 日历单元格与热力图的填充是纯红/绿，色盲用户难以分辨（虽然 aria-label/tooltip 里已带 `formatMoneySigned`）。在视觉上叠加符号/形状/方向箭头，或提供「色盲友好调色板」开关，做到不单纯依赖颜色传达涨跌。
- [x] 🟠 **工具提示（tooltip）实现不统一。** 大量元素用原生 `title`（有延迟、无法定制样式、触屏不可见），而 `panel-info` 用的是自定义 `data-tip` 样式提示。统一为一套带样式、可访问、触屏可用的 tooltip 组件，替换散落的 `title=`。
- [x] 🟡 **暗色模式下 muted 文本的对比度。** 审核 `--muted` / `--text-2` 在 `--card`/`--bg` 上是否满足 WCAG AA（4.5:1，小字号），必要时微调令牌值（高对比模式已单独覆盖，此处针对默认主题）。
- [x] 🟡 **自定义控件的焦点可见性。** 全局 `focus-visible` 很好，但主题切换开关（`tt-track`/`tt-thumb`）、视图 tab pill 等自定义控件需确认键盘聚焦时有清晰可见的焦点环。

### 8.4 Polish / 一致性
- [x] 🟠 **图表不随强调色（accent）实时变色。** 切换 accent 预设后，recharts / lightweight-charts 的线条颜色要等刷新才更新（见 `useThemeColors` 仅监听 `data-theme`）。订阅 `THEME_PREF_EVENT`，让图表在改色时即时重绘，保证品牌色一致。
- [x] 🟡 **圆角/间距令牌未统一使用。** 存在大量一次性像素圆角（`cp-panel` 14px、9px、10px 等）与 `--radius`/`--radius-sm` 令牌并存。收敛到统一的半径/间距比例，提升整体视觉节奏一致性。
- [x] 🟡 **Firefox / 标准滚动条样式。** 目前只写了 `::-webkit-scrollbar`。补充标准的 `scrollbar-width` / `scrollbar-color`，让 Firefox 下的滚动条与整体风格一致。
- [x] 🟡 **reduced-motion 下仍绑定光标聚光。** 即便用户偏好减少动效，`pointermove` 的光标跟随聚光监听仍在运行。可在 `prefers-reduced-motion: reduce` 时跳过绑定，减少不必要的 JS 开销。

### 8.5 Landing / first impression / 落地页
- [x] 🟠 **落地页缺少产品视觉。** 首屏为纯文字（eyebrow + 标题 + 特性卡 + FAQ），没有产品截图或动效预览。加入日历/Atlas 的产品预览图或轻量循环 demo（仓库 `docs/*.png` 已有可复用的浅色/深色截图），显著提升首因印象与转化。
- [x] 🟡 **首屏 CTA 引导偏弱。** 目前仅有一行「上传提示」文案，没有醒目的主按钮（如「用示例数据体验」）。加入一个明确的主 CTA 按钮，降低新用户的上手门槛。

---

## 9. Testing & QA — 测试覆盖与质量

> 本轮审查发现测试是最大的空白领域。现有单元测试集中在纯函数 lib 模块，服务器端
> 覆盖良好（`api.test.cjs` + `server.test.cjs`，且已接入 `test:server`），但**前端
> 组件零测试**、多个含逻辑的 lib 模块无测试、且 e2e 关键旅程缺失。

### 9.1 组件与测试基建
- [x] 🔴 **完全没有 React 组件单元/渲染测试，也没有测试库依赖。** `package.json` 无 `@testing-library/react` / `jest-dom`，`vitest.config.ts` 未配置 `jsdom`/`happy-dom` 环境。引入 RTL + jsdom，先覆盖 `SettingsModal`、`ImportWizard`、`TradeTable`、`CommandPalette`、`ErrorBoundary`（空态、模态关闭/焦点陷阱、键盘快捷键、导出按钮、标签编辑、崩溃回退）。
- [x] 🟠 **多个含逻辑的 lib 模块无任何测试文件。** 至少为以下补测：`marketData.ts`（时区/RTH 过滤、空/坏时间戳、VWAP 零成交量、EMA）、`settings.ts`、`theme.ts`、`persist.ts`（配额、损坏 JSON、版本迁移）、`customTags.ts`、`userTags.ts`、`emotions.ts`、`holidays.ts`、`checkout.ts`，以及 hooks（`useFocusTrap`、`useThemeColors`、`useCountUp`）。

### 9.2 既有测试的边界用例缺口
- [x] 🟠 **`metrics.test.ts`：** 补 profitFactor/胜率的除零、`NaN`/`Infinity`/空字段、日聚合的时区边界、`entryTime`/`duration` 为空时的小时/持仓分析。
- [x] 🟠 **`parseWorkbook.test.ts`：** 补坏 buffer/不可读工作簿、近似重复（非完全一致）、歧义日期（`03/04/2026` 美式 vs 欧式）、数字列含文本、午夜跨越、带引号分隔符/内嵌换行/BOM 的 CSV、空表/仅表头。
- [x] 🟠 **`exportCsv.test.ts`：** 补全字段的换行/引号转义、非 ASCII、null/undefined 字段，以及更多注入向量（`-`、`@`、Tab、前导空格）——CSV 注入修复必须有回归测试锁定。
- [x] 🟡 **`dataHealth`/`tags`/`tagAnalytics`/`rules`/`reminders`/`goals`/`taxSummary` 测试：** 补空交易集、精确阈值/零连胜/单日月/闰日、大小写符号归一、年份边界、标点/空格变体等边界。

### 9.3 服务器测试补强（已有基础）
- [x] 🟠 **`auth.cjs` 直接分支未覆盖：** 邮箱/密码校验分支、注册冲突(409)、限流(429)、锁定 TTL 过期、弱新密码拒绝、reset token 过期、`signout-all` 跨多会话的 tokenVersion 失效、`setPlan` 计划元数据持久化与降级清理。
- [x] 🟡 **`sync.cjs` 未直接测试：** 补无效 JSON、超限 payload(413)、store 失败(500)、缺鉴权(401)、错误方法。
- [x] 🟡 **安全流程测试：** CORS 允许/拒绝、`OPTIONS`、Stripe 签名容差/重放、`ADMIN_TOKEN` 门禁、生产缺密钥拒绝启动路径。

### 9.4 E2E 覆盖缺口
- [x] 🟠 **关键旅程缺失（`e2e/app.spec.ts`）：** 补刷新后持久化、导出（CSV/税务/playbook）、设置/主题/语言切换、坏 localStorage 的错误恢复、重复导入跨会话、账户/云同步登录 happy path、空态旅程。
- [x] 🟡 **e2e 选择器脆弱。** 依赖 `.cal-cell.clickable`、`.settings-card` 等 CSS 类和随 i18n 变动的精确文案，易因改动而误报。尽量改用 role/`data-testid` 定位，并对内容/响应头做具体断言（避免「200 或 404 都行」这类弱断言）。

---

## 10. 本轮新发现 / Additional findings

- [x] 🟠 **`lib/metrics.ts` 硬编码中文标签（i18n bug）。** `edgeByField`(L207) 的 `'(未填写)'` 与 `edgeByHour`(L225) 的 `'未知'` 被直接用作图表分类标签，英文界面下也显示中文（Setup Edge、Hour Edge）。改为走 `t(...)` 或由调用方传入本地化的占位标签。
- [x] 🟡 **`lib/marketData.ts fetchIntraday` 与 `parseWorkbook.ts fetchGoogleSheetBuffer` 的 `fetch` 无超时/中断。** Yahoo 代理或 Google Sheet 慢响应时，Day 图表/同步会长时间挂起且无法取消。加入 `AbortController` + 超时（并在组件卸载时 abort），失败时给出友好提示。
- [x] 🟡 **`App.tsx` 每日自动加载会覆盖手动导入的数据。** `/data/trades.xlsx` 自动加载在 `loaded.length>0` 时无条件 `setTrades`+`savePersistedTrades`，可能用服务器工作簿覆盖用户刚上传/导入的更完整数据。明确数据优先级（如仅在无本地数据时自动加载，或提示用户选择）。
- [x] 🟡 **`App.tsx` 同步节流键过于乐观。** 每日同步在请求前就写入 `SYNC_KEY`（乐观），若标签页在同步中途关闭，则当天被标记为已同步而不再重试。改为成功后再落盘，或记录「进行中/完成」两态。
- [x] 🟡 **`lib/reminders.ts markDismissed` 仅保留最近 60 条 dismiss 记录。** 理论上超出后旧的「已忽略」会被遗忘导致重现；当前仅提醒最近交易日，实际影响很小。若将来扩展提醒类型，改为按时间戳过期而非按数量截断。

---

### Notes for executing agents
- Prefer the smallest targeted test/lint/build that covers the change: `npm test` (Vitest), `npm run test:server` (`node --test`), `npm run lint`, `npm run build`.
- Do not change the `LICENSE` or its commercialization note (owner decision — see README).
- Keep changes surgical; add/extend tests for every bug fix (especially CSV injection, time/date parsing, and the auth/store hardening items).

### 完成状态 / Completion status (all sections 1–10 done & ticked)
> 本轮已逐条实现并勾选全部条目，并通过 `npm run lint` / `npm test` (142) /
> `npm run test:server` (34) / `npm run build` / `npx playwright test` (12) 验证。
> 主要新增：`server/server.test.cjs` 与 `server/security.test.cjs`、`src/lib/safeStorage.ts`、
> `src/lib/fetchWithTimeout.ts`、`src/lib/toast.ts` + `Toaster`、`Tooltip`、`Skeleton`、
> RTL + jsdom 组件测试、Dependabot 配置、CI `npm audit` 步骤、Dockerfile digest 固定、
> 落地页示例数据 CTA 与产品预览图，以及色盲友好涨跌符号、统一 toast/tooltip、骨架屏等。
