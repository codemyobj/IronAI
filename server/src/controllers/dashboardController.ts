import { Response } from 'express'
import prisma from '../config/prisma'
import { AuthRequest } from '../middleware/auth'
import { formatDate } from '../utils/format'
import type { SafeUser } from '../types'

// 复用 authController 的 toSafeUser（保持返回契约一致）
function toSafeUser(user: any): SafeUser {
  const { password_hash, ...safe } = user
  return safe
}

// ============================================================
// 短期内存缓存（Dashboard 专用）
// ------------------------------------------------------------
// 数据库是远程 Supabase us-east-1，每次查询要跨太平洋 RTT。
// Dashboard 是首页，用户最常刷新的地方 → 30 秒内重复
// 访问直接给缓存，不打远程 DB。用户做了写操作（添加训练/
// 记录饮食）后，由各自的 controller 调用 invalidateDashboardCache。
// ============================================================
interface CacheEntry {
  body: any
  expiresAt: number
}
const DASHBOARD_CACHE_TTL_MS = 30 * 1000
const dashboardCacheByUser = new Map<number, CacheEntry>()

export function invalidateDashboardCache(userId: number) {
  dashboardCacheByUser.delete(userId)
}

function getCached(userId: number): any | null {
  const hit = dashboardCacheByUser.get(userId)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    dashboardCacheByUser.delete(userId)
    return null
  }
  return hit.body
}

function setCached(userId: number, body: any) {
  dashboardCacheByUser.set(userId, {
    body,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
  })
}

// ============================================================
// Dashboard 聚合接口：5 合 1
// ------------------------------------------------------------
// 原来前端 Dashboard 会并发请求 5 个接口：
//   1. GET /api/auth/me            (user profile)
//   2. GET /api/training/programs  (active programs)
//   3. GET /api/training/sessions?limit=5 (recent sessions)
//   4. GET /api/diet/records?date=today (today's diet records)
//   5. GET /api/diet/summary?start=...&end=... (7-day calorie trend)
//
// 因为数据库是远程 Supabase (us-east-1)，每个请求都要走跨
// 太平洋 RTT。5 个请求就等于 5 次 RTT 叠加。聚合后：
//   - 前端只发 1 次 HTTP 请求（省 4 次 RTT 握手）
//   - 后端用 Promise.all 并行发 5 条 Prisma 查询（现在连接池
//     connection_limit=5，真的能并发命中 DB）
//   - DB 端 5 条查询共享同一个 TCP 连接的 TLS 握手成本
// ============================================================
export const getDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!

  // 快速路径：30 秒内同用户重复访问直接给缓存，跳过远程 DB。
  // 对于在 Supabase us-east-1 上的 DB，这能把 3s 变 <1ms。
  const cached = getCached(userId)
  if (cached) {
    res.setHeader('X-Dashboard-Cache', 'HIT')
    res.json(cached)
    return
  }

  const todayISO = new Date().toISOString().split('T')[0]
  const today = new Date(todayISO)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoDate = new Date(weekAgo.toISOString().split('T')[0])

  try {
    // 并行执行所有查询：后端只等一次"最慢单查询"
    const [
      user,
      programs,
      sessionsRaw,
      todayRecordsRaw,
      dietSumAgg,
      dietDaily,
    ] = await Promise.all([
      // 1. 用户信息（对应 /api/auth/me）
      prisma.user.findFirst({ where: { id: userId } }),

      // 2. 训练计划数量（对应 /api/training/programs，只取条数+前5条展示）
      prisma.trainingProgram.findMany({
        where: { user_id: userId, is_active: true },
        orderBy: { created_at: 'desc' },
      }),

      // 3. 最近训练（对应 /api/training/sessions?limit=5）
      prisma.trainingSession.findMany({
        where: { user_id: userId },
        include: { program: { select: { name: true } } },
        orderBy: { started_at: 'desc' },
        take: 5,
      }),

      // 4. 今日饮食记录（对应 /api/diet/records?date=today）
      prisma.dietRecord.findMany({
        where: { user_id: userId, recorded_at: today },
        orderBy: { created_at: 'desc' },
      }),

      // 5a. 7 天汇总（对应 /api/diet/summary 的 summary 部分）
      prisma.dietRecord.aggregate({
        where: {
          user_id: userId,
          recorded_at: { gte: weekAgoDate, lte: today },
        },
        _count: { _all: true },
        _sum: {
          calories: true,
          protein_grams: true,
          carbs_grams: true,
          fat_grams: true,
        },
      }),

      // 5b. 7 天每日热量（对应 /api/diet/summary 的 daily 部分）
      prisma.dietRecord.groupBy({
        by: ['recorded_at'],
        where: {
          user_id: userId,
          recorded_at: { gte: weekAgoDate, lte: today },
        },
        _sum: { calories: true, protein_grams: true, carbs_grams: true, fat_grams: true },
        _count: { _all: true },
        orderBy: { recorded_at: 'asc' },
      }),
    ])

    // 组装返回值，保持与前端原来各接口完全一致的字段格式，
    // 前端改动最小。
    const sessions = sessionsRaw.map(s => {
      const { program, ...rest } = s
      return { ...rest, program_name: program?.name ?? null }
    })

    const todayRecords = todayRecordsRaw.map(r => ({
      ...r,
      recorded_at: formatDate(r.recorded_at),
    }))

    const todayCalories = todayRecords.reduce(
      (sum, r) => sum + Number(r.calories || 0),
      0
    )

    const daily = dietDaily.map(d => ({
      recorded_at: formatDate(d.recorded_at),
      daily_calories: d._sum.calories ?? 0,
      daily_protein: d._sum.protein_grams ?? 0,
      daily_carbs: d._sum.carbs_grams ?? 0,
      daily_fat: d._sum.fat_grams ?? 0,
      entries: d._count._all,
    }))

    const body = {
      user: user ? toSafeUser(user) : null,
      stats: {
        programCount: programs.length,
        sessionCount: sessions.length,
        todayCalories,
        recentSessions: sessions,
      },
      // 图表数据
      calorieTrendDaily: daily,
      dietSummary: {
        total_entries: dietSumAgg._count._all,
        total_calories: dietSumAgg._sum.calories ?? 0,
        total_protein: dietSumAgg._sum.protein_grams ?? 0,
        total_carbs: dietSumAgg._sum.carbs_grams ?? 0,
        total_fat: dietSumAgg._sum.fat_grams ?? 0,
      },
      dateRange: {
        today: todayISO,
        weekStart: formatDate(weekAgoDate),
      },
    }

    setCached(userId, body)
    res.setHeader('X-Dashboard-Cache', 'MISS')
    res.json(body)
  } catch (err) {
    console.error('Dashboard error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
