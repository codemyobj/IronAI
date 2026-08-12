# IronAI 部署指南

从零到上线，完全免费部署 IronAI 全栈应用。

> **当前状态**：项目已采用 **Prisma ORM + Supabase PostgreSQL + Vercel Serverless** 架构，本文档反映最新部署流程。

---

## 📐 架构

```
浏览器 → https://iron-ai-one.vercel.app
    ├── /                  → React SPA（Vite 构建，Vercel 静态托管）
    ├── /login, /dashboard → React Router 客户端路由
    └── /api/*             → Vercel Serverless Function（Express API）
                                ↓
                           Prisma ORM（类型安全查询）
                                ↓
                           Supabase PostgreSQL（海外免费数据库，连接池模式）
                                ↓
                           DeepSeek API（AI 分析服务）
```

---

## 🗂️ 项目结构

```
IronAI/
├── api/                        # Vercel Serverless Function 入口
│   └── index.ts                # 导出 Express app
├── client/                     # React 前端（Vite + TypeScript）
│   ├── public/                 # PWA 图标、manifest.json
│   └── src/
│       ├── api/index.ts        # axios 实例 + JWT 拦截器
│       ├── components/         # Layout, Navbar, ProtectedRoute, LanguageSwitcher, Skeleton
│       ├── hooks/              # useAuth, useTraining, useDiet
│       ├── i18n/               # 国际化配置与语言包
│       ├── pages/              # Login, Register, Dashboard, Training, Diet, AIAnalysis
│       ├── test/setup.ts       # Vitest 测试 setup
│       ├── types/index.ts      # TypeScript 接口定义
│       ├── App.tsx             # 路由配置
│       └── index.css           # 完整样式系统（CSS 变量主题）
├── server/                     # Express 后端（Prisma ORM + TypeScript）
│   ├── prisma/schema.prisma    # Prisma 数据模型
│   ├── scripts/postinstall.js  # 安装后自动生成 Prisma Client
│   └── src/
│       ├── config/prisma.ts    # PrismaClient 单例（globalThis 缓存）
│       ├── app.ts              # Express 应用（不 listen，供 Vercel 和本地共用）
│       ├── index.ts            # 本地开发入口（app.listen）
│       ├── middleware/auth.ts  # JWT 认证中间件
│       ├── controllers/        # 业务逻辑（auth/training/diet/ai）
│       ├── routes/             # RESTful 路由
│       ├── services/deepseek.ts # DeepSeek AI 服务
│       ├── types/index.ts      # Prisma 派生类型 + 请求体类型
│       └── utils/format.ts     # 日期格式化工具
├── database/schema.sql         # 数据库建表 SQL（PostgreSQL，参考用）
├── docs/                       # 项目文档
├── .env.example                # 环境变量模板
├── .npmrc                      # pnpm 配置
├── pnpm-workspace.yaml         # pnpm 工作区配置
├── package.json                # 根 package.json（pnpm 工作区脚本）
└── vercel.json                 # Vercel 部署配置
```

---

## 🚀 第一部分：部署前端 + API 到 Vercel

### 1.1 推送代码到 GitHub

确保所有代码已推送到 GitHub 仓库：
```bash
git remote add origin https://github.com/你的用户名/IronAI.git
git push -u origin master
```

### 1.2 导入 Vercel

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录
2. 点击 **"New Project"** → 导入 `你的用户名/IronAI`
3. Vercel 会自动读取 [vercel.json](../vercel.json) 中的配置，无需修改
4. 点击 **"Deploy"**

### 1.3 部署配置文件说明

[vercel.json](../vercel.json)：
```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/dist",
  "installCommand": "cd server && npm install --no-audit --no-fund && cd ../client && npm install --no-audit --no-fund",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api).*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/index.ts": { "maxDuration": 30 }
  }
}
```

工作原理：
- 所有 `/api/*` 请求 → Vercel Serverless Function（Express API）
- 其他请求 → React SPA（`index.html`）
- 构建命令在 `client/` 目录执行 `vite build`
- 安装命令分别安装 `server/` 和 `client/` 的依赖（使用 npm，非 pnpm，避免 Vercel 构建环境兼容性问题）
- `--no-audit --no-fund` 跳过安全审计与资金提示，加快安装速度

> ⚠️ **重要**：根 `package.json` 中**不应**保留 `vercel-build` 脚本。Vercel 会优先执行该脚本而非 `vercel.json` 中的 `buildCommand`，若该脚本使用 `pnpm install`，会触发 `ERR_INVALID_THIS` 兼容性错误。

---

## 🗄️ 第二部分：Supabase PostgreSQL 数据库

### 方案：Supabase（海外免费 PostgreSQL）

| 特性 | 说明 |
|------|------|
| 费用 | **完全免费**（500MB 数据库，5GB 带宽/月） |
| 注册 | **需要 GitHub 账号** |
| 信用卡 | **不需要** |
| 数据库 | **PostgreSQL 15+** |
| 连接池 | 支持连接池模式（pooler，端口 6543） |
| 有效期 | 免费套餐，长期可用（7 天不活动会暂停，访问一次即恢复） |

### 2.1 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com)，用 GitHub 账号登录
2. 点击 **"New Project"**
3. 输入项目名称（如 `ironai`），设置数据库密码
4. 选择区域（建议 `US East` 或 `Singapore` 以获得更好的 Vercel 兼容性）
5. 点击 **"Create new project"**，等待初始化完成（约 1-2 分钟）

### 2.2 获取数据库连接信息

项目创建完成后：

1. 进入项目 → **Settings** → **Database**
2. 在 **Connection string** 区域，选择 **"Transaction pooler"** 模式
3. 点击 **"Copy"** 复制连接字符串
4. 格式如下：
   ```
   postgresql://postgres.你的项目ID:你的密码@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

> ⚠️ **必须使用连接池模式（Transaction Pooler，端口 6543）**，而非直连模式（端口 5432）。Serverless 环境下直连会因连接数限制而失败。
>
> ✅ **请在连接字符串末尾追加以下 5 个参数**（缺一不可）：
> ```
> ?pgbouncer=true&statement_cache_size=0&connection_limit=1&connect_timeout=15&pool_timeout=15
> ```
> - `pgbouncer=true` — 告知 Prisma 运行在 PgBouncer 之后，自动规避 PgBouncer 不支持的语句
> - `statement_cache_size=0` — **关键**，关闭 Prisma 客户端的 named prepared statement 缓存，解决 Vercel Serverless + PgBouncer 环境下出现的 `42P05 prepared statement "s3" already exists` 错误

### 2.3 运行建表 SQL

1. 进入项目 → **SQL Editor**
2. 点击 **"New query"**
3. 将 [database/schema.sql](../database/schema.sql) 中的内容粘贴进去
4. 点击 **"Run"** 执行建表语句

也可以通过本地客户端连接：
```bash
psql "postgresql://postgres.你的项目ID:你的密码@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

### 2.4 数据库表结构

| 表名 | 用途 | 关键约束 |
|------|------|---------|
| `users` | 用户账户 | 密码 bcrypt 加密，email 唯一 |
| `training_programs` | 训练计划模板 | 软删除（is_active），CASCADE 关联用户 |
| `exercises` | 计划中的训练动作 | CASCADE 关联计划，sort_order 排序 |
| `training_sessions` | 已完成的训练记录 | program_id 用 SET NULL（保留历史） |
| `diet_records` | 每日饮食记录 | 复合索引 (user_id, recorded_at) |
| `ai_analyses` | AI 分析结果缓存 | analysis_type CHECK 约束 |

> **Prisma Schema**：表结构定义在 [server/prisma/schema.prisma](../server/prisma/schema.prisma) 中，与数据库精确对齐。本项目**不使用 `prisma migrate`**，仅用 `prisma generate` 生成类型安全的查询客户端。

---

## 🔐 第三部分：环境变量

### Vercel 环境变量

在 Vercel Dashboard → **Settings → Environment Variables** 添加：

| Key | 说明 | 示例值 |
|-----|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串（**必须使用 Transaction Pooler + 5 个参数**） | `postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0&connection_limit=1&connect_timeout=15&pool_timeout=15` |
| `JWT_SECRET` | JWT 签名密钥（64位随机hex） | 用 `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` 生成 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-xxxxx` |

> ⚠️ 
> - `DATABASE_URL` 的密码中如有特殊字符，需要 URL 编码（`@` → `%40`, `#` → `%23` 等）
> - **必须使用连接池地址**（`pooler.supabase.com:6543`），而非直连地址（`db.xxx.supabase.co:5432`）
> - 必须包含 `statement_cache_size=0`，否则在高并发下会出现 `42P05 prepared statement "sX" already exists` 错误（PgBouncer 借还不同数据库连接时，Prisma 的命名 prepared statement 缓存冲突）
> - Prisma 在 [server/src/config/prisma.ts](../server/src/config/prisma.ts) 中通过 `globalThis` 缓存单例，并在运行时对 `DATABASE_URL` 自动补全 `pgbouncer` / `statement_cache_size` / `connection_limit` 等参数，做双保险

添加完成后，去 **Deployments** → 点击最新部署右边的 `...` → **Redeploy** 使变量生效。

---

## 🏠 第四部分：本地开发

### 4.1 环境准备

- **Node.js 18+**（需支持原生 `fetch`）
- **pnpm**（推荐）或 npm
- Git

> 💡 **无需本地安装 PostgreSQL**：开发阶段直接连接 Supabase 远程数据库即可。

### 4.2 安装 pnpm（如未安装）

```bash
npm install -g pnpm
```

### 4.3 配置环境变量

复制 [.env.example](../.env.example) 为 `server/.env`：
```bash
cp .env.example server/.env
```

编辑 `server/.env`（推荐配置）：
```env
# 后端端口（Vite proxy 默认指向 8080）
PORT=8080

# Supabase 连接池地址（推荐开发阶段直接使用远程数据库）
DATABASE_URL=postgresql://postgres.你的项目ID:你的密码@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0&connection_limit=1&connect_timeout=15&pool_timeout=15

# JWT 密钥（用 node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 生成）
JWT_SECRET=你的随机密钥

# DeepSeek API 密钥
DEEPSEEK_API_KEY=sk-你的密钥
```

> ℹ️ `.env.example` 中保留了 `DB_HOST` 等字段仅供历史参考，实际项目仅使用 `DATABASE_URL`（Prisma ORM 自动读取）。

### 4.4 启动项目

#### 方式一：pnpm 工作区（推荐）

在项目根目录：
```bash
pnpm install              # 安装所有工作区依赖（触发 postinstall 自动生成 Prisma Client）

# 终端 1：启动后端
pnpm dev:server           # http://localhost:8080

# 终端 2：启动前端
pnpm dev:client           # http://localhost:5173
```

#### 方式二：分别启动

```bash
# 终端 1：启动后端
cd server
npm install               # 自动触发 prisma generate
npm run dev               # http://localhost:8080

# 终端 2：启动前端
cd client
npm install
npm run dev               # http://localhost:5173
```

前端通过 [Vite proxy](../client/vite.config.ts) 将 `/api` 请求转发到 `localhost:8080`，无需处理 CORS。

---

## 📡 API 端点

### Auth（公开 + 认证混合）
| Method | Endpoint | 认证 | 说明 |
|--------|----------|------|------|
| POST | `/api/auth/register` | ❌ | 注册 |
| POST | `/api/auth/login` | ❌ | 登录 |
| GET | `/api/auth/me` | ✅ | 获取当前用户 |

### Training（需认证）
| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/training/programs` | 训练计划列表 |
| POST | `/api/training/programs` | 创建训练计划（可批量创建练习） |
| GET | `/api/training/programs/:id` | 查看计划（含练习列表） |
| PUT | `/api/training/programs/:id` | 更新计划 |
| DELETE | `/api/training/programs/:id` | 删除计划（软删除：is_active = false） |
| POST | `/api/training/programs/:programId/exercises` | 为计划添加练习 |
| DELETE | `/api/training/exercises/:exerciseId` | 删除练习 |
| GET | `/api/training/sessions` | 训练会话历史（默认 20 条） |
| POST | `/api/training/sessions` | 记录一次训练会话 |

### Diet（需认证）
| Method | Endpoint | 查询参数 | 说明 |
|--------|----------|---------|------|
| GET | `/api/diet/records` | `date=YYYY-MM-DD` | 某日饮食记录 |
| POST | `/api/diet/records` | — | 添加食物记录 |
| DELETE | `/api/diet/records/:id` | — | 删除记录 |
| GET | `/api/diet/summary` | `start=&end=` | 日期区间汇总统计（含每日明细） |

### AI（需认证）
| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/ai/training-analysis` | 训练数据分析（返回 Markdown） |
| POST | `/api/ai/diet-recommendation` | 饮食建议（返回 Markdown） |
| GET | `/api/ai/history` | 分析历史（可选 `?type=training\|diet` 过滤） |

### 其他
| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/health` | 健康检查（`{"status":"ok","timestamp":"..."}`） |

---

## 📱 PWA 部署验证

应用已配置 PWA，可"添加到主屏幕"在 iOS/Android 上获得原生 App 体验。

### 部署后验证步骤

1. **访问线上地址**：`https://iron-ai-one.vercel.app`
2. **查看页面源码**，确认 HTML `<head>` 中包含以下标签：
   ```html
   <link rel="manifest" href="/manifest.json" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
   <meta name="apple-mobile-web-app-title" content="IronAI" />
   <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
   <meta name="theme-color" content="#10b981" />
   ```
3. **iOS 添加到主屏幕**：Safari 打开 → 分享按钮 → "添加到主屏幕"
4. **Android 添加到主屏幕**：Chrome 菜单 → "添加到主屏幕"或"安装应用"

### PWA 资源清单

| 文件 | 用途 |
|------|------|
| [client/public/manifest.json](../client/public/manifest.json) | PWA 清单（应用名、图标、显示模式） |
| [client/public/icon-192.png](../client/public/icon-192.png) | PWA 图标 192×192 |
| [client/public/icon-512.png](../client/public/icon-512.png) | PWA 图标 512×512 |
| [client/public/apple-touch-icon.png](../client/public/apple-touch-icon.png) | iOS 主屏幕图标 |
| [client/public/app-icon.svg](../client/public/app-icon.svg) | SVG 矢量图标 |
| [client/index.html](../client/index.html) | HTML 模板（含 PWA meta 标签） |

---

## 🆓 免费额度说明

| 服务 | 免费额度 | 限制 |
|------|---------|------|
| **Vercel** | 100GB-小时/月 函数执行，100GB 带宽 | 函数最长 10s（本项目设 30s） |
| **Supabase** | 500MB 数据库，5GB 带宽/月 | 7 天不活动暂停，社区支持，无 SLA |
| **DeepSeek API** | 注册赠送额度 | 按 token 计费 |

> 所有服务在免费额度内使用，**不需要绑定信用卡**。

---

## 🔧 常见问题

### Q: 部署后访问 API 返回 500 错误？
检查 Vercel 环境变量是否正确设置，特别是 `DATABASE_URL`。进入 Vercel Dashboard → Functions → Logs 查看具体错误。

### Q: 数据库连接失败（self-signed certificate 错误）？
Supabase 使用自签名 SSL 证书。Prisma 在 `DATABASE_URL` 中默认处理 SSL，若仍报错，可在连接字符串添加 `&sslmode=require`，或设置环境变量 `NODE_TLS_REJECT_UNAUTHORIZED=0`（仅开发环境）。

### Q: 数据库连接被拒绝（Access denied）？
- 确认 Supabase 项目未暂停（免费项目 7 天不活动会暂停，访问一次即可恢复）
- 确认 `DATABASE_URL` 中的用户名和密码正确
- 确认使用的是连接池地址（`pooler.supabase.com`）和端口 `6543`

### Q: Prisma Client 未生成（`PrismaClientInitializationError`）？
- 本地：在 `server/` 目录运行 `npx prisma generate`
- Vercel：检查构建日志是否包含 `[postinstall] Prisma Client generated successfully`。若失败，确认 `server/package.json` 的 `postinstall` 脚本存在且 `prisma` 在 `dependencies` 中

### Q: 出现 `42P05 prepared statement "s1" / "s2" / "s3" already exists`？
**场景**：Vercel 部署成功，但 API 请求（登录、获取数据）返回 500，函数日志出现此错误。

**根因**：Supabase 连接池使用 PgBouncer Transaction Pooling，每次请求从池中借还不同的 PostgreSQL 连接。而 Prisma 默认缓存命名 prepared statement（`s1`/`s2`/`s3`…）并绑定到「客户端以为还在使用的连接」，当借到的新连接上该名称已被其他客户端注册时就会冲突。

**解决（双保险，任意其一或同时使用）**：
1. ✅ **首选（推荐）** — 在 Vercel 的 `DATABASE_URL` 环境变量中追加 `&statement_cache_size=0&pgbouncer=true`，完整形式：
   ```
   postgresql://postgres.你的项目ID:你的密码@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0&connection_limit=1&connect_timeout=15&pool_timeout=15
   ```
   修改后点击 **Redeploy**。
2. 代码层已内置兜底：[server/src/config/prisma.ts](../server/src/config/prisma.ts) 中的 `normalizeDatabaseUrl()` 会在 PrismaClient 构造时自动补齐 `pgbouncer=true`、`statement_cache_size=0` 等参数。如果方案 1 因缓存尚未生效，Redeploy 一次即可走到新代码。

**验证修复**：重新部署后执行一次登录请求。如果不再出现 `prepared statement` 错误，说明 prepared statement 已转为匿名（unnamed）模式，PgBouncer 借还连接时不会再冲突。

### Q: 前端构建报 TypeScript 错误（`noUnusedLocals`）？
- 未使用的局部变量必须删除（`_` 前缀只对参数有效，对局部变量无效）
- 测试文件中的 `beforeEach` 等全局 API 需在 [tsconfig.app.json](../client/tsconfig.app.json) 的 `types` 中添加 `"vitest/globals"`

### Q: AI 分析不可用？
- 确认 `DEEPSEEK_API_KEY` 已设置
- 检查 DeepSeek 账户余额
- AI 接口返回 502 表示 DeepSeek 服务不可用

### Q: 如何更新部署？
```bash
git add . && git commit -m "update" && git push origin master
```
Vercel 会自动检测 GitHub 推送并重新部署。也可以在 Vercel Dashboard 手动触发 Redeploy。

### Q: 如何在本地测试生产环境？
```bash
cd client && npm run build    # 构建前端到 client/dist
cd ../server && npm run dev   # 启动后端
# 然后访问 http://localhost:8080（后端通过 Vercel rewrites 托管前端静态文件）
```

---

## 📝 相关文件

- [vercel.json](../vercel.json) — Vercel 部署配置
- [.env.example](../.env.example) — 环境变量模板
- [database/schema.sql](../database/schema.sql) — 数据库建表 SQL（PostgreSQL）
- [server/prisma/schema.prisma](../server/prisma/schema.prisma) — Prisma 数据模型定义
- [server/src/config/prisma.ts](../server/src/config/prisma.ts) — PrismaClient 单例配置
- [server/scripts/postinstall.js](../server/scripts/postinstall.js) — Prisma Client 自动生成脚本
- [pnpm-workspace.yaml](../pnpm-workspace.yaml) — pnpm 工作区配置
- [client/vite.config.ts](../client/vite.config.ts) — Vite 配置（含 /api 代理）
