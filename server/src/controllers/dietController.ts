import { Response } from 'express'
import prisma from '../config/prisma'
import { AuthRequest } from '../middleware/auth'
import { CreateDietBody } from '../types'
import { formatDate } from '../utils/format'

export const getRecords = async (req: AuthRequest, res: Response) => {
  try {
    const date = (req.query as any).date || new Date().toISOString().split('T')[0]

    const records = await prisma.dietRecord.findMany({
      where: {
        user_id: req.userId!,
        recorded_at: new Date(date),
      },
      orderBy: { created_at: 'desc' },
    })

    // 格式化 recorded_at Date → 'YYYY-MM-DD' 字符串（保持前端契约）
    const formatted = records.map(r => ({
      ...r,
      recorded_at: formatDate(r.recorded_at),
    }))

    res.json({ records: formatted, date })
  } catch (err) {
    console.error('Get records error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const addRecord = async (req: AuthRequest, res: Response) => {
  try {
    const {
      meal_type,
      food_name,
      calories,
      protein_grams,
      carbs_grams,
      fat_grams,
      portion_description,
      recorded_at,
    }: CreateDietBody = req.body

    if (!meal_type || !food_name) {
      res.status(400).json({ error: 'meal_type and food_name are required' })
      return
    }

    const validTypes = ['breakfast', 'lunch', 'dinner', 'snack']
    if (!validTypes.includes(meal_type)) {
      res.status(400).json({ error: `meal_type must be one of: ${validTypes.join(', ')}` })
      return
    }

    const date = recorded_at || new Date().toISOString().split('T')[0]

    const record = await prisma.dietRecord.create({
      data: {
        user_id: req.userId!,
        meal_type,
        food_name,
        calories: calories ?? null,
        protein_grams: protein_grams ?? null,
        carbs_grams: carbs_grams ?? null,
        fat_grams: fat_grams ?? null,
        portion_description: portion_description ?? null,
        recorded_at: new Date(date),
      },
    })

    res.status(201).json({
      record: {
        ...record,
        recorded_at: formatDate(record.recorded_at),
      },
    })
  } catch (err) {
    console.error('Add record error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const existing = await prisma.dietRecord.findFirst({
      where: { id: Number(id), user_id: req.userId! },
      select: { id: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Record not found' })
      return
    }

    await prisma.dietRecord.delete({ where: { id: existing.id } })
    res.json({ message: 'Record deleted' })
  } catch (err) {
    console.error('Delete record error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const startDate = (req.query as any).start
    const endDate = (req.query as any).end

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'start and end query parameters are required (YYYY-MM-DD)' })
      return
    }

    const where = {
      user_id: req.userId!,
      recorded_at: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    }

    const agg = await prisma.dietRecord.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        calories: true,
        protein_grams: true,
        carbs_grams: true,
        fat_grams: true,
      },
    })

    const summary = {
      total_entries: agg._count._all,
      total_calories: agg._sum.calories ?? 0,
      total_protein: agg._sum.protein_grams ?? 0,
      total_carbs: agg._sum.carbs_grams ?? 0,
      total_fat: agg._sum.fat_grams ?? 0,
    }

    const daily = await prisma.dietRecord.groupBy({
      by: ['recorded_at'],
      where,
      _sum: {
        calories: true,
        protein_grams: true,
        carbs_grams: true,
        fat_grams: true,
      },
      _count: { _all: true },
      orderBy: { recorded_at: 'asc' },
    })

    const dailyFormatted = daily.map(d => ({
      recorded_at: formatDate(d.recorded_at),
      daily_calories: d._sum.calories ?? 0,
      daily_protein: d._sum.protein_grams ?? 0,
      daily_carbs: d._sum.carbs_grams ?? 0,
      daily_fat: d._sum.fat_grams ?? 0,
      entries: d._count._all,
    }))

    res.json({
      summary,
      daily: dailyFormatted,
      dateRange: { start: startDate, end: endDate },
    })
  } catch (err) {
    console.error('Get summary error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
