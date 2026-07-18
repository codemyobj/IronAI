# IronAI 部署指南

从零到上线，完全免费部署 IronAI 全栈应用。

---

## 📐 架构

```
浏览器 → https://ironai-tan.vercel.app
    ├── /                  → React SPA（Vite 构建，Vercel 静态托管）
    ├── /login, /dashboard → React Router 客户端路由
    └── /api/*             → Vercel Serverless Function（Express API）
                                ↓
                           PolarDB-X Zero（阿里云免费 MySQL，100% 兼容）
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
│       ├── config/db.ts        # MySQL 连接（支持 DATABASE_URL + SSL）
│       ├── middleware/auth.ts   # JWT 认证中间件
│       ├── controllers/        # 业务逻辑
│       ├── routes/             # RESTful 路由
│       ├── services/deepseek.ts # DeepSeek AI 服务
│       └── types/index.ts      # 服务端类型
│
├── api/index.ts                # Vercel Serverless Function 入口
├── database/schema.sql         # 数据库建表 SQL
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

## 🗄️ 第二部分：免费 MySQL 数据库

### 方案：PolarDB-X Zero（阿里云）

| 特性 | 说明 |
|------|------|
| 费用 | **完全免费** |
| 注册 | **无需注册** |
| 信用卡 | **不需要** |
| 兼容性 | **100% MySQL 8.0** |
| 配置 | 2核 4GB |
| 有效期 | 最长 30 天（可续） |

### 2.1 创建数据库

1. 打开 [zero.polardbx.com](https://zero.polardbx.com)
2. 点击 **"创建实例"**，选择 MySQL 8.0
3. 记录连接信息：
   - 主机地址（Host）
   - 端口（Port）
   - 用户名（Username）
   - 密码（Password）

### 2.2 运行建表 SQL

使用 MySQL 客户端连接并执行：

```bash
mysql -h <主机地址> -P <端口> -u <用户名> -p'<密码>'
```

然后执行 [database/schema.sql](database/schema.sql) 中的建表语句。

也可以通过代码连接（示例）：
```js
const mysql = require('mysql2/promise');
const conn = await mysql.createConnection({
  host: '<主机地址>',
  port: <端口>,
  user: '<用户名>',
  password: '<密码>',
  ssl: { rejectUnauthorized: false }
});
await conn.execute('CREATE DATABASE IF NOT EXISTS ironai CHARACTER SET utf8mb4');
await conn.execute('USE ironai');
// 执行 schema.sql 中的 CREATE TABLE 语句...
```

### 2.3 数据库表结构

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
| `DATABASE_URL` | MySQL 连接字符串 | `mysql://user:pass@host:3306/ironai` |
| `JWT_SECRET` | JWT 签名密钥（64位随机hex） | 用 `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` 生成 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-xxxxx` |

> ⚠️ `DATABASE_URL` 的密码中如有特殊字符，需要 URL 编码（`@` → `%40`, `#` → `%23` 等）

添加完成后，去 **Deployments** → 点击最新部署右边的 `...` → **Redeploy** 使变量生效。

---

## 🏠 第四部分：本地开发

### 4.1 环境准备

- Node.js 18+
- MySQL 8.0
- Git

### 4.2 创建本地数据库

```bash
mysql -u root -p < database/schema.sql
```

### 4.3 配置环境变量

复制 `server/.env.example` 为 `server/.env`：
```bash
cp server/.env.example server/.env
```

编辑 `server/.env`：
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的本地MySQL密码
DB_NAME=ironai
JWT_SECRET=生成一个随机字符串
DEEPSEEK_API_KEY=你的DeepSeek密钥
```

### 4.4 启动项目

```bash
# 终端 1：启动后端
cd server
npm install
npm run dev        # http://localhost:3000

# 终端 2：启动前端
cd client
npm install
npm run dev        # http://localhost:5173
```

前端通过 Vite proxy 将 `/api` 请求转发到 `localhost:3000`，无需处理 CORS。

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
| **PolarDB-X Zero** | 2核 4GB MySQL | 最长 30 天，需续期 |
| **DeepSeek API** | 注册赠送额度 | 按 token 计费 |

> 所有服务在免费额度内使用，**不需要绑定信用卡**。

---

## 🔧 常见问题

### Q: 部署后访问 API 返回 500 错误？
检查 Vercel 环境变量是否正确设置，特别是 `DATABASE_URL`。

### Q: 数据库连接失败？
- 确认 PolarDB-X 实例未过期（最多 30 天）
- 确认 `DATABASE_URL` 格式正确：`mysql://user:password@host:port/database`
- PolarDB-X 需要 SSL 连接，配置中已默认开启

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
# 然后访问 http://localhost:3000（后端直接托管前端静态文件）
```

---

## 📝 相关文件

- [PROJECT_PLAN.md](PROJECT_PLAN.md) — 完整学习计划和项目说明
- [vercel.json](vercel.json) — Vercel 部署配置
- [.env.example](.env.example) — 环境变量模板
- [database/schema.sql](database/schema.sql) — 数据库建表 SQL
