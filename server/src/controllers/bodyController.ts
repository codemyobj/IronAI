import { Response } from 'express'
import prisma from '../config/prisma'
import { AuthRequest } from '../middleware/auth'
import { CreateBodyMeasurementBody } from '../types'
import { formatDate } from '../utils/format'
import { invalidateDashboardCache } from './dashboardController'

const toSafeMeasurement = (m: any) => ({
  id: m.id,
  user_id: m.user_id,
  weight_kg: Number(m.weight_kg),
  body_fat_pct: m.body_fat_pct != null ? Number(m.body_fat_pct) : null,
  muscle_kg: m.muscle_kg != null ? Number(m.muscle_kg) : null,
  waist_cm: m.waist_cm != null ? Number(m.waist_cm) : null,
  measured_at: formatDate(m.measured_at),
  created_at: m.created_at,
})

/** GET /api/body/records?days=30 — 最近 N 天的体测记录（按日期升序，便于画图） */
export const getRecords = async (req: AuthRequest, res: Response) => {
  try {
    const days = Number((req.query as any).days) || 30
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)

    const records = await prisma.bodyMeasurement.findMany({
      where: {
        user_id: req.userId!,
        measured_at: { gte: start },
      },
      orderBy: { measured_at: 'asc' },
    })

    res.json({ records: records.map(toSafeMeasurement), days })
  } catch (err) {
    console.error('Get body records error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/** POST /api/body/records — 新增一条体测记录，同时把体重同步到 users 表 */
export const addRecord = async (req: AuthRequest, res: Response) => {
  try {
    const {
      weight_kg,
      body_fat_pct,
      muscle_kg,
      waist_cm,
      measured_at,
    }: CreateBodyMeasurementBody = req.body

    // 必填校验
    if (weight_kg == null || isNaN(Number(weight_kg)) || Number(weight_kg) <= 0) {
      res.status(400).json({ error: 'weight_kg must be a positive number' })
      return
    }

    const w = Number(weight_kg)
    if (w < 20 || w > 500) {
      res.status(400).json({ error: 'weight_kg must be between 20 and 500' })
      return
    }

    // 可选数值校验
    const optionalFields: [string, number | undefined, number, number][] = [
      ['body_fat_pct', body_fat_pct, 1, 80],
      ['muscle_kg', muscle_kg, 10, 500],
      ['waist_cm', waist_cm, 30, 300],
    ]
    for (const [key, val, min, max] of optionalFields) {
      if (val !== undefined && val !== null) {
        const v = Number(val)
        if (isNaN(v) || v < min || v > max) {
          res.status(400).json({ error: `${key} must be between ${min} and ${max}` })
          return
        }
      }
    }

    const date = measured_at || new Date().toISOString().split('T')[0]

    const record = await prisma.bodyMeasurement.create({
      data: {
        user_id: req.userId!,
        weight_kg: w,
        body_fat_pct: body_fat_pct != null ? Number(body_fat_pct) : null,
        muscle_kg: muscle_kg != null ? Number(muscle_kg) : null,
        waist_cm: waist_cm != null ? Number(waist_cm) : null,
        measured_at: new Date(date),
      },
    })

    // 同步更新 users.weight_kg（保持个人资料页一致）
    await prisma.user.update({
      where: { id: req.userId! },
      data: { weight_kg: w },
    })

    invalidateDashboardCache(req.userId!)
    res.status(201).json({ record: toSafeMeasurement(record) })
  } catch (err) {
    console.error('Add body record error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
