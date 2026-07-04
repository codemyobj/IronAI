// ============================================================
// Diet Controller — CRUD for daily food/diet records
//
// Key feature: summary endpoint that calculates totals
// (calories, protein, carbs, fat) for a date range
// ============================================================

import { Response } from 'express'
import pool from '../config/db'
import { AuthRequest } from '../middleware/auth'
import { CreateDietBody } from '../types'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

// ============================================================
// GET /api/diet/records?date=2026-06-23 — get records for a day
// If no date provided, defaults to today
// ============================================================
export const getRecords = async (req: AuthRequest, res: Response) => {
  try {
    // Default to today's date if not specified
    const date = (req.query as any).date || new Date().toISOString().split('T')[0]

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM diet_records
       WHERE user_id = ? AND recorded_at = ?
       ORDER BY created_at DESC`,
      [req.userId!, date]
    )

    res.json({ records: rows, date })
  } catch (err) {
    console.error('Get records error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// POST /api/diet/records — add a food entry
// ============================================================
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

    // Validation
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

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO diet_records
       (user_id, meal_type, food_name, calories, protein_grams, carbs_grams, fat_grams, portion_description, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const [created] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM diet_records WHERE id = ?',
      [result.insertId]
    )
    res.status(201).json({ record: created[0] })
  } catch (err) {
    console.error('Add record error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// DELETE /api/diet/records/:id — delete a food entry
// ============================================================
export const deleteRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Verify ownership
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM diet_records WHERE id = ? AND user_id = ?',
      [id, req.userId!]
    )
    if (existing.length === 0) {
      res.status(404).json({ error: 'Record not found' })
      return
    }

    await pool.query('DELETE FROM diet_records WHERE id = ?', [id])
    res.json({ message: 'Record deleted' })
  } catch (err) {
    console.error('Delete record error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// GET /api/diet/summary?start=2026-06-20&end=2026-06-27
// Returns total calories and macros for a date range
// ============================================================
export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const startDate = (req.query as any).start
    const endDate = (req.query as any).end

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'start and end query parameters are required (YYYY-MM-DD)' })
      return
    }

    // SQL aggregation: SUM groups all matching rows and adds up the values
    // COALESCE turns NULL into 0 so the math works
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_entries,
         COALESCE(SUM(calories), 0) as total_calories,
         COALESCE(SUM(protein_grams), 0) as total_protein,
         COALESCE(SUM(carbs_grams), 0) as total_carbs,
         COALESCE(SUM(fat_grams), 0) as total_fat
       FROM diet_records
       WHERE user_id = ? AND recorded_at BETWEEN ? AND ?`,
      [req.userId!, startDate, endDate]
    )

    // Also get per-day breakdown
    const [dailyRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         recorded_at,
         COALESCE(SUM(calories), 0) as daily_calories,
         COALESCE(SUM(protein_grams), 0) as daily_protein,
         COALESCE(SUM(carbs_grams), 0) as daily_carbs,
         COALESCE(SUM(fat_grams), 0) as daily_fat,
         COUNT(*) as entries
       FROM diet_records
       WHERE user_id = ? AND recorded_at BETWEEN ? AND ?
       GROUP BY recorded_at
       ORDER BY recorded_at ASC`,
      [req.userId!, startDate, endDate]
    )

    res.json({
      summary: rows[0],
      daily: dailyRows,
      dateRange: { start: startDate, end: endDate },
    })
  } catch (err) {
    console.error('Get summary error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
