# IronAI 部署指南

从零到上线，完全免费部署 IronAI 全栈应用。

---

## 📐 架构

```
浏览器 → https://iron-ai-one.vercel.app
    ├── /                  → React SPA（Vite 构建，Vercel 静态托管）
    ├── /login, /dashboard → React Router 客户端路由
    └── /api/*             → Vercel Serverless Function（Express API）
                                ↓
                           Supabase PostgreSQL（海外免费数据库）
```

---

## 🗂️ 项目结构

```
IronAI/
├── client/                     # React 前端（Vite + TypeScript）
│   ├── src/
│   │   ├── api/index.ts        # Axios 实例 + JWT 拦截器
│   │   ├── components/         # Layout, Navbar, ProtectedRoute
│   │   ├── hooks/              # useAuth, useTraining, useDiet
│   │   ├── pages/              # Login, Register, Dashboard, Training, Diet, AIAnalysis
│   │   ├── types/index.ts      # TypeScript 接口定义
│   │   ├── App.tsx             # 路由配置
│   │   └── index.css           # 完整样式系统（~700行）
│   └── vite.config.ts          # Vite 配置 + /api 代理
│
├── server/                     # Express 后端（Node.js + TypeScript）
│   └── src/
│       ├── app.ts              # Express 应用（不 listen，供 Vercel 和本地共用）
│       ├── index.ts            # 本地开发入口（app.listen）
│       ├── config/db.ts        # PostgreSQL 连接（pg.Pool，支持 DATABASE_URL + SSL）
│       ├── middleware/auth.ts   # JWT 认证中间件
│       ├── controllers/        # 业务逻辑
│       ├── routes/             # RESTful 路由
│       ├── services/deepseek.ts # DeepSeek AI 服务
│       └── types/index.ts      # 服务端类型
│
├── api/index.ts                # Vercel Serverless Function 入口
├── database/schema.sql         # 数据库建表 SQL（PostgreSQL 语法）
├── vercel.json                 # Vercel 部署配置
├── .env.example                # 环境变量模板
├── DEPLOY.md                   # 本文档
└── PROJECT_PLAN.md             # 学习计划
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
3. Vercel 会自动读取 `vercel.json` 中的配置，无需修改
4. 点击 **"Deploy"**

### 1.3 部署配置文件说明

[vercel.json](vercel.json)：
```json
{
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "installCommand": "cd server && npm install && cd ../client && npm install",
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
- 安装命令同时安装 `server/` 和 `client/` 的依赖

---

## 🗄️ 第二部分：Supabase PostgreSQL 数据库

### 方案：Supabase（海外免费 PostgreSQL）

| 特性 | 说明 |
|------|------|
| 费用 | **完全免费**（500MB 数据库，5GB 带宽/月） |
| 注册 | **需要 GitHub 账号** |
| 信用卡 | **不需要** |
| 数据库 | **PostgreSQL 15** |
| 连接池 | 支持连接池模式（pooler） |
| 有效期 | 免费套餐，长期可用 |

### 2.1 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com)，用 GitHub 账号登录
2. 点击 **"New Project"**
3. 输入项目名称（如 `ironai`），设置数据库密码
4. 选择区域（建议 `US East` 或 `Singapore` 以获得更好的 Vercel 兼容性）
5. 点击 **"Create new project"**，等待初始化完成（约 1-2 分钟）

### 2.2 获取数据库连接信息

项目创建完成后：

1. 进入项目 → **Settings** → **Database**
2. 在 **Connection string** 区域，点击 **"Copy"** 复制连接字符串
3. 格式如下：
   ```
   postgresql://postgres.你的项目ID:你的密码@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

> ⚠️ **推荐使用连接池模式（pooler）**，端口为 `6543`，而不是直连模式的 `5432`。连接池模式更适合 Serverless 环境。

### 2.3 运行建表 SQL

1. 进入项目 → **SQL Editor**
2. 点击 **"New query"**
3. 将 [database/schema.sql](database/schema.sql) 中的内容粘贴进去
4. 点击 **"Run"** 执行建表语句

也可以通过本地客户端连接：
```bash
psql "postgresql://postgres.你的项目ID:你的密码@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

### 2.4 数据库表结构

| 表名 | 用途 |
|------|------|
| `users` | 用户账户（密码 bcrypt 加密） |
| `training_programs` | 训练计划模板 |
| `exercises` | 计划中的训练动作 |
| `training_sessions` | 已完成的训练记录 |
| `diet_records` | 每日饮食记录 |
| `ai_analyses` | AI 分析结果缓存 |

---

## 🔐 第三部分：环境变量

在 Vercel Dashboard → **Settings → Environment Variables** 添加：

| Key | 说明 | 示例值 |
|-----|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串（使用连接池模式） | `postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | JWT 签名密钥（64位随机hex） | 用 `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` 生成 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-xxxxx` |

> ⚠️ 
> - `DATABASE_URL` 的密码中如有特殊字符，需要 URL 编码（`@` → `%40`, `#` → `%23` 等）
> - 生产环境已在 `db.ts` 中配置 `ssl: { rejectUnauthorized: false }`，以兼容 Supabase 的自签名证书

添加完成后，去 **Deployments** → 点击最新部署右边的 `...` → **Redeploy** 使变量生效。

---

## 🏠 第四部分：本地开发

### 4.1 环境准备

- Node.js 18+
- PostgreSQL 15+（本地安装或使用 Supabase 远程数据库）
- Git

### 4.2 配置环境变量

复制 `.env.example` 为 `server/.env`：
```bash
cp .env.example server/.env
```

编辑 `server/.env`：
```env
PORT=8080

DB_HOST=localhost
DB_PORT=5432
DB_USER=ironai_user
DB_PASSWORD=你的本地数据库密码
DB_NAME=ironai

# 或者直接使用 Supabase 远程数据库（推荐开发阶段使用）
# DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

JWT_SECRET=生成一个随机字符串
DEEPSEEK_API_KEY=你的DeepSeek密钥
```

> 💡 **快捷方式**：开发阶段可以直接使用 Supabase 远程数据库，无需本地安装 PostgreSQL。只需设置 `DATABASE_URL` 即可。

### 4.3 启动项目

```bash
# 终端 1：启动后端
cd server
npm install
npm run dev        # http://localhost:8080

# 终端 2：启动前端
cd client
npm install
npm run dev        # http://localhost:5173
```

前端通过 Vite proxy 将 `/api` 请求转发到 `localhost:8080`，无需处理 CORS。

---

## 📡 API 端点

### Auth（公开）
| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 获取当前用户（需认证） |

### Training（需认证）
| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/training/programs` | 训练计划列表 |
| POST | `/api/training/programs` | 创建训练计划 |
| GET | `/api/training/programs/:id` | 查看计划（含动作） |
| PUT | `/api/training/programs/:id` | 更新计划 |
| DELETE | `/api/training/programs/:id` | 删除计划（软删除） |
| POST | `/api/training/programs/:id/exercises` | 添加动作 |
| DELETE | `/api/training/exercises/:id` | 删除动作 |
| GET | `/api/training/sessions` | 训练历史 |
| POST | `/api/training/sessions` | 记录训练 |

### Diet（需认证）
| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/diet/records?date=YYYY-MM-DD` | 某日饮食 |
| POST | `/api/diet/records` | 添加食物 |
| DELETE | `/api/diet/records/:id` | 删除记录 |
| GET | `/api/diet/summary?start=&end=` | 周报统计 |

### AI（需认证）
| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/ai/training-analysis` | 训练分析 |
| POST | `/api/ai/diet-recommendation` | 饮食建议 |
| GET | `/api/ai/history` | 分析历史 |

### 其他
| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/health` | 健康检查 |

---

## 🆓 免费额度说明

| 服务 | 免费额度 | 限制 |
|------|---------|------|
| **Vercel** | 100GB-小时/月 函数执行，100GB 带宽 | 函数最长 10s（本项目设 30s） |
| **Supabase** | 500MB 数据库，5GB 带宽/月 | 社区支持，无 SLA |
| **DeepSeek API** | 注册赠送额度 | 按 token 计费 |

> 所有服务在免费额度内使用，**不需要绑定信用卡**。

---

## 🔧 常见问题

### Q: 部署后访问 API 返回 500 错误？
检查 Vercel 环境变量是否正确设置，特别是 `DATABASE_URL`。

### Q: 数据库连接失败（self-signed certificate 错误）？
Supabase 使用自签名 SSL 证书。生产环境已在 `db.ts` 中配置 `ssl: { rejectUnauthorized: false }`。如果你在本地开发遇到此问题，可以：
- 本地开发设置 `NODE_ENV=development` 跳过 SSL 验证
- 或在连接字符串中添加 `?sslmode=require`

### Q: 数据库连接被拒绝（Access denied）？
- 确认 Supabase 项目未暂停（免费项目 7 天不活动会暂停，访问一次即可恢复）
- 确认 `DATABASE_URL` 中的用户名和密码正确
- 确认使用的是连接池地址（`pooler.supabase.com`）和端口 `6543`

### Q: AI 分析不可用？
- 确认 `DEEPSEEK_API_KEY` 已设置
- 检查 DeepSeek 账户余额

### Q: 如何更新部署？
```bash
git add . && git commit -m "update" && git push origin master
```
Vercel 会自动检测 GitHub 推送并重新部署。也可以手动触发：
```bash
npx vercel --prod
```

### Q: 如何在本地测试生产环境？
```bash
cd client && npm run build    # 构建前端
cd ../server && npm run dev   # 启动后端
# 然后访问 http://localhost:8080（后端直接托管前端静态文件）
```

---

## 📝 相关文件

- [PROJECT_PLAN.md](PROJECT_PLAN.md) — 完整学习计划和项目说明
- [vercel.json](vercel.json) — Vercel 部署配置
- [.env.example](.env.example) — 环境变量模板
- [database/schema.sql](database/schema.sql) — 数据库建表 SQL（PostgreSQL）
- [server/src/config/db.ts](server/src/config/db.ts) — 数据库连接配置（pg.Pool）