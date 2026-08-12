import { PrismaClient } from '@prisma/client'

// -----------------------------------------------------------
// PrismaClient 单例
// -----------------------------------------------------------
// - 使用 globalThis 避免 Vercel 热启动（HMR）重复实例化
// - 注意：使用 Supabase 连接池（PgBouncer transaction pooling）时，
//   Prisma 不能缓存 prepared statement，否则会出现
//   "prepared statement s3 already exists" 错误。
//   我们在此通过构造参数 + 运行时 URL 规范化做双重保险。
// -----------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 规范化 DATABASE_URL，确保 PgBouncer 场景下关闭 prepared statement 缓存
function normalizeDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl
  try {
    const u = new URL(rawUrl)
    // 让 Prisma 感知运行在 PgBouncer 后面
    u.searchParams.set('pgbouncer', 'true')
    // 关键：关闭 Prisma 客户端侧的 named prepared statement 缓存
    // 这是解决 "prepared statement sX already exists" 的根本方案
    u.searchParams.set('statement_cache_size', '0')
    // 连接池安全参数（避免 Serverless 连接数爆炸）
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', '1')
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', '15')
    }
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '15')
    }
    return u.toString()
  } catch {
    return rawUrl
  }
}

const isDev = process.env.NODE_ENV !== 'production'

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: normalizeDatabaseUrl(process.env.DATABASE_URL),
      },
    },
    log: isDev ? ['warn', 'error'] : ['error'],
  })

if (isDev) {
  globalForPrisma.prisma = prisma
}

export default prisma
