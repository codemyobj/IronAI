import { PrismaClient } from '@prisma/client'

// -----------------------------------------------------------
// 数据库路由：开发走本地 Docker PostgreSQL，生产走 Supabase
// -----------------------------------------------------------
// 优先级（开发环境）：
//   1. LOCAL_DATABASE_URL   → 用户显式指定的本地库（最高优先级）
//   2. 无 LOCAL_DATABASE_URL → 用默认本地连接：
//      postgresql://ironai:ironai@localhost:5432/ironai
//   3. 本地连不上（Docker 没开） → 自动 fallback 到 SUPABASE_DATABASE_URL
//      （兜底，保证服务不会因为 Docker 暂时关闭就 500）
//
// 优先级（生产环境 / Vercel）：
//   仅使用 SUPABASE_DATABASE_URL，或 DATABASE_URL（Supabase 官方注入）
//
// Supabase PgBouncer 的特殊配置（pgbouncer=true / statement_cache_size=0）
// 仅在检测到目标是 Supabase pooler（supabase.com 域名且端口非 5432）
// 时才启用，本地库不需要这些设置。
// -----------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'
const isVercel = !!process.env.VERCEL || isProduction
const isDev = !isProduction

// ---- URL 候选列表（按优先级） ------------------------------------------------
interface Candidate {
  name: 'LOCAL_DOCKER' | 'LOCAL_EXPLICIT' | 'SUPABASE' | 'DATABASE_URL'
  url: string
}

function getCandidateUrls(): Candidate[] {
  const out: Candidate[] = []

  if (isVercel) {
    // 生产 / Vercel 只认 Supabase
    if (process.env.SUPABASE_DATABASE_URL)
      out.push({ name: 'SUPABASE', url: process.env.SUPABASE_DATABASE_URL })
    if (process.env.DATABASE_URL)
      out.push({ name: 'DATABASE_URL', url: process.env.DATABASE_URL })
  } else {
    // 开发环境：先本地，失败再 fallback 到远程 Supabase
    if (process.env.LOCAL_DATABASE_URL)
      out.push({ name: 'LOCAL_EXPLICIT', url: process.env.LOCAL_DATABASE_URL })
    else {
      const envDb = process.env.DATABASE_URL || ''
      if (envDb.includes('localhost') || envDb.includes('127.0.0.1'))
        out.push({ name: 'LOCAL_EXPLICIT', url: envDb })
      else
        out.push({ name: 'LOCAL_DOCKER', url: 'postgresql://ironai:ironai@localhost:5432/ironai' })
    }
    // 兜底：远程 Supabase（仅当本地不通时使用）
    if (process.env.SUPABASE_DATABASE_URL)
      out.push({ name: 'SUPABASE', url: process.env.SUPABASE_DATABASE_URL })
    else if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase'))
      out.push({ name: 'DATABASE_URL', url: process.env.DATABASE_URL })
  }
  return out
}

function isRemoteSupabaseUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.hostname.includes('supabase.com') && u.port !== '' && u.port !== '5432'
  } catch {
    return false
  }
}

// ---- URL 规范化（按本地 vs Supabase 走不同逻辑） ---------------------------
function normalizeDatabaseUrl(rawUrl: string): string {
  const remote = isRemoteSupabaseUrl(rawUrl)
  try {
    const u = new URL(rawUrl)

    if (remote) {
      // --- Supabase PgBouncer Transaction Pooling 模式 ---
      u.searchParams.set('pgbouncer', 'true')
      u.searchParams.set('statement_cache_size', '0')
      if (isVercel) {
        u.searchParams.set('connection_limit', '1')
        u.searchParams.set('pool_timeout', '15')
        u.searchParams.set('connect_timeout', '15')
      } else {
        // 本地 fallback 到 Supabase 时，稍微放宽限制
        u.searchParams.set('connection_limit', '5')
        u.searchParams.set('pool_timeout', '10')
        u.searchParams.set('connect_timeout', '10')
      }
    } else {
      // --- 本地 PostgreSQL / 直连数据库 ---
      if (!u.searchParams.has('connection_limit'))
        u.searchParams.set('connection_limit', '10')
      if (!u.searchParams.has('pool_timeout'))
        u.searchParams.set('pool_timeout', '10')
      if (!u.searchParams.has('connect_timeout'))
        u.searchParams.set('connect_timeout', '5')
      u.searchParams.delete('sslmode')
      u.searchParams.delete('ssl')
    }
    return u.toString()
  } catch {
    return rawUrl
  }
}

// ---- 快速 TCP 可达性检测（避免 Prisma 冷启动 30s 才告诉你连不上） ------------
function testTcpReachable(rawUrl: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let u: URL
    try { u = new URL(rawUrl) } catch { resolve(false); return }
    const host = u.hostname
    const port = parseInt(u.port || '5432', 10)

    const net = require('net') as typeof import('net')
    const sock = net.createConnection({ host, port })
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try { sock.destroy() } catch {}
      resolve(false)
    }, timeoutMs)

    sock.once('connect', () => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { sock.end() } catch {}
      resolve(true)
    })
    sock.once('error', () => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { sock.destroy() } catch {}
      resolve(false)
    })
  })
}

// ---- 实际创建 PrismaClient -------------------------------------------------
function createPrisma(finalUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: finalUrl } },
    log: isDev ? ['warn', 'error'] : ['error'],
  })
}

async function pickAndCreatePrisma(): Promise<{ client: PrismaClient; chosen: Candidate }> {
  const cands = getCandidateUrls()
  if (cands.length === 0) {
    console.error('[prisma] ❌ 没有可用的 DATABASE_URL / LOCAL_DATABASE_URL / SUPABASE_DATABASE_URL')
    process.exit(1)
  }

  for (let i = 0; i < cands.length; i++) {
    const cand = cands[i]
    const normalized = normalizeDatabaseUrl(cand.url)
    // 本地候选先做 TCP 探测（2 秒超时），避免 Prisma 连接 30 秒才报错
    if (cand.name === 'LOCAL_DOCKER' || cand.name === 'LOCAL_EXPLICIT') {
      const ok = await testTcpReachable(cand.url, 2000)
      if (!ok) {
        console.log(`[prisma] ⚠️  本地候选 ${cand.name} TCP 2 秒内不可达，跳过`)
        continue
      }
    }
    const client = createPrisma(normalized)
    // 真正尝试验证（用户表查 1 行，最可靠）
    try {
      await client.$queryRaw`SELECT 1 AS ok LIMIT 1`
      return { client, chosen: cand }
    } catch (err: any) {
      console.log(`[prisma] ⚠️  ${cand.name} Prisma 测试失败: ${err?.message || 'unknown'}`)
      try { await client.$disconnect() } catch {}
      continue
    }
  }

  // 所有候选都失败：硬返回第一个让 Prisma 在真正请求时报错，不启动时退出
  console.error('[prisma] ❌ 所有数据库候选都连接失败')
  const last = cands[cands.length - 1]
  return { client: createPrisma(normalizeDatabaseUrl(last.url)), chosen: last }
}

// ---- 初始化（本文件首次 import 就开始异步探测，但在 client 就绪前会缓存 promise）
let prismaPromise: Promise<PrismaClient> | null = null
let chosenCandidate: Candidate | null = null

function ensurePrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return Promise.resolve(globalForPrisma.prisma)
  if (prismaPromise) return prismaPromise
  prismaPromise = (async () => {
    const { client, chosen } = await pickAndCreatePrisma()
    chosenCandidate = chosen
    const remote = isRemoteSupabaseUrl(chosen.url)
    let summary = '(invalid url)'
    try {
      const u = new URL(normalizeDatabaseUrl(chosen.url))
      summary = `${u.username || '-'}@${u.hostname}:${u.port || '5432'}/${u.pathname.replace('/', '')}`
    } catch {}

    const targetLabel =
      chosen.name === 'SUPABASE' || chosen.name === 'DATABASE_URL' || remote
        ? 'SUPABASE (remote, fallback)'
        : 'LOCAL PostgreSQL'

    console.log(
      `[prisma] NODE_ENV=${process.env.NODE_ENV || 'development'}  target=${targetLabel}  (via ${chosen.name})  ${summary}`
    )

    if (isDev) globalForPrisma.prisma = client
    return client
  })()
  return prismaPromise
}

// 立即开始探测（不阻塞模块加载，请求第一次来前大概率已就绪）
const __init = ensurePrisma().catch(() => {})

// ---------------------------------------------------------------
// 暴露默认 prisma：用两层 Proxy 正确还原 PrismaClient 的访问语法：
//
//   prisma.user.findFirst(...)   →   解析为：
//     get(prisma, 'user')           →  返回子 Proxy (delegate)
//     get(delegate, 'findFirst')    →  返回可 thenable 函数
//       调用函数时先 await client 就绪，再取 client.user.findFirst(...)
//
//   prisma.$queryRaw`...`
//   prisma.$transaction([...])
//   prisma.$disconnect()          →   顶层函数：直接 thenable 化
// ---------------------------------------------------------------
function makeDeferred(fnName: string, chain: string[] = []) {
  // thenable function：调用之前先 await 真实 client 就绪，再按路径解析
  const f = (async function (...args: any[]) {
    const client = await ensurePrisma()
    let cur: any = client
    for (const key of chain) {
      cur = cur[key]
      if (cur == null) throw new Error(`prisma${chain.map(k => '.' + k).join('')}: property ${key} not found`)
    }
    const leaf = fnName ? cur[fnName] : cur
    if (typeof leaf === 'function') return leaf.apply(cur, args)
    return leaf
  }) as any
  // 还需要支持继续 "链式取属性"（比如 prisma.user 还可以取 .findFirst）
  return new Proxy(f, {
    get(_target, nextProp) {
      if (nextProp === 'then') return undefined
      if (nextProp === Symbol.toPrimitive) return () => `Deferred(prisma${[...chain, fnName].filter(Boolean).map(k => '.' + k).join('')})`
      // 继续往链上挂，要么下一层 delegate（fnName 空），要么是方法
      const nextChain = fnName ? [...chain, fnName] : chain
      return makeDeferred(String(nextProp), nextChain)
    },
    apply(_target, _thisArg, args) {
      return f(...args)
    },
  })
}

type Prisma = PrismaClient
const prisma = new Proxy({} as Prisma, {
  get(_target, prop) {
    if (prop === '$prismaClient') return ensurePrisma
    if (prop === 'then') return undefined
    if (typeof prop === 'symbol') return undefined
    return makeDeferred(String(prop), [])
  },
}) as Prisma & { $prismaClient: () => Promise<PrismaClient> }

// 启动时最多等 5 秒，用于打印最终 target；超时也不阻塞（后续请求会继续等）
;(async () => {
  try { await Promise.race([__init, new Promise(res => setTimeout(res, 5000))]) } catch {}
})()

export default prisma
