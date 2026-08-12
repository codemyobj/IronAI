# 故障记录：Prisma + PgBouncer `42P05 prepared statement "sX" already exists`

> 🗓️ **发生时间**：2026-08-12  
> 🔖 **版本**：Prisma 5.22 + Express 5（Vercel Serverless Function）+ Supabase PostgreSQL（Transaction Pooler）  
> ⚠️ **严重程度**：P1（核心接口 500，登录/读数据失败，线上用户不可用）

---

## 1. 现象

Vercel 部署正常，但用户请求登录 / 获取数据后，函数日志出现如下错误（来自 `authController.login` → `prisma.user.findFirst()`）：

```
2026-08-12 04:45:20.034 [info] prisma:error 
 Invalid `prisma.user.findFirst()` invocation: 
 
 Error occurred during query execution: 
 ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(
    PostgresError {
        code: "42P05",
        message: "prepared statement \"s3\" already exists",
        severity: "ERROR",
        detail: None, column: None, hint: None
    }
 ), transient: false }) 
```

- 错误码：PostgreSQL `42P05`（duplicate_prepared_statement）
- 名称 `s1` / `s2` / `s3` … 不固定（取决于 Prisma 在该 PrismaClient 生命周期内已编译的 prepared statement 数量与顺序）
- 通常首次请求 200 正常，**并发或热启动后**才出错
- 触发点：`prisma.user.findFirst()`、`prisma.trainingProgram.findMany()` 等所有涉及编译语句的 Prisma 调用

---

## 2. 复现条件

| 条件项 | 要求 | 本项目是否满足 |
|--------|------|--------|
| PostgreSQL 使用 PgBouncer 连接池模式（Transaction Pooling） | ✅ Supabase Transaction Pooler 就是这种模式 | **是** |
| Prisma Client 单例被 **进程级重用 / 缓存**（Vercel Serverless HMR 热启动） | globalThis 保存 Prisma Client 实例 | **是** |
| 每个函数调用背后的实际 PG 连接 **不固定**（PgBouncer 每次借还不同连接） | 开启 Prisma 默认的 `statement_cache` | **是** |

> 注意：Supabase 连接池如果选择 **Session Pooler**（不同协议），不会触发此问题，但 Supabase 的默认 Transaction Pooler（端口 6543）会。

---

## 3. 根因分析

### 3.1 机制说明

Prismas 的 prepared statement 缓存行为：

- Prisma 客户端为了减少 **Parse/Bind** 开销，会把语句命名为 `s1`、`s2`、`s3`…并在客户端（Prisma）侧缓存
- **前提**：Prisma 相信连接对象与 `prepared statement` 是绑定的
- 但在 PgBouncer **Transaction Pooling** 模式下：
  - 第 1 次请求分配到 connection A → Prisma 在 A 上 `PREPARE s3 AS ...` → OK
  - 第 2 次请求归还后，PgBouncer 把 `connection B`（来自池中，之前被其他客户端用过，上面已经有 s3）分配给同一个 Prisma Client
  - Prisma 不知道连接被换了，依然发送 `PREPARE s3 AS ...` → PostgreSQL 报错：`s3 已存在`

```
请求 1: Prisma(实例 A) -> PgBouncer(连接 A) -> PostgreSQL(PREPARE s3... OK)
请求 2: Prisma(实例 A) -> PgBouncer(连接 B 被切换) -> PostgreSQL(PREPARE s3... FAIL: 42P05)
```

### 3.2 为什么 `pgbouncer=true` 不够

单纯加 `pgbouncer=true` 只能让 Prisma 避免使用 PgBouncer 不支持的语法，**并不会关闭 Prisma 客户端自己的命名 prepared statement 缓存**。还需显式配置：

```
statement_cache_size=0
```

---

## 4. 修复方案（双保险）

### ✅ 方案 A（推荐，必须配）：在 `DATABASE_URL` 追加参数

在 Vercel 环境变量的 `DATABASE_URL` 中追加以下 5 个查询参数：

```
postgresql://postgres.你的项目ID:你的密码@aws-0-us-east-1.pooler.supabase.com:6543/postgres
?pgbouncer=true
&statement_cache_size=0   # ← 关键参数
&connection_limit=1
&connect_timeout=15
&pool_timeout=15
```

### ✅ 方案 B（代码兜底，推荐双保险）：运行时对 URL 做规范化

即使 Vercel env 漏配了参数，PrismaClient 在构造时也要主动注入参数，确保不因人为疏漏复发。见 [server/src/config/prisma.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/config/prisma.ts)：

```ts
function normalizeDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl
  try {
    const u = new URL(rawUrl)
    u.searchParams.set('pgbouncer', 'true')
    u.searchParams.set('statement_cache_size', '0')  // 关键！
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '1')
    if (!u.searchParams.has('pool_timeout'))    u.searchParams.set('pool_timeout', '15')
    if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '15')
    return u.toString()
  } catch {
    return rawUrl
  }
}
```

### ❌ 常见无效修复（不要采用）

- ❌ 把 DATABASE_URL 改为直连 `*.supabase.co:5432`：绕过了连接池，不现实（连接数暴涨容易打挂 Supabase，并且不能修复根本）
- ❌ 降级到更老版本 Prisma：不能根治
- ❌ 设置 `sslmode=disable`：严重安全风险
- ❌ 重启 Supabase：治标不治本，冲突迟早再发生

---

## 5. 验证修复

### 5.1 预期表现

Vercel Redeploy 后：

```bash
# 登录接口（正常）
POST /api/auth/login  → 200（返回 JWT）
GET  /api/auth/me     → 200（返回 user）
```

连续 10 次并发调用不能再出现 `42P05`。

### 5.2 验证命令（确认 statement_cache_size=0 生效）

在日志中确认 Prisma Client 构建时 URL 已带参数：

```
const prisma = new PrismaClient({
  datasources: {
    db: { url: normalizeDatabaseUrl(process.env.DATABASE_URL) }
  }
})
```

若仍报错，检查新 URL 上是否带了 `statement_cache_size=0`，以及 `pgbouncer=true`。

---

## 6. 关联文件清单

| 文件 | 说明 |
|------|------|
| [server/src/config/prisma.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/config/prisma.ts) | PrismaClient 单例 + URL 规范化逻辑 |
| [docs/DEPLOY.md](./DEPLOY.md#q出现-42p05-prepared-statement-s1--s2--s3-already-exists) | 部署文档内的 42P05 FAQ |
| [docs/backend-implementation.md](./backend-implementation.md#prismaclient-单例--srcconfigprismats) | backend 文档里的单例实现 |

---

## 7. 参考

- Prisma PgBouncer 指南：https://www.prisma.io/docs/guides/database/connection-pooling/pgbouncer
- PostgreSQL Error 42P05：https://www.postgresql.org/docs/current/errcodes-appendix.html
- Supabase Connection Pooling：https://supabase.com/docs/guides/platform/connecting-pooler

---

## 8. 记录日志

| 日期 | 动作 | 备注 |
|------|------|------|
| 2026-08-12 | 首次线上出现 | Vercel API `/api/auth/login` 返回 500 |
| 2026-08-12 | 定位根因 | Prisma statement_cache + PgBouncer 连接切换冲突 |
| 2026-08-12 | 代码修复 | [server/src/config/prisma.ts](file:///d:/学习/全栈/projects/web端/IronAI/server/src/config/prisma.ts) 新增 normalizeDatabaseUrl 双保险 |
| 2026-08-12 | 文档更新 | DEPLOY.md / backend-implementation.md DATABASE_URL 示例全部补齐 `statement_cache_size=0` |
| 2026-08-12 | 代码提交 + 推送 | commit `a7dcc29`，推送至 master 分支 |
