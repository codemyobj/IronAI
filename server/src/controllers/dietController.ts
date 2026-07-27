import { Response } from 'express'
import pool from '../config/db'
import { AuthRequest } from '../middleware/auth'
import { CreateDietBody } from '../types'

export const getRecords = async (req: AuthRequest, res: Response) => {
  try {
    const date = (req.query as any).date || new Date().toISOString().split('T')[0]

    const result = await pool.query(
      `SELECT * FROM diet_records
       WHERE user_id = $1 AND recorded_at = $2
       ORDER BY created_at DESC`,
      [req.userId!, date]
    )

    res.json({ records: result.rows, date })
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

    const result = await pool.query(
      `INSERT INTO diet_records
       (user_id, meal_type, food_name, calories, protein_grams, carbs_grams, fat_grams, portion_description, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        req.userId!,
        meal_type,
        food_name,
        calories ?? null,
        protein_grams ?? null,
        carbs_grams ?? null,
        fat_grams ?? null,
        portion_description ?? null,
        date,
      ]
    )

    const created = await pool.query(
      'SELECT * FROM diet_records WHERE id = $1',
      [result.rows[0].id]
    )
    res.status(201).json({ record: created.rows[0] })
  } catch (err) {
    console.error('Add record error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const existing = await pool.query(
      'SELECT id FROM diet_records WHERE id = $1 AND user_id = $2',
      [id, req.userId!]
    )
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Record not found' })
      return
    }

    await pool.query('DELETE FROM diet_records WHERE id = $1', [id])
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

    const summaryResult = await pool.query(
      `SELECT
         COUNT(*) as total_entries,
         COALESCE(SUM(calories), 0) as total_calories,
         COALESCE(SUM(protein_grams), 0) as total_protein,
         COALESCE(SUM(carbs_grams), 0) as total_carbs,
         COALESCE(SUM(fat_grams), 0) as total_fat
       FROM diet_records
       WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3`,
      [req.userId!, startDate, endDate]
    )

    const dailyResult = await pool.query(
      `SELECT
         recorded_at,
         COALESCE(SUM(calories), 0) as daily_calories,
         COALESCE(SUM(protein_grams), 0) as daily_protein,
         COALESCE(SUM(carbs_grams), 0) as daily_carbs,
         COALESCE(SUM(fat_grams), 0) as daily_fat,
         COUNT(*) as entries
       FROM diet_records
       WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3
       GROUP BY recorded_at
       ORDER BY recorded_at ASC`,
      [req.userId!, startDate, endDate]
    )

    res.json({
      summary: summaryResult.rows[0],
      daily: dailyResult.rows,
      dateRange: { start: startDate, end: endDate },
    })
  } catch (err) {
    console.error('Get summary error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
