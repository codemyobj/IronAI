# IronAI 后端实现文档

> 本文档详细说明 IronAI 服务端（`server/`）的架构设计、目录结构、各模块实现细节、数据库设计与部署策略，供团队成员快速熟悉后端代码库。

## 目录

- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [双入口架构](#双入口架构)
- [Express 应用配置](#express-应用配置)
- [数据库与 Prisma ORM](#数据库与-prisma-orm)
- [认证中间件](#认证中间件)
- [路由层](#路由层)
- [控制器层](#控制器层)
- [DeepSeek AI 服务](#deepseek-ai-服务)
- [类型定义](#类型定义)
- [工具函数](#工具函数)
- [Vercel 部署](#vercel-部署)
- [环境变量](#环境变量)
- [开发命令](#开发命令)
- [关键技术决策](#关键技术决策)

---

## 技术栈

| 类别 | 选型 | 版本 |
|------|------|------|
| 运行时 | Node.js | ≥ 18（需支持原生 `fetch`） |
| Web 框架 | Express | 5.2 |
| 语言 | TypeScript | 6.0 |
| ORM | Prisma | 5.22 |
| 数据库 | PostgreSQL（Supabase） | 15+ |
| 认证 | JWT（jsonwebtoken） | 9.0 |
| 密码哈希 | bcryptjs | 3.0 |
| AI 服务 | DeepSeek API（OpenAI 兼容） | — |
| 跨域 | cors | 2.8 |
| 环境变量 | dotenv | 17.4 |
| 开发运行时 | tsx | 4.22 |

---

## 目录结构

```
server/
├── prisma/
│   └── schema.prisma         # Prisma 数据模型定义
├── scripts/
│   └── postinstall.js        # 安装后钩子：生成 Prisma Client
├── src/
│   ├── config/
│   │   └── prisma.ts         # PrismaClient 单例
│   ├── controllers/
│   │   ├── authController.ts # 注册/登录/获取当前用户
│   │   ├── trainingController.ts # 训练计划/练习/会话管理
│   │   ├── dietController.ts # 饮食记录/汇总统计
│   │   └── aiController.ts   # AI 分析与历史记录
│   ├── middleware/
│   │   └── auth.ts           # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.ts           # /api/auth/*
│   │   ├── training.ts       # /api/training/*
│   │   ├── diet.ts           # /api/diet/*
│   │   └── ai.ts             # /api/ai/*
│   ├── services/
│   │   └── deepseek.ts       # DeepSeek API 封装与系统提示词
│   ├── types/
│   │   └── index.ts          # 共享类型定义（Prisma 派生 + 请求体）
│   ├── utils/
│   │   └── format.ts         # 日期格式化工具
│   ├── app.ts                # Express 应用（共享入口）
│   └── index.ts              # 本地开发启动入口
├── package.json
└── tsconfig.json
```

---

## 双入口架构

后端采用**共享 app + 双入口**的设计，同一份 Express 代码同时服务本地开发与 Vercel 生产环境。

### 1. 共享应用 — [src/app.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/app.ts)

```typescript
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import trainingRoutes from './routes/training'
import dietRoutes from './routes/diet'
import aiRoutes from './routes/ai'

dotenv.config()

const app = express()

// CORS 配置
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
}))

app.use(express.json())

// 路由挂载
app.use('/api/auth', authRoutes)
app.use('/api/training', trainingRoutes)
app.use('/api/diet', dietRoutes)
app.use('/api/ai', aiRoutes)

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
```

**关键点**：
- **只配置应用，不启动服务器** — `app.ts` 不调用 `app.listen()`，仅 `export default app`
- **CORS 白名单** — 开发环境允许 Vite dev server（5173 端口），生产环境同域无需 CORS
- **dotenv.config()** — 在模块加载时读取 `.env`，本地开发与 Vercel runtime 均生效

### 2. 本地开发入口 — [src/index.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/index.ts)

```typescript
import app from './app'

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  console.log(`🚀 IronAI server running on http://localhost:${PORT}`)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})
```

- 调用 `app.listen()` 启动 HTTP 服务器
- 监听 `uncaughtException` 与 `unhandledRejection`，避免静默崩溃
- 默认端口 3000（可通过 `PORT` 环境变量覆盖）

### 3. Vercel Serverless 入口 — [api/index.ts](file:///d:/学习/全栈/projects/web端/IronAI/api/index.ts)

```typescript
import app from '../server/src/app'

export default app
```

- 位于项目根目录的 `api/` 文件夹（Vercel 约定）
- 直接将 Express app 作为默认导出
- Vercel 的 `@vercel/node` runtime 会将每个请求以 `(req, res)` 签名调用该 app
- **无需调用 `app.listen()`** — Vercel 平台托管 HTTP 服务

---

## Express 应用配置

### CORS 策略

```typescript
const corsOrigin = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}))
```

- **本地开发**：默认允许 `localhost:5173` 与 `127.0.0.1:5173`（Vite dev server）
- **生产环境**：前后端同域（Vercel 统一域名），CORS 实际不生效
- **扩展性**：通过 `ALLOWED_ORIGINS` 环境变量可添加额外的跨域白名单（逗号分隔）

### 健康检查端点

```
GET /api/health
```

返回：
```json
{
  "status": "ok",
  "timestamp": "2026-08-04T08:30:00.000Z"
}
```

用于 Vercel 部署后的服务可用性验证。

---

## 数据库与 Prisma ORM

### PrismaClient 单例 — [src/config/prisma.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/config/prisma.ts)

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
```

**为什么用单例？**
- Vercel Serverless 函数在热启动时可能保留 Node.js 进程状态
- 若每次请求都 `new PrismaClient()`，会导致连接池爆炸（每次实例化约打开 10 个连接）
- 通过 `globalThis` 缓存单例，热启动时复用已有实例
- 开发环境打印 `warn` + `error` 日志，生产环境只打印 `error`

### 数据模型 — [prisma/schema.prisma](file:///d:/学习/全栈/projects/web端/IronAI/server/prisma/schema.prisma)

#### 数据源配置

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 模型概览

| 模型 | 表名 | 说明 | 关键关系 |
|------|------|------|---------|
| `User` | `users` | 用户账户 | 拥有所有其他实体 |
| `TrainingProgram` | `training_programs` | 训练计划 | 属于 User，包含多个 Exercise |
| `Exercise` | `exercises` | 练习动作 | 属于 TrainingProgram |
| `TrainingSession` | `training_sessions` | 训练会话记录 | 属于 User，可选关联 Program |
| `DietRecord` | `diet_records` | 饮食记录 | 属于 User |
| `AIAnalysis` | `ai_analyses` | AI 分析结果 | 属于 User |

#### 关键设计要点

**1. 表名映射（snake_case）**

所有模型通过 `@@map("table_name")` 映射到 snake_case 表名，保持数据库命名一致性：

```prisma
model TrainingProgram {
  // ...
  @@map("training_programs")
}
```

**2. CHECK 约束而非原生 ENUM**

数据库的 `fitness_goal`、`difficulty`、`meal_type`、`analysis_type` 字段使用 `varchar + CHECK` 约束（而非 PostgreSQL 原生 `enum`），因此 Prisma 中统一用 `String` 类型：

```prisma
model User {
  fitness_goal  String   @default("general") @db.VarChar(50)
  // DB 层有 CHECK (fitness_goal IN ('lose_weight','build_muscle','endurance','general'))
}
```

> 类型安全由 **controller 层校验 + TypeScript Body 接口联合类型** 双重保证。

**3. 级联删除策略**

```prisma
model TrainingProgram {
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  // 用户删除 → 其所有 TrainingProgram 自动删除
}

model TrainingSession {
  program TrainingProgram? @relation(fields: [program_id], references: [id], onDelete: SetNull)
  // 计划删除 → 关联会话的 program_id 置为 NULL（保留历史记录）
}
```

**4. 复合索引优化**

```prisma
model DietRecord {
  @@index([user_id, recorded_at])
  // 优化"查询某用户某天的饮食记录"场景
}
```

**5. 时间戳类型**

- `@db.Timestamptz` — 带时区的时间戳，用于 `created_at`、`updated_at`、`started_at`
- `@db.Date` — 纯日期，用于 `DietRecord.recorded_at`（饮食记录按天聚合）

### Prisma Client 生成 — [scripts/postinstall.js](file:///d:/学习/全栈/projects/web端/IronAI/server/scripts/postinstall.js)

```javascript
const env = { ...process.env }
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder'
  console.log('[postinstall] DATABASE_URL not set, using placeholder for prisma generate')
}

const isPnpm = existsSync(path.resolve(__dirname, '..', '..', 'pnpm-workspace.yaml'))
const cmd = isPnpm ? 'pnpm exec prisma generate' : 'npx prisma generate'

try {
  execSync(cmd, { stdio: 'inherit', env, cwd: path.resolve(__dirname, '..') })
} catch (err) {
  if (process.env.VERCEL) {
    console.log('[postinstall] Running on Vercel, continuing build...')
  } else {
    process.exit(1)
  }
}
```

**关键设计**：
- **`postinstall` 钩子**：`npm install` 后自动执行 `prisma generate`
- **占位 DATABASE_URL**：Vercel 构建时 `DATABASE_URL` 可能未设置（仅 runtime 配置），`prisma generate` 不连接数据库但需要 env 存在，因此提供占位值
- **包管理器自动检测**：检测 `pnpm-workspace.yaml` 决定用 `pnpm exec` 还是 `npx`
- **Vercel 容错**：构建环境失败时不退出进程（client 构建不依赖 Prisma）

---

## 认证中间件

### JWT 中间件 — [src/middleware/auth.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/middleware/auth.ts)

```typescript
export interface AuthRequest extends Request {
  userId?: number
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  const token = header.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
    req.userId = decoded.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }
}
```

**工作流程**：
1. 从 `Authorization` 头提取 `Bearer <token>`
2. 用 `JWT_SECRET` 验证签名与有效期
3. 验证通过 → 将 `userId` 挂到 `req` 上，调用 `next()`
4. 验证失败 → 返回 401

**类型扩展**：
- 通过 `AuthRequest extends Request` 扩展 `userId` 字段
- 下游 controller 可直接读取 `req.userId!` 获取当前用户 ID

---

## 路由层

所有路由文件统一采用 `express.Router()` 组织，按业务模块拆分。

### 认证路由 — [src/routes/auth.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/routes/auth.ts)

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| POST | `/api/auth/register` | — | 注册新账户 |
| POST | `/api/auth/login` | — | 登录 |
| GET | `/api/auth/me` | `authMiddleware` | 获取当前用户信息 |

> 注册与登录是公开路由，`/me` 需要认证。

### 训练路由 — [src/routes/training.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/routes/training.ts)

```typescript
router.use(authMiddleware)  // 整个路由组都需要认证
```

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/training/programs` | 获取当前用户的训练计划列表 |
| POST | `/api/training/programs` | 创建训练计划（可批量创建练习） |
| GET | `/api/training/programs/:id` | 获取计划详情（含练习列表） |
| PUT | `/api/training/programs/:id` | 更新计划 |
| DELETE | `/api/training/programs/:id` | 软删除计划（`is_active = false`） |
| POST | `/api/training/programs/:programId/exercises` | 为计划添加练习 |
| DELETE | `/api/training/exercises/:exerciseId` | 删除练习 |
| GET | `/api/training/sessions` | 获取训练会话历史 |
| POST | `/api/training/sessions` | 记录一次训练会话 |

### 饮食路由 — [src/routes/diet.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/routes/diet.ts)

```typescript
router.use(authMiddleware)

// 注意：/summary 必须在 /:id 之前定义，否则 Express 会把 "summary" 当作 :id
router.get('/summary', getSummary)
router.get('/records', getRecords)
router.post('/records', addRecord)
router.delete('/records/:id', deleteRecord)
```

| 方法 | 路径 | 查询参数 | 说明 |
|------|------|---------|------|
| GET | `/api/diet/records` | `date=YYYY-MM-DD` | 获取某天的饮食记录 |
| POST | `/api/diet/records` | — | 添加饮食记录 |
| DELETE | `/api/diet/records/:id` | — | 删除饮食记录 |
| GET | `/api/diet/summary` | `start=&end=` | 获取日期区间内的汇总统计 |

> ⚠️ **路由顺序陷阱**：`/summary` 必须在 `/:id` 之前注册，否则 Express 会把字符串 `"summary"` 误匹配为路径参数 `id`。

### AI 路由 — [src/routes/ai.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/routes/ai.ts)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/training-analysis` | 生成训练数据分析 |
| POST | `/api/ai/diet-recommendation` | 生成饮食建议 |
| GET | `/api/ai/history` | 获取 AI 分析历史（可选 `?type=training\|diet` 过滤） |

---

## 控制器层

### 1. 认证控制器 — [src/controllers/authController.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/controllers/authController.ts)

#### 注册流程

```typescript
export const register = async (req, res) => {
  // 1. 校验必填字段（email、password、name）
  // 2. 校验密码长度 ≥ 6
  // 3. 校验 email 格式（包含 @）
  // 4. 检查 email 是否已注册
  // 5. bcrypt.hash(password, 10) 哈希密码
  // 6. prisma.user.create() 创建用户
  // 7. 生成 JWT（7 天有效期）
  // 8. 返回 { token, user: SafeUser }
}
```

**关键设计**：
- **SafeUser 类型**：通过 `Omit<User, 'password_hash'>` 排除敏感字段，`toSafeUser()` 工具函数剥离 `password_hash`
- **密码哈希**：`bcrypt.hash(password, 10)` — salt rounds 10 是性能与安全的平衡点
- **JWT 有效期**：7 天，与前端 `localStorage` 持久化策略匹配

#### 登录流程

```typescript
export const login = async (req, res) => {
  // 1. 校验 email、password 非空
  // 2. 根据 email 查询用户
  // 3. 用户不存在 → 401（统一错误信息，防止枚举攻击）
  // 4. bcrypt.compare(password, user.password_hash) 比对密码
  // 5. 密码不匹配 → 401（同样的错误信息）
  // 6. 生成 JWT
  // 7. 返回 { token, user: SafeUser }
}
```

> **安全提示**：登录失败时统一返回 `"Invalid email or password"`，不区分"用户不存在"与"密码错误"，防止账户枚举攻击。

### 2. 训练控制器 — [src/controllers/trainingController.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/controllers/trainingController.ts)

#### 创建计划（含批量练习）

```typescript
export const createProgram = async (req, res) => {
  const { name, description, difficulty, target_muscle_group, exercises = [] } = req.body

  const program = await prisma.trainingProgram.create({
    data: {
      user_id: req.userId!,
      name,
      description: description ?? null,
      difficulty: difficulty ?? 'beginner',
      target_muscle_group: target_muscle_group ?? null,
      exercises: exercises.length > 0
        ? {
            create: exercises.map(ex => ({
              name: ex.name,
              sets: ex.sets ?? 3,
              reps: ex.reps ?? 10,
              // ...
            })),
          }
        : undefined,
    },
    include: { exercises: { orderBy: { sort_order: 'asc' } } },
  })

  res.status(201).json({ program })
}
```

**关键设计**：
- **嵌套创建**：利用 Prisma 的嵌套 `create` 语法，一次事务内同时创建计划与其下所有练习
- **默认值兜底**：`sets ?? 3`、`reps ?? 10`、`rest_seconds ?? 60` 等提供合理默认值
- **返回时 include exercises**：创建后立即返回完整计划（含练习列表），前端无需二次请求

#### 软删除策略

```typescript
export const deleteProgram = async (req, res) => {
  // 不实际删除，而是设置 is_active = false
  await prisma.trainingProgram.update({
    where: { id: existing.id },
    data: { is_active: false },
  })
}
```

- 训练计划采用**软删除**（`is_active = false`），保留历史数据
- 查询时通过 `where: { is_active: true }` 过滤已删除项
- 已删除计划关联的历史会话仍可正常展示

#### 练习排序

```typescript
export const addExercise = async (req, res) => {
  // 查询当前计划下最大的 sort_order
  const maxAgg = await prisma.exercise.aggregate({
    where: { program_id: program.id },
    _max: { sort_order: true },
  })
  const sortOrder = (maxAgg._max.sort_order ?? -1) + 1

  const exercise = await prisma.exercise.create({
    data: { /* ... */ sort_order: sortOrder },
  })
}
```

- 新练习自动追加到列表末尾（`max(sort_order) + 1`）
- 查询时按 `sort_order: 'asc'` 排序，保持用户自定义顺序

#### 归属校验（关系过滤）

```typescript
export const deleteExercise = async (req, res) => {
  // 通过关系过滤校验归属（等价原 JOIN 查询）
  const owned = await prisma.exercise.findFirst({
    where: {
      id: Number(exerciseId),
      program: { user_id: req.userId! },  // 嵌套过滤
    },
    select: { id: true },
  })
}
```

- 删除练习时通过 `program: { user_id: req.userId! }` 嵌套过滤校验归属
- 避免用户删除他人练习的安全漏洞
- 等价于原 SQL 的 `JOIN training_programs ON ... WHERE user_id = ?`

#### 会话列表字段展平

```typescript
export const getSessions = async (req, res) => {
  const sessions = await prisma.trainingSession.findMany({
    include: { program: { select: { name: true } } },
    orderBy: { started_at: 'desc' },
    take: limit,
  })

  // flatten：program.name → program_name（保持前端契约）
  const mapped = sessions.map(s => {
    const { program, ...rest } = s
    return { ...rest, program_name: program?.name ?? null }
  })

  res.json({ sessions: mapped })
}
```

- Prisma 返回嵌套结构 `{ program: { name } }`
- 前端期望扁平结构 `{ program_name }`
- 通过 `map` 展平字段，保持 API 契约稳定

### 3. 饮食控制器 — [src/controllers/dietController.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/controllers/dietController.ts)

#### 日期处理

```typescript
export const getRecords = async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0]

  const records = await prisma.dietRecord.findMany({
    where: {
      user_id: req.userId!,
      recorded_at: new Date(date),  // 字符串转 Date 对象
    },
    orderBy: { created_at: 'desc' },
  })

  // 格式化 recorded_at Date → 'YYYY-MM-DD' 字符串（保持前端契约）
  const formatted = records.map(r => ({
    ...r,
    recorded_at: formatDate(r.recorded_at),
  }))

  res.json({ records: formatted, date })
}
```

**关键点**：
- 入参 `date=YYYY-MM-DD` 字符串 → `new Date(date)` 转 Date 对象查询
- 出参 `recorded_at` 是 Date 对象 → `formatDate()` 转回 `YYYY-MM-DD` 字符串
- 双向转换确保 API 契约稳定（前端只处理字符串）

#### 汇总统计（聚合 + 分组）

```typescript
export const getSummary = async (req, res) => {
  const where = {
    user_id: req.userId!,
    recorded_at: { gte: new Date(startDate), lte: new Date(endDate) },
  }

  // 总计聚合
  const agg = await prisma.dietRecord.aggregate({
    where,
    _count: { _all: true },
    _sum: { calories: true, protein_grams: true, carbs_grams: true, fat_grams: true },
  })

  // 按天分组
  const daily = await prisma.dietRecord.groupBy({
    by: ['recorded_at'],
    where,
    _sum: { calories: true, protein_grams: true, /* ... */ },
    _count: { _all: true },
    orderBy: { recorded_at: 'asc' },
  })

  res.json({
    summary: { total_entries, total_calories, total_protein, /* ... */ },
    daily: dailyFormatted,
    dateRange: { start: startDate, end: endDate },
  })
}
```

- `aggregate` 计算区间总合计（总卡路里、总蛋白质等）
- `groupBy` 按天分组，计算每日合计
- 两个查询组合，一次请求返回周汇总 + 每日明细

### 4. AI 控制器 — [src/controllers/aiController.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/controllers/aiController.ts)

#### 训练分析流程

```typescript
export const trainingAnalysis = async (req, res) => {
  // 1. 查询用户档案（年龄、体重、身高、目标）
  // 2. 查询最近 30 天的训练会话（最多 30 条）
  // 3. 查询所有活跃训练计划（含练习数量）
  // 4. 拼装 Markdown 格式的 userPrompt
  // 5. 调用 chatCompletion(userPrompt, TRAINING_SYSTEM_PROMPT)
  // 6. 持久化分析结果到 ai_analyses 表
  // 7. 返回 { analysis, generatedAt }
}
```

**Prompt 构造**：
- 系统提示词定义 AI 角色（"15 年经验的健身教练"）与输出规范
- 用户提示词注入结构化数据：用户档案、活跃计划、最近会话
- 明确要求 5 个分析维度：频率评估、容量与强度、肌群平衡、关键问题、周计划建议

**错误处理**：
```typescript
if (err.message?.includes('DeepSeek')) {
  res.status(502).json({ error: 'AI service unavailable: ' + err.message })
  return
}
```
- DeepSeek API 错误返回 502（Bad Gateway），前端据此显示"AI 服务不可用"提示
- 其他错误返回 500

#### 饮食建议流程

类似训练分析，但查询的是最近 7 天的饮食记录，并通过 `groupBy` 计算每日宏量合计。Prompt 要求输出：卡路里评估、宏量平衡、进餐时间、关键问题、3 天饮食计划。

#### 历史记录查询

```typescript
export const getHistory = async (req, res) => {
  const type = req.query.type  // 可选：'training' | 'diet'

  const where = { user_id: req.userId! }
  if (type && ['training', 'diet'].includes(type)) {
    where.analysis_type = type
  }

  const analyses = await prisma.aIAnalysis.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 20,
    select: { id: true, analysis_type: true, response_text: true, created_at: true },
  })
}
```

- 支持按类型过滤（`?type=training` 或 `?type=diet`）
- 最多返回 20 条历史记录
- 白名单校验 `type` 参数，防止 SQL 注入式参数污染

---

## DeepSeek AI 服务

### 服务封装 — [src/services/deepseek.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/services/deepseek.ts)

```typescript
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

export async function chatCompletion(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set in .env')
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 3000,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`DeepSeek API error (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}
```

**关键设计**：
- **OpenAI 兼容 API**：DeepSeek 的 API 格式与 OpenAI 完全一致，未来可无缝切换到 OpenAI、Groq 等提供商
- **原生 fetch**：Node.js 18+ 内置 `fetch`，无需引入 `axios` 或 `openai` SDK
- **参数选择**：
  - `model: 'deepseek-chat'` — DeepSeek 主力对话模型
  - `temperature: 0.7` — 适度创造性（0 确定，1 随机）
  - `max_tokens: 3000` — 限制响应长度与成本
- **错误传递**：错误信息包含 `DeepSeek` 关键字，controller 据此返回 502 状态码

### 系统提示词

#### 训练分析提示词

```typescript
export const TRAINING_SYSTEM_PROMPT = `You are an expert fitness coach with 15 years of experience...
1. Evidence-based — reference established training principles
2. Specific — mention exact exercises, set/rep schemes, and frequency
3. Actionable — every observation comes with a concrete recommendation
4. Safe — flag overtraining, muscle imbalances, and injury risks prominently

Always structure your response with clear markdown headings.`
```

#### 饮食建议提示词

```typescript
export const DIET_SYSTEM_PROMPT = `You are a registered dietitian specializing in sports nutrition...
1. Science-based — reference nutritional science, not fads
2. Practical — recommend whole foods, not expensive supplements
3. Personalized — consider the user's goal (cut/maintain/bulk)
4. Specific — give exact foods, portions, and estimated macros`
```

两个提示词都强调：**循证、具体、可执行、安全**，并要求 Markdown 格式输出（前端用 `react-markdown` 渲染）。

---

## 类型定义

### 共享类型 — [src/types/index.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/types/index.ts)

```typescript
import type {
  User, TrainingProgram, Exercise, TrainingSession, DietRecord, AIAnalysis,
} from '@prisma/client'

// --- 数据库行类型（从 Prisma 派生） ---
export type UserRow = User
export type SafeUser = Omit<User, 'password_hash'>  // 排除密码哈希
export type TrainingProgramRow = TrainingProgram
export type ExerciseRow = Exercise
export type TrainingSessionRow = TrainingSession
export type DietRecordRow = DietRecord
export type AIAnalysisRow = AIAnalysis

// --- API 请求体类型（手写，用于校验） ---
export interface RegisterBody {
  email: string
  password: string
  name: string
  age?: number
  height_cm?: number
  weight_kg?: number
  fitness_goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general'
}

export interface CreateProgramBody {
  name: string
  description?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  target_muscle_group?: string
  exercises?: CreateExerciseBody[]
}

export interface CreateDietBody {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name: string
  calories?: number
  // ...
}
```

**设计要点**：
- **行类型派生**：`UserRow`、`ExerciseRow` 等直接从 Prisma 生成的类型派生，schema 变更时自动同步
- **SafeUser**：`Omit<User, 'password_hash'>` 确保密码哈希永远不会意外返回给前端
- **请求体手写**：Body 接口手写并使用联合字面量类型（如 `'breakfast' | 'lunch' | ...`），提供编译期校验
- **双轨类型**：DB 行类型与 API 请求体类型分离，因为数据库用 String（CHECK 约束），API 用联合类型

---

## 工具函数

### 日期格式化 — [src/utils/format.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/utils/format.ts)

```typescript
export function formatDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
```

**为什么需要这个函数？**
- Prisma 返回的 `@db.Date` 字段是 `Date` 对象
- 原生 `Date.toISOString()` 会返回带时间的字符串（`2026-08-04T00:00:00.000Z`）
- 前端只需要 `YYYY-MM-DD` 格式
- 此函数手动格式化，避免时区转换导致的日期偏移问题

---

## Vercel 部署

### 部署架构

```
┌─────────────────────────────────────────┐
│              Vercel Edge                │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌──────────┐    ┌──────────────┐
│ Static   │    │  Serverless  │
│ Frontend │    │  Function    │
│ (client/ │    │  (api/       │
│  dist)   │    │   index.ts)  │
└──────────┘    └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │   Express    │
                │   App        │
                │ (server/src/ │
                │   app.ts)    │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │  Supabase    │
                │ PostgreSQL   │
                │ (连接池:6543) │
                └──────────────┘
```

### Vercel 配置 — [vercel.json](file:///d:/学习/全栈/projects/web端/IronAI/vercel.json)

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
    "api/index.ts": {
      "maxDuration": 30
    }
  }
}
```

**配置说明**：
- **installCommand**：分别安装 server 与 client 依赖（使用 npm，非 pnpm，避免 Vercel 构建环境兼容性问题）
- **buildCommand**：只构建前端（后端是 Serverless Function，无需构建）
- **outputDirectory**：前端构建产物在 `client/dist`
- **rewrites**：
  - `/api/*` → 路由到 Serverless Function
  - 其他所有路径 → 返回 `index.html`（支持前端路由）
- **maxDuration: 30**：AI 分析接口可能需要 10-30 秒，设置最大执行时长为 30 秒

### ⚠️ 重要：不要使用 `vercel-build` 脚本

根 `package.json` 中**不应**保留 `vercel-build` 脚本。Vercel 会优先执行该脚本而非 `vercel.json` 中的 `buildCommand`。若该脚本使用 `pnpm install`，会触发 `ERR_INVALID_THIS` 兼容性错误（pnpm 与 Vercel 构建环境的 Node.js 版本不兼容）。

---

## 环境变量

### 本地开发（`server/.env`）

```env
# 数据库连接（Supabase 连接池地址，端口 6543）
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# JWT 密钥（任意随机字符串）
JWT_SECRET=your-random-secret-key

# DeepSeek API 密钥
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx

# 可选：跨域白名单
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# 可选：端口
PORT=3000
```

### Vercel 环境变量

在 Vercel Dashboard → Settings → Environment Variables 中配置：

| 变量名 | 用途 | 说明 |
|--------|------|------|
| `DATABASE_URL` | 数据库连接 | Supabase 连接池地址（端口 6543） |
| `JWT_SECRET` | JWT 签名 | 与本地一致 |
| `DEEPSEEK_API_KEY` | AI 服务 | DeepSeek API 密钥 |

> ⚠️ **必须使用 Supabase 连接池地址**（`pooler.supabase.com:6543`），而非直连地址（`db.xxx.supabase.co:5432`）。Serverless 环境下直连会因连接数限制而失败。

---

## 开发命令

### 本地开发（pnpm 工作区）

```bash
# 在项目根目录
pnpm install                  # 安装所有工作区依赖（触发 postinstall 生成 Prisma Client）
pnpm dev:server               # 启动后端开发服务器（tsx 热重载）
pnpm dev:client               # 启动前端开发服务器
```

### 在 server 目录直接操作

```bash
cd server
npm install                   # 安装依赖（自动触发 prisma generate）
npm run dev                   # 开发模式（tsx src/index.ts）
npm run build                 # 编译 TypeScript → dist/
npm start                     # 生产模式（node dist/index.js）
```

### 数据库相关

```bash
# 生成 Prisma Client（修改 schema.prisma 后执行）
npx prisma generate

# 查看 Prisma Studio（数据库可视化工具）
npx prisma studio

# 注意：本项目不使用 prisma migrate（数据库已存在所有表）
# schema.prisma 仅用于 prisma generate 生成类型安全的查询客户端
```

---

## 关键技术决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| ORM | Prisma 5.22 | 类型安全查询；避免手写 SQL 的维护成本；5.22 稳定且无 7.x 的破坏性变更 |
| 数据库 | Supabase PostgreSQL | 免费额度足够；原生 PostgreSQL 兼容；连接池支持 Serverless |
| 连接方式 | 连接池（pooler:6543） | Serverless 环境直连会因连接数限制失败；连接池复用连接 |
| ENUM 实现 | varchar + CHECK | PostgreSQL 原生 ENUM 修改困难（需 ALTER TYPE）；varchar + CHECK 更灵活 |
| 表名 | snake_case + @@map | 数据库使用 snake_case 命名；Prisma 模型使用 PascalCase；通过 @@map 桥接 |
| 密码哈希 | bcryptjs（salt rounds 10） | 行业标准；10 rounds 在性能与安全间平衡 |
| 认证 | JWT（7 天有效期） | 无状态，适配 Serverless；无需 session 存储 |
| 错误处理 | try/catch + 统一错误格式 | 每个 controller 包裹 try/catch；错误信息统一 `{ error: string }` 格式 |
| 删除策略 | 训练计划软删除 / 其他硬删除 | 计划软删除保留历史会话关联；饮食记录硬删除避免膨胀 |
| AI 服务 | DeepSeek（OpenAI 兼容） | 成本低；API 兼容 OpenAI，未来可无缝切换 |
| 部署模式 | Express + Vercel Serverless | 复用 Express 生态；Vercel 自动扩缩容；零运维 |
| 双入口 | app.ts 共享 + index.ts/api.ts 分离 | 同一份代码服务本地开发与生产；避免逻辑重复 |
| 类型派生 | Prisma 生成类型 + 手写 Body 接口 | 行类型从 Prisma 派生保证 DB 同步；Body 手写提供请求校验 |
| Prisma 单例 | globalThis 缓存 | 避免 Vercel 热启动时重复实例化 PrismaClient，防止连接池爆炸 |
| postinstall 钩子 | 自动 prisma generate | 安装依赖后自动生成 Client；Vercel 构建环境容错处理 |
