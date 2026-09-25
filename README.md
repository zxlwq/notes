# 个人笔记系统

基于React的现代化Markdown笔记应用，支持客户端加密、多平台部署与多后端存储。

<p align="center">
  <img src="./logo.webp" alt="notes" />
</p>

<p align="center">
  <a href="https://reactjs.org/">
    <img src="https://img.shields.io/badge/React-18.3-lightblue.svg?logo=react&logoColor=61DAFB" alt="React">
  </a>
  <a href="https://vitejs.dev/">
    <img src="https://img.shields.io/badge/Vite-7.1.9-violet.svg?logo=vite&logoColor=646CFF" alt="Vite">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.4-blue.svg?logo=typescript&logoColor=3178C6" alt="TypeScript">
  </a>
  <a href="https://github.com/zxlwq/notes">
    <img src="https://img.shields.io/badge/GitHub-Repo-black.svg?logo=github&logoColor=black" alt="GitHub Repo">
  </a>
  <a href="https://pages.cloudflare.com/">
    <img src="https://img.shields.io/badge/Cloudflare-Pages-orange.svg?logo=cloudflare&logoColor=F38020" alt="Cloudflare Pages">
  </a>
  <a href="https://vercel.com/">
    <img src="https://img.shields.io/badge/Vercel-Deploy-black.svg?logo=vercel&logoColor=black" alt="Vercel">
  </a>
  <a href="https://pages.edgeone.ai/">
    <img src="https://img.shields.io/badge/EdgeOne-Pages-blue.svg?logo=cloudflare&logoColor=blue" alt="EdgeOne Pages">
  </a>
</p>

![notes](./notes.webp)

---

## 功能特性

| 类别 | 能力                                                                       |
| ---- | -------------------------------------------------------------------------- |
| 编辑 | SimpleMDE 编辑；详情/公开分享页统一 react-markdown（GFM + 高亮 + Mermaid） |
| 组织 | 标签、拖拽排序、高级搜索、列表分页与无限滚动                               |
| 分享 | 公开链接（明文快照 + token）；可选有效期；撤销；过期自动写入 `revoked_at`  |
| 安全 | 登录鉴权、客户端AES-GCM加密、JWT会话                                       |
| 同步 | WebDAV/GitHub Gist / Cloudflare R2备份；D1→PG 含 `note_shares`             |
| 体验 | PWA 可安装、离线读写笔记、多标签页编辑冲突提示、移动端顶栏菜单             |
| 部署 | Cloudflare Pages、Vercel、EdgeOne Pages、Docker                            |

---

## 技术栈

| 层级 | 选型                                                                      |
| ---- | ------------------------------------------------------------------------- |
| 前端 | React、TypeScript、Vite、Tailwind CSS                                     |
| 编辑 | SimpleMDE、react-markdown + remark-gfm + remark-breaks + rehype-highlight |
| 后端 | D1数据库 + PostgreSQL；Serverless / Edge Functions 适配多平台             |
| 共享 | `shared/`统一鉴权、笔记CRUD、备份、分页、迁移逻辑                         |
| 离线 | vite-plugin-pwa（可安装 + 静态预缓存）；IndexedDB 离线笔记库与待同步队列  |

### PWA与离线

生产环境须 **HTTPS** 方可安装为 PWA；`npm run dev` 开发模式无 Service Worker。

| 项       | 行为                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| 可安装   | manifest 含 `192×192` / `512×512` PNG（`public/icons/`）；`display: standalone`         |
| 静态壳   | JS/CSS/HTML、图标等由 Service Worker 预缓存，可离线打开应用界面                         |
| API 缓存 | `/api/*` 走 NetworkOnly（不缓存 API 响应）                                              |
| 离线读   | IndexedDB `notes-offline` 存全文；列表/详情/编辑可读已缓存笔记；搜索索引 `notes-search` |
| 离线写   | 新建/编辑/删除写入 IndexedDB 并入队；恢复联网后自动同步（底部 OfflineBar 提示）         |
| 详情加速 | IndexedDB 与列表 `updatedAt` 一致时跳过 API；否则先展示缓存再后台刷新                   |
| 更新     | 小版本自动刷新；**主版本号**变更时底部提示条，用户确认后刷新                            |
| Mermaid  | 独立 chunk，仅在详情页遇到 ` ```mermaid ` 代码块时按需加载                              |

**前提**：至少在线使用过一次以填充本地缓存；须保持登录态（JWT 在 localStorage）。

---

# 项目结构

## 总览

```
notes/
├── src/                      # React 前端 SPA
├── shared/                   # 多后端共享业务逻辑（Node ESM）
├── server/                   # Express 后端（本地 / Docker / 自托管）
├── api/                      # Vercel Serverless Functions
├── functions/                # Cloudflare Pages Functions（D1）
├── workers/                  # 独立 Cloudflare Workers（如 log-cron 定时任务）
│   └── log-cron/             # worker.js：D1 清理日志 + 撤销过期分享；Pages 经 LOG_CRON 绑定调用
├── edge-functions/           # EdgeOne / Hugging Face 边缘函数（Neon）
├── public/                   # 静态资源（构建时复制到 dist/）
│   ├── icons/                # PWA 图标 192.png、512.png
│   ├── boot.js
│   └── _headers              # Cloudflare Pages 安全头
├── .github/workflows/        # CI/CD（Docker、备份、HF Spaces）
├── scripts/
│   └── d1-schema.sql         # Cloudflare D1 初始建表
├── index.html                # Vite 入口 HTML
├── vite.config.ts            # Vite + PWA 配置
├── docker-compose.yml
├── Dockerfile
├── vercel.json               # Vercel 路由与构建
├── edgeone.json              # EdgeOne Pages 配置
└── .env.example              # 环境变量模板
```

## 前端 `src/`

```
src/
├── main.tsx                  # 应用入口、PWA 注册、离线同步、外观初始化
├── App.tsx                   # 路由与布局（含公开 `/s/:token`）
├── index.css                 # 全局样式
├── vite-env.d.ts             # Vite / PWA 类型声明
│
├── pages/                    # 页面级组件（React Router）
│   ├── Login.tsx             # 登录 / 恢复码重置
│   ├── List.tsx              # 笔记列表、搜索、无限滚动
│   ├── View.tsx              # 笔记详情
│   ├── Edit.tsx              # 笔记编辑、多标签冲突检测、AI 助手
│   ├── Share.tsx             # 公开分享页 `/s/:token`（无需登录）
│
├── components/               # 业务组件
│   ├── Editor.tsx            # SimpleMDE 编辑器
│   ├── Editor.css
│   ├── Toolbar.tsx           # Markdown 格式工具栏
│   ├── ShareDialog.tsx       # 创建/复制/撤销公开分享
│   ├── ai/
│   │   └── Panel.tsx         # 编辑页 AI 助手（总结/建议/润色/扩写/续写/标签等）
│   ├── Settings.tsx          # 设置弹窗（外观、备份、密码）
│   ├── Modal.tsx             # 通用 / 确认 / 输入 / 选择模态框（portal 至 body）
│   ├── Advanced.tsx          # 高级搜索（标题/标签/正文）
│   ├── Card.tsx              # 笔记卡片（含分享入口）
│   ├── Mermaid.tsx           # Mermaid 图表渲染
│   ├── OfflineBar.tsx        # 离线状态 / 待同步提示条
│   ├── SwUp.tsx              # PWA 主版本更新提示
│   ├── Protected.tsx         # 路由鉴权守卫
│   ├── BackTop.tsx           # 回到顶部
│   ├── Boundary.tsx          # 错误边界
│   │
│   ├── view/                 # 详情页子组件
│   │   ├── Bar.tsx           # 顶栏（移动端折叠菜单）
│   │   ├── Meta.tsx          # 标题、标签、时间元信息、分享入口
│   │   ├── Md.tsx            # Markdown 渲染（GFM + 高亮 + Mermaid + TOC）
│   │   ├── Md.css
│   │   └── Toc.tsx           # 目录（移动端折叠 / 桌面侧栏）
│   │
│   ├── settings/             # 设置弹窗子模块
│   │   ├── Backup.tsx        # 导入 / 导出 / 云备份
│   │   ├── Pwd.tsx           # 改密 / 恢复码
│   │   ├── Recovery.tsx      # 恢复码一次性展示（复制 / 下载）
│   │   ├── Import.tsx        # 文件导入预览
│   │   ├── Logs.tsx          # 后端日志查看
│   │   └── logTr.ts          # 日志消息中文化
│   │
│   └── ui/                   # 通用 UI 原子组件
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Loading.tsx
│       └── Preload.tsx
│
├── lib/                      # 工具与 API 封装
│   ├── api.ts                # axios 客户端、notesApi / authApi / cloudApi / shareApi
│   ├── ai.ts                 # aiApi、provider/model 本地记忆
│   ├── client.ts             # axios 实例（api / offlineSync 共用，避免循环依赖）
│   ├── edIns.ts              # 工具栏 / AI 编辑器插入与选区
│   ├── crypto.ts             # AES-GCM 加解密（内存密钥）
│   ├── session.ts            # JWT 会话读写
│   ├── notes.ts              # 列表摘要缓存（session/localStorage）
│   ├── offline.ts            # IndexedDB 离线笔记库与待同步队列
│   ├── offlineSync.ts        # 联网后刷新待同步队列
│   ├── search.ts             # 客户端高级搜索（按需拉正文）
│   ├── searchIdx.ts          # 搜索索引 IndexedDB（notes-search）
│   ├── markdown.ts           # 统一 react-markdown 管道（remark-gfm/breaks + rehype）
│   ├── mdView.ts             # 详情 TOC / 展示用 Markdown 预处理
│   ├── backup.ts             # 导入导出格式转换
│   ├── reencrypt.ts          # 改密后全库重加密
│   ├── noteSync.ts           # 多标签页编辑锁 / BroadcastChannel
│   ├── listRefresh.ts        # 列表静默刷新间隔
│   ├── viewScroll.ts         # 详情页标签/高亮滚动、复制提示 toast
│   ├── utils.ts              # 通用工具（slugify、debounce 等）
│   └── webp.ts               # 背景图加载
│
├── hooks/
│   ├── Trap.ts               # 模态框焦点陷阱、Esc 关闭
│   ├── Modal.ts              # 模态框状态 hook
│   ├── Monitor.ts            # 性能/可见性监控
│   └── Storage.ts            # localStorage 封装
│
├── contexts/
│   └── Context.tsx           # 认证 Context（登录态、解锁）
│
└── types/
    └── index.ts              # Note、AppSettings、API 类型
```

## 共享层 `shared/`

四套后端共用的纯 Node 逻辑：

```
shared/
├── auth-node.js              # checkAuth（Cookie / Bearer JWT）
├── session.js                # JWT 签发/校验、恢复码哈希
├── notes.js                  # 笔记 DTO 映射、导入规范化
├── shares.js                 # 公开分享：token、有效期、DTO、建表 SQL
├── d1-shares.js              # D1 note_shares CRUD / 过期撤销
├── pg-shares.js              # PostgreSQL note_shares
├── neon-shares.js            # Neon note_shares
├── sql.js                    # PostgreSQL SQL 语句常量
├── pg-notes.js               # Express pool 笔记 CRUD + 分页
├── neon-notes.js             # Neon tagged-template 笔记 CRUD + replaceAllNotes
├── d1-notes.js               # Cloudflare D1 笔记 CRUD + 分页
├── d1-migrate.js             # D1 schema_migrations / 索引（含 note_shares）
├── d1-logRet.js              # D1 logs 过期清理
├── webdav.js                 # WebDAV 备份拉取/上传
├── gist.js                   # GitHub Gist API（fetch，四后端共用）
├── gist-store.js             # gist_id 存储（PG / D1 / Neon）
├── r2.js                     # R2 S3 签名与上传/下载
├── pagination.js             # page/limit 解析与响应封装
├── backup.js                 # Markdown ↔ JSON 备份解析
├── migrate.js                # schema_migrations 版本迁移（含 note_shares）
├── cors.js                   # CORS 解析（ALLOWED_ORIGINS / Origin 回显）
├── d1-pg-sync.js             # Cloudflare D1 → PostgreSQL 跨平台同步（含 note_shares）
├── logRet.js                 # logs 表过期清理
├── rateLimit.js              # 进程内滑动窗口限流（含公开分享 GET）
├── ai/                       # AI 代理（provider、prompt、Cloudflare REST/绑定）
│   ├── handlers.js           # getAiStatus / handleAiComplete
│   ├── providers.js
│   ├── models.js             # model 列表解析与白名单校验
│   ├── openai.js
│   ├── cloudflare.js
│   ├── cloudflare-binding.js
│   ├── prompts.js
│   ├── validate.js
│   └── complete.js
└── util.js                   # safeJsonParse 等工具
```

## Express 后端 `server/`

```
server/
├── index.js                  # Express 入口、CSP/HTTPS、静态 dist
├── context.js                # 数据库连接、initDatabase、鉴权中间件
├── routes/
│   ├── auth.js               # 登录、改密、恢复码、会话
│   ├── notes.js              # 笔记 CRUD + 分页
│   ├── share.js              # 公开分享创建 / 读取 / 撤销 / 按笔记列表
│   ├── backup.js             # WebDAV 备份
│   ├── gist.js               # GitHub Gist 备份
│   ├── r2.js                 # Cloudflare R2 备份
│   ├── order.js              # 笔记/标签排序持久化
│   ├── logs.js               # 日志查询与清空
│   └── ai.js                 # AI 状态与 completion 代理
└── services/
    ├── gist.js               # Gist API 调用
    └── r2.js                 # R2 S3 兼容 API 调用
```

## Vercel `api/`

文件路径即 HTTP 路由（Neon + `shared/` 薄适配）：

```
api/
├── _utils/                   # auth、pg 连接、session
├── _services/                # gist/r2 备份（对齐 server/services）
├── login.js / logout.js / session.js
├── password.js / password/status.js
├── recovery/status.js / setup.js / reset.js
├── notes.js / notes/[id].js / notes/[id]/shares.js
├── share.js / share/[token].js
├── import.js / logs.js
├── backup.js / gist.js / r2.js
├── ai/status.js / ai/complete.js
├── cron/logs.js              # 清理过期日志 + 撤销过期分享
└── order/[key].js
```

## Cloudflare Pages `functions/`

TypeScript Workers 风格，绑定 D1（`NOTESD`）：

```
functions/
├── types.ts
├── _utils/                   # auth、log、session
└── api/                      # 与 Vercel 路由一一对应
    ├── notes.ts / notes/[id].ts / notes/[id]/shares.ts
    ├── share.ts / share/[token].ts
    ├── login.ts / backup.ts / gist.ts / r2.ts
    ├── ai/status.ts / ai/complete.ts
    ├── cron/logs.ts          # 清理过期日志 + 撤销过期分享（可经 LOG_CRON）
    └── recovery/ …
```

## EdgeOne / HF `edge-functions/`

Neon 数据库 + 与 `api/` 同构的路由：

```
edge-functions/
├── _utils/
│   ├── auth.js / session.js
│   ├── log.js
│   └── logger.js             # 生产环境 trace() 静默日志
├── services/
│   ├── neonNotes.js          # 重导出 shared/neon-notes（兼容旧引用）
│   ├── gist.js               # Gist 备份/恢复（Neon）
│   └── r2.js                 # R2 备份/恢复（Neon）
└── api/                      # 路由结构同 api/，薄 HTTP 适配（含 ai/status、ai/complete）
```

## CI

```
.github/workflows/
├── docker.yml                # Docker 镜像构建推送
├── backup.yml                # 定时备份
└── notes-api.yml             # Hugging Face Spaces部署
```

## 架构

前端为统一SPA，按部署目标对接不同 API 目录：

```mermaid
flowchart LR
    FE["src/ React SPA"]

    FE --> Local["server/ Express"]
    FE --> CF["functions/ D1"]
    FE --> Vercel["api/ Neon"]
    FE --> EO["edge-functions/ Neon"]

    Local --> PG[(PostgreSQL)]
    Vercel --> Neon[(Neon)]
    EO --> Neon
    CF --> D1[(Cloudflare D1)]
```

| 目录              | 适用平台                                 |
| ----------------- | ---------------------------------------- |
| `server/`         | 本地开发、Docker、Render、Koyeb 等自托管 |
| `api/`            | Vercel                                   |
| `functions/`      | Cloudflare Pages                         |
| `edge-functions/` | EdgeOne Pages、Hugging Face Spaces       |

四套后端均复用 `shared/`，保证笔记、备份、鉴权行为一致。

---

# 客户端加密

启用加密后，标题、正文、标签在浏览器端 AES-GCM 加密后上传，服务端仅存密文。

- 笔记加密密钥来自环境变量 `NOTE_KEY`，与管理员登录密码无关。登录成功后写入当前标签页 `sessionStorage`：刷新后自动解锁；关闭标签页、主动退出或自动锁屏后需重新登录以取回密钥
- **改密码**：只改管理员登录密码，不会重加密笔记。见下方[修改密码](#修改密码)
- 历史明文笔记在首次打开时自动迁移为密文

## 修改密码

管理员密码和笔记加密密钥互不依赖。`NOTE_KEY` 只在环境变量里配置；设置页改密不会改它，改 `NOTE_KEY` 也不会改登录密码。

**生成 `NOTE_KEY`（Base64 口令，不是 `TOKEN` 那种 32 字节十六进制）：**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

这条命令每次都会得到新的 Base64 字符串，不要把 `TOKEN` 的值抄过来，也不要和 `PASSWORD`、`JWT_SECRET` 相同。写入 `.env` 或平台环境变量：`NOTE_KEY=生成结果`。已有加密笔记时不要重新生成，须沿用当初的密钥。

管理员密码有两个来源，**同时有效**：

| 来源                | 如何修改                                   | 登录时                     |
| ------------------- | ------------------------------------------ | -------------------------- |
| 环境变量 `PASSWORD` | 改部署平台上的 `PASSWORD` 后重新部署或重启 | 当前环境变量里的值可以登录 |
| 设置页              | 设置 → 修改密码，填写当前密码和新密码      | 设置页保存的新密码可以登录 |

当前密码填环境变量里的密码，或上一次在设置页改成的密码，都可以。

| 步骤            | 说明                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 保持登录     | 已登录即可，不要求先解锁笔记                                                                                                                         |
| 2. 填写密码     | 当前管理员密码 + 至少 6 位的新密码，点「确定」                                                                                                       |
| 3. 只改登录密码 | 服务端校验当前密码后写入新的密码哈希，**不会**重加密笔记                                                                                             |
| 4. 双库一致     | Cloudflare Pages 若配置了 `DATABASE_URL`，会**立即**把 `password` / `password_set` / `password_version`（及恢复码）同步到 PostgreSQL，再异步全量同步 |
| 5. 重新登录     | 约 3 秒后退出。用新的管理员密码登录；笔记仍用原来的 `NOTE_KEY` 解密                                                                                  |

已有加密笔记时，把 `NOTE_KEY` 设成**当初用来加密的那个密码**（以前登录密码和加密密钥是同一个）。之后再改管理员密码，不要改 `NOTE_KEY`，否则旧笔记无法解密。

**不要用恢复码代替改密来保护笔记。** 恢复码同样只重置登录密码。

## 搜索与索引

笔记启用加密后，**服务端无法对正文做全文检索**（库中仅为密文）。搜索在浏览器本地完成：

- 解锁后后台将解密后的标题/标签/正文写入 **IndexedDB**（`src/lib/searchIdx.ts` → `notes-search`），避免每次搜索逐条 `GET /api/notes/:id`
- 在线浏览/保存时全文亦写入 **离线笔记库**（`src/lib/offline.ts` → `notes-offline`），供离线读写与详情加速
- 首次进入列表或搜索时会预热索引；保存/删除笔记会同步更新索引与离线库
- 退出登录会清空本地搜索索引与离线笔记库
- 搜索结果支持分页（`searchNotesPaged`）；正文建议项带 **snippet** 摘要

未加密部署理论上可在服务端做 FTS，但当前产品以客户端索引为主，与 E2E 加密模型一致。

---

## 忘记密码 / 恢复码

在设置 → 密码面板中可生成一次性恢复码（格式 `XXXX-XXXX-XXXX-XXXX`）。生成后请立即复制或下载 `.txt` 保存，关闭弹窗后无法再次查看。

| 步骤    | 说明                                                  |
| ------- | ----------------------------------------------------- |
| 1. 生成 | 设置 → 修改密码 →「生成恢复码」；重新生成会使旧码失效 |
| 2. 保存 | 复制到剪贴板或下载 `.txt`，离线妥善保管               |
| 3. 重置 | 登录页「忘记密码？使用恢复码」→ 输入恢复码与新密码    |

**重要限制**：恢复码只重置**登录密码**。笔记加密密钥是环境变量 `NOTE_KEY`，恢复码和设置页改密都不会改变它。

## 备份格式

| 格式     | 说明                                                                    |
| -------- | ----------------------------------------------------------------------- |
| JSON     | 完整对象数组（`id`、`title`、`content`、`tags`、时间戳），导入/导出推荐 |
| Markdown | 以 `---` 分隔，含 YAML 元数据                                           |
| 纯文本   | 仅标题与正文                                                            |

WebDAV / Gist / R2 云端备份均使用 **Markdown** 文件 `notes.md`（`parseBackupToNotes` 解析时也支持 JSON 数组格式）。

## 自动备份

定时任务把当前库中的笔记依次上传到 **WebDAV**、**Cloudflare R2**、**GitHub Gist**。三路都会执行；任意一路失败则任务失败并输出该接口响应。全部成功后才发送通知。

| 目标          | 接口               | Pages 侧前提                                 |
| ------------- | ------------------ | -------------------------------------------- |
| WebDAV        | `POST /api/backup` | `WEBDAV_URL` / `WEBDAV_USER` / `WEBDAV_PASS` |
| Cloudflare R2 | `POST /api/r2`     | 绑定 R2 桶，变量名 `NOTESR`                  |
| GitHub Gist   | `POST /api/gist`   | `GIT_TOKEN`                                  |

鉴权为 `Authorization: Bearer <TOKEN>`，与 Cloudflare Pages 环境变量 `TOKEN` 相同。未配置 `TOKEN` 时定时调用会被拒绝。

### GitHub Actions

[`.github/workflows/backup.yml`](.github/workflows/backup.yml) 每天 UTC 0 点运行，也可在 Actions 页手动触发。仓库 Secrets：

| Secret         | 说明                        |
| -------------- | --------------------------- |
| `TOKEN`        | 与 Pages 的 `TOKEN` 相同    |
| `TG_BOT_TOKEN` | 成功后的 Telegram Bot Token |
| `TG_USER_ID`   | Telegram 用户 ID            |

换域名时改工作流里的站点地址。自建站点不要沿用示例域名。

### 青龙面板

[`scripts/ql-backup.js`](scripts/ql-backup.js) 供青龙定时任务使用（文件头 cron 为 `0 1 * * *`）。命令：`task ql-backup.js`。

| 环境变量                      | 必填 | 说明                                                                      |
| ----------------------------- | ---- | ------------------------------------------------------------------------- |
| `TOKEN` 或 `BACKUP_TOKEN`     | ✅   | 与 Pages 的 `TOKEN` 相同                                                  |
| `NOTES_BASE_URL`              | ❌   | 站点地址，Pages域名 `https://项目名.pages.dev`                            |
| `TG_BOT_TOKEN` / `TG_USER_ID` | ❌   | Telegram 通知；未配置则跳过                                               |
| `WXPUSH_URL` / `API_TOKEN`    | ❌   | WXPush：`POST {WXPUSH_URL}/wxsend`，请求头 `Authorization` 为 `API_TOKEN` |

三路成功后分别打印 Telegram、WXPush 是否推送成功。通知发送失败时任务以失败退出。未配置的通知渠道只打印跳过，不影响备份结果。

---

# 本地开发

## 环境要求

- Node.js 20+
- PostgreSQL 15+（或Docker启动数据库）

## 快速开始

```bash
git clone https://github.com/zxlwq/notes.git
cd notes
npm install
cp .env.example .env   # 填写 PASSWORD、DATABASE_URL
```

启动数据库（Docker 示例）：

```bash
docker compose up postgres -d
```

单终端启动前后端：

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`（Vite HMR；`/api` 代理至后端 `http://localhost:3000`）。

仅需单独调试某一端时：

```bash
npm run dev:server   # 仅后端
npm run dev:client   # 仅前端
```

> 后端启动时会自动建表、执行 `shared/migrate.js` 版本迁移，按 `LOG_RETENTION_DAYS`（默认 30 天）清理过期日志，并撤销已过期的公开分享（写入 `revoked_at`）。

## 常用命令

| 命令                    | 说明                                            |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | 同时启动前后端（单终端）                        |
| `npm run dev:client`    | 仅 Vite 前端开发服务器                          |
| `npm run dev:server`    | 仅 Express 后端（读取 `.env`）                  |
| `npm run build`         | 构建前端至 `dist/`                              |
| `npm run preview`       | 预览构建产物                                    |
| `npm start`             | 生产模式后端（需先 `build`）                    |
| `npm run check`         | 类型 + Lint + Prettier + parity + Markdown 回归 |
| `npm run test:markdown` | 详情页 Markdown 管道回归检测                    |

## Docker 一键部署

```bash
docker compose up -d
```

应用默认 `http://localhost:3000`（内置 PostgreSQL + Express）。请在项目根目录 `.env` 中配置 `PASSWORD`、`JWT_SECRET`、`POSTGRES_PASSWORD`；启用 AI 时另配 `.env.example` 中 AI 相关变量（Docker Compose 已透传至容器）。

---

# API 摘要

| 方法            | 路径                         | 说明                                                                        |
| --------------- | ---------------------------- | --------------------------------------------------------------------------- |
| GET             | `/api/notes`                 | 笔记摘要列表（不含正文）                                                    |
| GET             | `/api/notes?page=1&limit=30` | 分页列表，返回 `{ items, total, page, limit, hasMore }`                     |
| GET             | `/api/notes/:id`             | 单条笔记（含正文）                                                          |
| POST/PUT/DELETE | `/api/notes`                 | 创建 / 更新 / 删除                                                          |
| GET             | `/api/notes/:id/shares`      | 该笔记未撤销且未过期的公开分享列表（需登录）                                |
| POST            | `/api/share`                 | 创建公开分享（明文快照；需登录；body 含 `noteId` / 标题正文 / `expiresIn`） |
| GET             | `/api/share/:token`          | 公开读取分享内容（**无需登录**；过期/撤销返回 410；有速率限制）             |
| DELETE          | `/api/share/:token`          | 撤销分享（需登录）                                                          |
| POST            | `/api/import`                | 批量导入                                                                    |
| GET/POST        | `/api/backup`                | WebDAV 云备份                                                               |
| GET/POST        | `/api/gist`                  | GitHub Gist 备份                                                            |
| GET/POST        | `/api/r2`                    | Cloudflare R2 备份（Pages 绑定桶；其它平台 S3 API）                         |
| POST            | `/api/login`                 | 登录，返回 JWT                                                              |
| POST            | `/api/logout`                | 退出登录                                                                    |
| GET             | `/api/session`               | 查询当前会话是否有效                                                        |
| GET/POST        | `/api/settings/:key`         | 读取 / 保存 UI 设置（当前仅 `theme`；GET 公开，POST 需登录）                |
| POST            | `/api/password`              | 修改登录密码（需已登录）                                                    |
| GET             | `/api/password/status`       | 密码存储来源（env / D1 / PostgreSQL）                                       |
| GET             | `/api/recovery/status`       | 是否已配置恢复码                                                            |
| POST            | `/api/recovery/setup`        | 生成恢复码（一次性返回明文，需已登录）                                      |
| POST            | `/api/recovery/reset`        | 用恢复码重置密码（无需登录；有速率限制）                                    |
| GET             | `/api/sync`                  | 查询 D1→PostgreSQL 同步是否已配置（Cloudflare Pages）                       |
| POST            | `/api/sync`                  | 手动全量同步 D1 至 `DATABASE_URL`（需已登录）                               |
| GET             | `/api/ai/status`             | AI 是否可用、provider 列表与 model 白名单（需已登录）                       |
| POST            | `/api/ai/complete`           | AI 笔记助手（总结/建议/润色/扩写/续写/标签等；需已登录）                    |
| GET/POST        | `/api/cron/logs`             | 清理过期日志，并批量撤销过期公开分享（建议 `TOKEN`）                        |

所有写操作需携带有效会话（`Authorization: Bearer <token>` 或 Cookie）。`/api/login`、`/api/recovery/reset`、**公开** `GET /api/share/:token` 除外。

前端路由：`/s/:token` 为公开分享页（与 `GET /api/share/:token` 对应，无需登录）。

---

# 公开分享

在列表卡片或详情页点「分享」，可创建**公开链接**（路径形如 `/s/<token>`）。

| 项       | 说明                                                                |
| -------- | ------------------------------------------------------------------- |
| 存储     | 服务端表 `note_shares` 保存**明文快照**（创建时的标题/正文/标签）   |
| 有效期   | `1d` / `7d` / `30d` / `never`（默认 7 天）                          |
| 更新     | 之后修改笔记**不会**更新已分享内容；需重新创建链接                  |
| 撤销     | 弹窗内可撤销；删除笔记时级联撤销该笔记全部未撤销分享                |
| 过期     | 访问或列表时懒撤销；每日 cron / Express 启动时批量写入 `revoked_at` |
| 加密笔记 | 客户端先解密再提交快照；公开页展示的是创建时刻的明文                |
| 安全提示 | 拿到链接即可阅读，请勿分享含敏感信息的快照                          |

---

# 多平台部署

| 平台                | 数据库 | API 目录          | 必填配置                                                                                           | R2 备份（可选）             |
| ------------------- | ------ | ----------------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| Cloudflare Pages    | D1     | `functions/`      | `PASSWORD` + 绑定 `NOTESD`；可选绑定 `AI`（Workers AI）+ `CF_MODEL_NAME`；可选 `DATABASE_URL` 同步 | 绑定 R2 桶变量 `NOTESR`     |
| Vercel              | Neon   | `api/`            | `PASSWORD` + `DATABASE_URL`                                                                        | `ACCOUNT_ID` + R2 API Token |
| EdgeOne Pages       | Neon   | `edge-functions/` | `PASSWORD` + `DATABASE_URL`                                                                        | 同上                        |
| Hugging Face Spaces | Neon   | `server/`         | GitHub Actions 注入 env                                                                            | 同上                        |
| Docker / 自托管     | Neon   | `server/`         | `PASSWORD` + `DATABASE_URL`                                                                        | 同上（写入 `.env`）         |

## Cloudflare Pages

1. Fork 仓库，创建 D1 数据库 `notes`
2. 执行建表 SQL（[`scripts/d1-schema.sql`](scripts/d1-schema.sql)；亦可依赖首次 API 访问时的自动迁移）
3. Pages 绑定 D1，名称 `NOTESD`
4. 设置环境变量 `PASSWORD`、`JWT_SECRET`；需要加密笔记时再设 `NOTE_KEY`（Base64 口令，不要用 `TOKEN` 那种十六进制，也不要和 `PASSWORD`、`JWT_SECRET`、`TOKEN` 相同）
5. **（可选）AI**：Pages → Settings → Functions → Bindings → **Workers AI**，变量名 `AI`；再设环境变量 `CF_MODEL_NAME`（如 `@cf/meta/llama-3.1-8b-instruct`）。绑定方式无需 `CF_API_KEY`；未绑定时可改用 REST（`CF_API_KEY` + `CF_ACCOUNT_ID` + `CF_MODEL_NAME`）
6. **（可选）跨平台同步**：在 [Neon](https://neon.tech/) 创建数据库，将连接串写入Pages环境变量 `DATABASE_URL`。D1仍为读写主库；笔记、密码设置、排序等变更会异步同步至PostgreSQL。迁移到Vercel/Docker时复用同一 `DATABASE_URL` 即可保留数据
7. **PWA**：自定义域名已启用 HTTPS 时，Chrome/Edge 可「安装应用」；离线新建笔记同步时 POST 支持客户端 `id`（与 `shared/d1-notes.js` upsert 对齐）

```bash
# 本地 wrangler 示例（将 <DATABASE_NAME> 换成你的 D1 名称）
npx wrangler d1 execute <DATABASE_NAME> --file=./scripts/d1-schema.sql
```

R2备份（可选）：在Pages **绑定R2存储桶**，绑定变量名 **`NOTESR`**（名称可自定）。使用Workers原生R2绑定，**无需**配置 `ACCOUNT_ID` / API Token。

**同步说明**：配置 `DATABASE_URL` 后，写操作（增删改笔记、导入、云备份恢复、改密、保存主题、创建/撤销分享等）会通过 `waitUntil` 异步推送全量快照至PostgreSQL。也可调用 `POST /api/sync` 手动触发。同步范围：`notes`、`settings`（含密码哈希/恢复码，以及 `theme`）、`order_data`、`note_shares`（不含 `logs`）。**改密 / 恢复码重置 / 生成恢复码**会额外**同步等待**将 `password`、`password_set`、`password_version`、`recovery_hash` 写入 PostgreSQL，保证 D1 与 PG 管理员凭据一致。

- **冲突策略**：以 **D1为唯一写入源**；PG仅接收D1全量快照，同id/key行被覆盖，D1 中已删行在PG侧同步删除。
- **失败重试**：后台同步失败时自动重试最多 3 次；仍失败则打日志，可 `POST /api/sync` 手动补偿。

1. **部署Worker日志清理** [worker.js](#cloudflare-r2-备份) 绑定与Pages相同的 D1

2. **Pages 绑定 Worker** Pages 项目 → **Settings → Functions → Service bindings**：
   - 变量名：`LOG_CRON`
   - 服务：`notes-log-cron`

3. Pages 环境变量：`TOKEN`（可选，与 Worker 一致）、`LOG_RETENTION_DAYS`（默认 7）

Worker 每日 UTC 03:00 自动清理过期日志并撤销过期公开分享；Pages 经 Service Binding 调用 `/api/cron/logs` 时走内网转发至 Worker。仍可在设置页或已登录 `POST /api/logs` 手动清理日志。

## Vercel

1. 创建 Neon 数据库，获取 `DATABASE_URL`
2. 导入仓库，配置 `PASSWORD`、`DATABASE_URL`
3. （可选）配置 R2 备份：见下方 [Cloudflare R2 备份](#cloudflare-r2-备份)
4. 部署

## EdgeOne Pages

1. 创建 [Neon](https://neon.tech/) 数据库
2. 连接 GitHub 仓库，配置 `PASSWORD`、`DATABASE_URL`；可选 `LOG_RETENTION_DAYS`（默认 7）
3. （可选）配置 R2 备份：见下方 [Cloudflare R2 备份](#cloudflare-r2-备份)
4. 部署（`edgeone.json` 的 `schedules` 每日 UTC 03:00 调用 `/api/cron/logs` 清理过期日志并撤销过期分享）

> EdgeOne 定时任务无法附带 `Authorization`。若设置了 `TOKEN`，平台 Cron 会 401；可用外部 Cron 带 `Bearer`，或暂时不设 `TOKEN`。

## Hugging Face Spaces

使用 [.github/workflows/notes-api.yml](.github/workflows/notes-api.yml) 通过 GitHub Actions 创建 Docker Space，并注入 `PASSWORD`、`JWT_SECRET`、`DATABASE_URL` 等环境变量（生产环境 `JWT_SECRET` 必填，与登录密码独立）。可选在 workflow 的 `r2_config` 输入中注入 R2 API Token（格式见 workflow 注释）。

### Docker / 自托管

与[本地开发 · Docker 一键部署](#docker-一键部署)相同。生产环境请在 `.env` 中配置 `PASSWORD`、`DATABASE_URL`，并按需填写 WebDAV / Gist / R2 变量（见 [.env.example](.env.example)）。

## Cloudflare R2 备份

R2 可在**任意部署平台**使用，但接入方式分两种：

| 部署方式                      | 配置方法                                                    | 说明                                                                       |
| ----------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Cloudflare Pages**          | 绑定 R2 桶，绑定变量名 `NOTESR`                             | `functions/api/r2.ts` 通过 `env.NOTESR` 读写；桶名称可自定义，无需 S3 密钥 |
| **Vercel / EdgeOne / Docker** | 环境变量 `ACCOUNT_ID`、`ACCESS_KEY_ID`、`SECRET_ACCESS_KEY` | `shared/r2.js` 通过 R2 **S3 兼容 API** 访问名为 **`notes`** 的桶           |

**其它平台配置步骤**（Vercel、EdgeOne、Docker 等）：

1. 创建 R2 API Token（需对该桶具备读写权限），记录 Access Key ID 与 Secret Access Key
2. 在部署平台配置环境变量：
   - `ACCOUNT_ID` — Cloudflare 账户 ID（Dashboard 右侧可见）
   - `ACCESS_KEY_ID` — R2 API Token 的 Access Key
   - `SECRET_ACCESS_KEY` — R2 API Token 的 Secret Key
3. 确保运行环境能出站访问 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

备份文件固定为桶内 `notes.md`（Markdown）。设置页「Cloudflare R2 → 上传到 R2 / 从 R2 下载」调用 `GET/POST /api/r2`。

---

# 环境变量

完整示例见 [.env.example](.env.example)。

| 变量                                                 | 必填 | 说明                                                                                                                            |
| ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| `PASSWORD`                                           | ✅   | 管理员登录密码。改环境变量后，该新密码可登录；设置页改过的密码同样可登录                                                        |
| `NOTE_KEY`                                           | ❌   | 笔记加密密钥，与 `PASSWORD` 独立。未设置则笔记明文存储。已有密文时必须与当初的密钥一致                                          |
| `JWT_SECRET`                                         | ✅   | 会话JWT签名密钥（独立随机串，**勿与 `PASSWORD` 相同**）                                                                         |
| `DATABASE_URL`                                       | ✅   | PostgreSQL/Neon连接串；Cloudflare Pages可选，用于 D1→PG 同步                                                                    |
| `SESSION_TTL_SEC`                                    | ❌   | 会话JWT有效期（秒），默认 604800（7 天）                                                                                        |
| `ALLOWED_ORIGINS`                                    | ❌   | 生产CORS白名单（逗号分隔）；未设置则回显 Origin                                                                                 |
| `LOG_RETENTION_DAYS`                                 | ❌   | 日志保留天数，默认 30（Express / Pages / Cron 端点）                                                                            |
| `TOKEN`                                              | ❌   | `/api/cron/logs` Bearer 密钥（清理日志 + 撤销过期分享）；Vercel Cron；CF Pages/Worker；EdgeOne 平台 Cron 无法附带（见部署说明） |
| `DEBUG`                                              | ❌   | Edge函数调试日志（`true` 开启）                                                                                                 |
| `WEBDAV_URL/USER/PASS`                               | ❌   | WebDAV 备份                                                                                                                     |
| `GIT_TOKEN`                                          | ❌   | GitHub Gist 备份                                                                                                                |
| `ACCOUNT_ID`                                         | ❌   | R2 账户 ID（**非 Pages** 平台 S3 API 备份必填其一组）                                                                           |
| `ACCESS_KEY_ID`                                      | ❌   | R2 API Token Access Key                                                                                                         |
| `SECRET_ACCESS_KEY`                                  | ❌   | R2 API Token Secret Key                                                                                                         |
| `AI_PROVIDER`                                        | ❌   | 提供商白名单（`openai` / `ark` / `kilo` / `cf` / `zhipu` / `gh`）；留空=全部已配置项；多个用逗号或 `\|` 分隔                    |
| `OPENAI_*` / `ARK_*` / `KILO_*` / `ZHIPU_*` / `GH_*` | ❌   | 各 OpenAI 兼容提供商的 Key、Base URL、Model（见 `.env.example`）                                                                |
| `CF_API_KEY` / `CF_ACCOUNT_ID` / `CF_MODEL_NAME`     | ❌   | Cloudflare Workers AI **REST**（Docker/Express 等）；Pages 可改绑 `AI`                                                          |
| `AI_RATE_LIMIT_MAX`                                  | ❌   | AI 请求每 IP 限流次数，默认 20                                                                                                  |
| `AI_RATE_LIMIT_WINDOW_SEC`                           | ❌   | AI 限流窗口（秒），默认 3600                                                                                                    |
| `AI_MAX_INPUT_CHARS`                                 | ❌   | 单次 AI 请求正文上限，默认 32000                                                                                                |

> **AI**：编辑页「AI 助手」调用 `/api/ai/*`，Key 仅存服务端；面板可切换已配置的 provider 与 model（`AI_PROVIDER` 白名单 / `*_MODEL_NAME` 逗号列表）。Cloudflare Pages 推荐绑定 Workers AI（变量 `AI`）+ `CF_MODEL_NAME`。详见 [AI.md](AI.md)。
>
> **R2 备份**：Cloudflare Pages 在 Dashboard **绑定 R2 桶 `NOTESR`** 即可，无需上表三个变量。Vercel / EdgeOne / Docker / Express 需配置 `ACCOUNT_ID` + API Token，且 R2 桶名须为 **`notes`**。详见 [Cloudflare R2 备份](#cloudflare-r2-备份)。
>
> Vercel / EdgeOne / Docker 必填 `DATABASE_URL`。Cloudflare Pages 默认用 D1 绑定 `NOTESD`；若需跨平台迁移，额外配置 `DATABASE_URL` 启用同步。
>
> 生产环境均强制 `JWT_SECRET`；本地开发可仅用 `PASSWORD`。

---

# 运维说明

- **数据库迁移**
  - Express / Vercel（PostgreSQL）：`shared/migrate.js` 维护 `schema_migrations`，Express 启动或 Vercel Cron 执行时自动建索引与 `note_shares`
  - Cloudflare D1：`shared/d1-migrate.js` 与 PG 版对齐；首次笔记/分享/日志 API 访问时自动执行，也可手动执行 [`scripts/d1-schema.sql`](scripts/d1-schema.sql)
- **日志与过期分享清理**（日志默认保留天数见 `LOG_RETENTION_DAYS`）
  - Express：启动时调用 `shared/logRet.js`，并 `revokeExpiredShares` 撤销过期分享
  - Vercel Cron：每日 03:00 请求 `/api/cron/logs`（建议设置 `TOKEN`）— 清理日志 + 撤销过期分享
  - Cloudflare Pages：独立 Worker `notes-log-cron`（Cron + D1）；Pages **Service Binding** `LOG_CRON` 内网调用；或已登录 `POST /api/logs` / 设置页手动清理日志
  - EdgeOne Pages：`edgeone.json` → `schedules` 每日 UTC 03:00 触发 `/api/cron/logs`（Neon）；平台 Cron 无法带 Bearer，设 `TOKEN` 时需外部调用
  - 公开分享另在 **访问 / 列表** 时懒撤销过期项（写入 `revoked_at`）
  - 设置页仍可手动清空全部日志

  **生成 `TOKEN`（可选）：**

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

  写入 `.env` 或平台环境变量：

  ```bash
  TOKEN=your-random-cron-secret
  ```

  **手动触发过期日志清理与分享撤销**（将 `YOUR_DOMAIN`、`YOUR_TOKEN` 替换为实际值；未设置 `TOKEN` 时可省略 `Authorization` 头）：

  ```bash
  # Express / Vercel / EdgeOne Pages
  curl -X POST "https://YOUR_DOMAIN/api/cron/logs" \
    -H "Authorization: Bearer YOUR_TOKEN"

  # 本地 Express（dev:server）
  curl -X POST "http://localhost:3000/api/cron/logs" \
    -H "Authorization: Bearer YOUR_TOKEN"

  # Cloudflare Worker（独立 notes-log-cron）
  curl -X POST "https://notes-log-cron.YOUR_SUBDOMAIN.workers.dev/cleanup" \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```

  EdgeOne 若已设置 `TOKEN`，可用 GitHub Actions、系统 Cron 等外部调度执行上述 `curl`；或 EdgeOne 部署时不设 `TOKEN`，依赖平台内置 `schedules`。

- **生产安全（可选）**
  - CORS：四后端统一 `shared/cors.js`；设 `ALLOWED_ORIGINS=https://你的域名` 限制跨域
  - 会话：Cookie `SameSite=Strict` + HttpOnly；JWT 支持 `SESSION_TTL_SEC` 缩短有效期
  - 限流：登录/恢复码为进程内滑动窗口；**AI** 单独限流（`AI_RATE_LIMIT_*`）；公开分享 `GET /api/share/:token` 有独立限流；多实例不共享，高流量可接 Redis 或 [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- **Edge 日志**：生产环境默认静默，设 `DEBUG=true` 或 `ENVIRONMENT=development` 开启

---

# 如果您喜欢这个项目，请给一个 ⭐ 星标！
