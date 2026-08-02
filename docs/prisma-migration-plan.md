# Prisma ORM 迁移计划：pg → Prisma

## Context

后端当前使用 `pg`（node-postgres）直接编写 SQL，存在类型安全缺失、NUMERIC 类型需手动解析、批量插入需手工拼接占位符等问题。迁移到 Prisma ORM 后可获得：强类型查询、自动关系映射、聚合 API、更好的 IDE 支持。

数据库为 Supabase PostgreSQL（远程），已有全部表和数据。**不运行 `prisma migrate`**，仅用 `prisma generate` 生成 client，schema 手写并与现有 DB 精确对齐。

## 关键技术决策

| 问题 | 方案 | 理由 |
|------|------|------|
| NUMERIC 列返回 string | `Float @db.Decimal(p,s)` | Prisma client 返回 `number`，等价于现有 `setTypeParser(NUMERIC, parseFloat)` |
| CHECK 约束 → 类型安全 | `Enum @db.VarChar(n)` | DB 层仍是 varchar（不创建 PG enum，无需 migrate），TS 层获得联合类型 |
| `recorded_at` DATE 列 | `DateTime @db.Date` + `formatDate()` 工具 | Prisma 返回 Date 对象，需格式化为 `'YYYY-MM-DD'` 字符串以保持前端契约 |
| Vercel 构建跳过 devDeps | `prisma` 放 `dependencies` + `postinstall: prisma generate` | `NODE_ENV=production` 时 npm 跳过 devDeps |
| 连接池兼容 | `DATABASE_URL` 加 `?pgbouncer=true&connection_limit=1` | Supabase pooler 用 PgBouncer transaction mode |

## 实施步骤

### Step 1: 安装依赖 + 创建 Schema

- `server/` 下安装 `@prisma/client`（deps）和 `prisma`（deps，非 devDeps）
- 新建 `server/prisma/schema.prisma`，包含：
  - 4 个 enum：`FitnessGoal`、`Difficulty`、`MealType`、`AnalysisType`
  - 6 个 model：`User`、`TrainingProgram`、`Exercise`、`TrainingSession`、`DietRecord`、`AIAnalysis`
  - 所有关系（onDelete: Cascade / SetNull）、索引（`@@index`）
  - NUMERIC 列用 `Float @db.Decimal(p,s)`，CHECK 列用 `Enum @db.VarChar(n)`
- 验证：`npx prisma validate` + `npx prisma db pull --print` 逐字段对比

### Step 2: PrismaClient 单例 + 工具函数

- 新建 `server/src/config/prisma.ts`：使用 `globalThis` 单例模式（Vercel 热启动安全）
- 新建 `server/src/utils/format.ts`：`formatDate(date: Date): string` → `'YYYY-MM-DD'`
- 删除 `server/src/config/db.ts`

### Step 3: 更新类型定义

- `server/src/types/index.ts`：Row 接口改为从 Prisma 派生
  ```ts
  import type { User, TrainingProgram, ... } from '@prisma/client'
  export type UserRow = User
  export type SafeUser = Omit<User, 'password_hash'>
  ```
- Body 接口（RegisterBody 等）保持不变

### Step 4: 迁移 4 个 Controller

按复杂度递增顺序：

1. **authController.ts**（5 查询）— `findFirst`/`create`，`create` 用 `omit: { password_hash: true }` 替代 `toSafeUser`
2. **dietController.ts**（7 查询）— `aggregate`/`groupBy` 替代 SUM/COUNT/GROUP BY，`formatDate` 处理 `recorded_at`
3. **trainingController.ts**（15 查询）— 嵌套 `create` 替代批量 INSERT，`include._count` 替代 JOIN+COUNT，`aggregate._max` 替代 MAX，JOIN 结果 flatten `program_name`
4. **aiController.ts**（10 查询）— JS Date 替代 `INTERVAL '30 days'`，动态 `where` spread 替代动态 SQL，JSONB 直接传对象

### Step 5: 清理 + 构建配置

- `server/package.json`：加 `postinstall: "prisma generate"`，移除 `pg`、`@types/pg`
- 保留 `server/src/database/schema.sql` 作为建表参考
- `.env` 的 `DATABASE_URL` 追加 `?pgbouncer=true&connection_limit=1`

## Controller 迁移模式速查

| 原 SQL 模式 | Prisma 替代 |
|-------------|-------------|
| `SELECT * WHERE ...` | `findFirst` / `findMany` |
| `INSERT ... RETURNING id` + re-SELECT | `create`（直接返回完整对象） |
| `UPDATE SET ... WHERE id=` | `update`（前置 `findFirst` 做归属校验） |
| `DELETE WHERE id=` | `delete`（前置 `findFirst` 做归属校验） |
| 软删除 `UPDATE is_active=FALSE` | `update({ data: { is_active: false } })` |
| `SUM`/`COUNT` 聚合 | `aggregate({ _sum, _count })` |
| `GROUP BY` | `groupBy({ by, _sum, _count })` |
| `LEFT JOIN` | `include: { relation }` + flatten 映射 |
| 动态 WHERE | 对象 spread 到 `where` |
| `INTERVAL '30 days'` | `new Date(Date.now() - 30*86400000)` |
| 批量 INSERT | 嵌套 `create: { exercises: { create: [...] } }` |
| `MAX(sort_order)` | `aggregate({ _max: { sort_order } })` |
| `JSON.stringify` 写 JSONB | 直接传 JS 对象（Prisma `Json` 类型） |

## 关键文件

- `server/prisma/schema.prisma` — 新建，迁移基石
- `server/src/config/prisma.ts` — 新建，PrismaClient 单例
- `server/src/utils/format.ts` — 新建，`formatDate` 工具
- `server/src/types/index.ts` — 修改，Row 类型从 Prisma 派生
- `server/src/controllers/authController.ts` — 修改，5 处查询
- `server/src/controllers/dietController.ts` — 修改，7 处查询 + formatDate
- `server/src/controllers/trainingController.ts` — 修改，15 处查询 + flatten
- `server/src/controllers/aiController.ts` — 修改，10 处查询 + Date
- `server/package.json` — 修改，postinstall + 依赖调整
- `server/src/config/db.ts` — 删除

## 风险点

1. **`recorded_at` 契约**（高风险）：Prisma 返回 Date，前端期望 `'YYYY-MM-DD'` 字符串 → 所有 diet 响应用 `formatDate()` 转换
2. **`program_name` 扁平字段**（高风险）：JOIN 后必须 flatten，不能返回嵌套 `program` 对象
3. **跨用户越权**（高风险）：`update`/`delete` 的 `where` 只支持 PK，必须前置 `findFirst({ id, user_id })` 校验归属
4. **Vercel 构建失败**（中风险）：`prisma` 必须在 `dependencies` 中，否则 postinstall 找不到 CLI

## 验证方式

1. **静态检查**：`npx prisma validate` + `npx prisma generate` + `npx tsc --noEmit`
2. **Schema 对齐**：`npx prisma db pull --print` 与手写 schema 逐字段对比
3. **本地端到端**：启动 server，逐接口测试（重点：recorded_at 格式、program_name 扁平、聚合数值类型、跨用户 404）
4. **前端回归**：启动 client，走查 Register→Login→Dashboard→Training→Diet→AI 全流程
5. **Vercel 部署**：推送后检查构建日志含 `prisma generate`，线上接口功能正常
