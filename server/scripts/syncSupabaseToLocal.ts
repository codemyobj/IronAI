// ============================================================
// 同步脚本：Supabase (远程) → 本地 Docker PostgreSQL
// ------------------------------------------------------------
// 用法：
//   1. 先确保本地 PG 已经启动并健康：pnpm db:up
//   2. 在项目根目录运行：pnpm db:sync
//
// 效果：
//   - 清空本地库 6 张业务表（users / training_programs / exercises /
//     training_sessions / diet_records / ai_analyses）
//   - 从 Supabase 按表读所有行，按依赖顺序写回本地
//   - 重置每个表的自增序列到远程最大值 + 1，避免后续 INSERT 冲突
//   - 全程不走 pg_dump/pg_restore（用户机器通常没装 psql 客户端），
//     纯 Prisma + 原生 SQL 实现，0 外部依赖
// ============================================================

import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env', import.meta.url).pathname.slice(1).replace(/^\/([A-Z]:)/, '$1') })

import { PrismaClient } from '@prisma/client'

// 手动构造两个 Prisma Client — 一个连 Supabase 远程，一个连本地
// 返回 PrismaClient 本身（构造参数严格受 Prisma 校验，不能塞自定义字段）。
type LabeledPrisma = PrismaClient & { __label?: string }
function buildClient(url: string, label: string, log: boolean = false): LabeledPrisma {
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: log ? (['info', 'warn', 'error'] as const) : (['warn', 'error'] as const),
  }) as LabeledPrisma
  client.__label = label
  return client
}

// Supabase：必须带 PgBouncer 兼容参数
const supabaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || ''
if (!supabaseUrl) {
  console.error('❌ 缺少 SUPABASE_DATABASE_URL。请检查 server/.env')
  process.exit(1)
}
const supabaseUrlSafe = (() => {
  const u = new URL(supabaseUrl)
  u.searchParams.set('pgbouncer', 'true')
  u.searchParams.set('statement_cache_size', '0')
  u.searchParams.set('connection_limit', '3')
  return u.toString()
})()

// 本地：使用 LOCAL_DATABASE_URL 或默认值
const localUrl =
  process.env.LOCAL_DATABASE_URL ||
  'postgresql://ironai:ironai@localhost:5432/ironai?connection_limit=10&connect_timeout=5'

console.log(`🔌 连接 Supabase:  ${new URL(supabaseUrlSafe).hostname}:${new URL(supabaseUrlSafe).port || 5432}`)
console.log(`🔌 连接本地 PG:    ${new URL(localUrl).hostname}:${new URL(localUrl).port || 5432}`)

const remote = buildClient(supabaseUrlSafe, 'supabase')
const local  = buildClient(localUrl, 'local')

// 按依赖顺序清空（先子表后父表），按父到子的顺序写入
const TABLES_INSERT_ORDER = [
  'users',
  'training_programs',
  'exercises',
  'training_sessions',
  'diet_records',
  'ai_analyses',
] as const
const TABLES_DELETE_ORDER = [
  'ai_analyses',
  'diet_records',
  'training_sessions',
  'exercises',
  'training_programs',
  'users',
] as const

type TableName = (typeof TABLES_INSERT_ORDER)[number]

// Supabase 的 Prisma schema 把所有表都放在 default schema，这里用 $queryRawUnsafe
// 因为我们需要通用地"读所有行 + 批量 INSERT"。
async function main() {
  // Step 1: 连接性检查
  try {
    await remote.$queryRawUnsafe(`SELECT 1 AS ok`)
    console.log('✅ Supabase 可达')
  } catch (e: any) {
    console.error('❌ Supabase 连接失败：', e.message)
    process.exit(2)
  }

  try {
    await local.$queryRawUnsafe(`SELECT 1 AS ok`)
    console.log('✅ 本地 PostgreSQL 可达')
  } catch (e: any) {
    console.error('❌ 本地 PostgreSQL 连接失败。先运行  pnpm db:up  启动 Docker。\n   原始错误：', e.message)
    process.exit(2)
  }

  // Step 2: 从 Supabase 拉所有行
  console.log('\n📥 从 Supabase 读取数据…')
  const dataByTable: Record<TableName, any[]> = {} as any
  for (const tbl of TABLES_INSERT_ORDER) {
    // count first for progress
    const [{ count }]: any = await remote.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM "${tbl}"`
    ) as any
    const rows: any[] = await remote.$queryRawUnsafe(
      `SELECT * FROM "${tbl}" ORDER BY id ASC`
    ) as any
    dataByTable[tbl] = rows
    console.log(`   ${tbl.padEnd(22, ' ')}  ${String(count).padStart(6, ' ')} 行`)
  }

  // Step 3: 清空本地子→父
  console.log('\n🧹 清空本地表（按外键顺序）…')
  for (const tbl of TABLES_DELETE_ORDER) {
    await local.$queryRawUnsafe(`TRUNCATE TABLE "${tbl}" RESTART IDENTITY CASCADE`)
    console.log(`   ${tbl}`)
  }

  // Step 4: 按父→子插入
  console.log('\n📤 写入本地 PostgreSQL…')
  for (const tbl of TABLES_INSERT_ORDER) {
    const rows = dataByTable[tbl]
    if (rows.length === 0) {
      console.log(`   ${tbl.padEnd(22, ' ')}  (空，跳过)`)
      continue
    }
    // 批量插入：把每一行字段都转成 postgres 字面量。
    // 用 Prisma 的原始 SQL 直接按列名映射。为了稳定，用 500 行一批。
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const cols = Object.keys(batch[0])
      const valuesSqlParts: string[] = []
      const params: any[] = []
      let p = 1
      for (const row of batch) {
        const placeholders = cols.map(c => {
          params.push((row as any)[c])
          return `$${p++}`
        }).join(', ')
        valuesSqlParts.push(`(${placeholders})`)
      }
      const colList = cols.map(c => `"${c}"`).join(', ')
      const sql = `INSERT INTO "${tbl}" (${colList}) VALUES ${valuesSqlParts.join(', ')}`
      await local.$queryRawUnsafe(sql, ...params)
    }
    console.log(`   ${tbl.padEnd(22, ' ')}  ${String(rows.length).padStart(6, ' ')} 行 ✓`)
  }

  // Step 5: 重置各表自增序列，避免接下来 INSERT id 冲突
  console.log('\n🔧 重置本地自增序列…')
  for (const tbl of TABLES_INSERT_ORDER) {
    const seqRow = await local.$queryRawUnsafe(`
      SELECT pg_get_serial_sequence('"${tbl}"', 'id') AS seq
    `) as any
    const seq = seqRow[0]?.seq
    if (seq) {
      const maxRow = await local.$queryRawUnsafe(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM "${tbl}"`
      ) as any
      const next = Number(maxRow[0]?.next_id ?? 1)
      await local.$executeRawUnsafe(`SELECT setval('${seq}', ${next}, false)`)
      console.log(`   ${tbl.padEnd(22, ' ')}  → 下一个 id = ${next}`)
    }
  }

  console.log('\n✅ 同步完成！现在启动后端会自动连本地库。')
}

main()
  .catch(err => {
    console.error('❌ 同步失败：', err)
    process.exit(1)
  })
  .finally(async () => {
    await remote.$disconnect()
    await local.$disconnect()
  })
