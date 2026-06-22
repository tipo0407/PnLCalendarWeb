# PnL Calendar — Web

PnL Calendar 的网页版（React + TypeScript + Vite）。在浏览器里读取你的交易工作簿，
展示月历盈亏、12 个月活跃热力图、Portfolio Lens 侧边栏指标，以及 Trade Atlas 分析仪表盘。

桌面版（WPF）在 `../PnLCalendar`。网页版复用了相同的数据约定：
**只读取工作簿的第 3 个 sheet**，列名与桌面版一致。

## 功能

- **月历**：盈亏色块、交易笔数、节假日徽标、右侧每周汇总，左右箭头切换月份
- **12 个月热力图**：按当日盈亏强度着色，点击任意格子跳转到对应月份
- **Portfolio Lens 侧边栏**：年度总盈亏、权益曲线、胜率条、盈亏比、期望值、
  最佳/最差日、最佳周、月度盈亏条、最近 5 笔
- **Trade Atlas**：权益曲线、每日盈亏、胜负环形图、Setup 优势、时段优势、
  逐笔盈亏、盈亏分布直方图、关键指标
- **日详情弹窗**：当日每笔交易明细表

## 数据来源

两种方式：

1. **上传 `.xlsx`**（推荐，最可靠）：点击「上传 .xlsx」选择 `Trading.xlsx`。
2. **Google Sheet 链接**：粘贴链接后点击「Sync」。
   - 浏览器无法携带你的 Google 登录态，因此该表格必须设置为
     **「知道链接的任何人都可以查看」**，否则会返回 401。
   - 开发模式下通过 Vite 代理（`/gsheet`）绕过浏览器 CORS。

## 工作簿格式

读取第 3 个 sheet，首行表头需包含：

```
Date, EntryTime, ExitTime, NoOfDay, Duration, Direction, Symbol,
EntryPrice, ExitPrice, Size, PL, Setup, Reason&Emotion, APL, Note
```

- `Date` 为 Excel 日期序列号
- `EntryTime` / `ExitTime` / `Duration` 为 Excel 时间（一天的小数）
- `PL` 为每笔盈亏，`APL` 为累计盈亏，`NoOfDay` 为当日交易序号

## 开发

```powershell
cd C:\Users\yanlin\GHCPProject\PnLCalendarWeb
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 类型检查 + 生产构建
npm run lint     # ESLint
```

## 说明

Google Sheet 的同步依赖 Vite 开发代理，仅在 `npm run dev` 下可用。
若要部署为静态站点并支持私有表格同步，需要再加一个后端/Serverless 代理。
上传 `.xlsx` 的方式在任何部署下都可用。

## 技术栈

- React 19 + TypeScript + Vite
- SheetJS (`xlsx`) 解析工作簿
- Recharts 绘制图表
