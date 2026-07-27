import { Response } from 'express'
import pool from '../config/db'
import { AuthRequest } from '../middleware/auth'
import { CreateProgramBody, CreateSessionBody } from '../types'

export const getPrograms = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM training_programs WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [req.userId!]
    )
    res.json({ programs: result.rows })
  } catch (err) {
    console.error('Get programs error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const programResult = await pool.query(
      'SELECT * FROM training_programs WHERE id = $1 AND user_id = $2',
      [id, req.userId!]
    )

    if (programResult.rows.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    const exerciseResult = await pool.query(
      'SELECT * FROM exercises WHERE program_id = $1 ORDER BY sort_order ASC',
      [id]
    )

    res.json({
      program: {
        ...programResult.rows[0],
        exercises: exerciseResult.rows,
      },
    })
  } catch (err) {
    console.error('Get program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, difficulty, target_muscle_group, exercises = [] }: CreateProgramBody = req.body

    if (!name) {
      res.status(400).json({ error: 'Program name is required' })
      return
    }

    const result = await pool.query(
      `INSERT INTO training_programs (user_id, name, description, difficulty, target_muscle_group)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.userId!, name, description ?? null, difficulty ?? 'beginner', target_muscle_group ?? null]
    )

    const programId = result.rows[0].id

    if (exercises.length > 0) {
      const placeholders: string[] = []
      const values: any[] = []
      exercises.forEach((ex, i) => {
        const baseIdx = i * 7
        placeholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7})`)
        values.push(
          programId,
          ex.name,
          ex.sets ?? 3,
          ex.reps ?? 10,
          ex.weight_kg ?? null,
          ex.rest_seconds ?? 60,
          ex.notes ?? null,
        )
      })

      await pool.query(
        `INSERT INTO exercises (program_id, name, sets, reps, weight_kg, rest_seconds, notes, sort_order)
         VALUES ${placeholders.join(', ')}`,
        values
      )
    }

    const createdResult = await pool.query(
      'SELECT * FROM training_programs WHERE id = $1',
      [programId]
    )
    const createdExercises = await pool.query(
      'SELECT * FROM exercises WHERE program_id = $1',
      [programId]
    )

    res.status(201).json({
      program: { ...createdResult.rows[0], exercises: createdExercises.rows },
    })
  } catch (err) {
    console.error('Create program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, difficulty, target_muscle_group }: CreateProgramBody = req.body

    const existing = await pool.query(
      'SELECT id FROM training_programs WHERE id = $1 AND user_id = $2',
      [id, req.userId!]
    )
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    await pool.query(
      `UPDATE training_programs
       SET name = $1, description = $2, difficulty = $3, target_muscle_group = $4
       WHERE id = $5`,
      [name, description ?? null, difficulty ?? 'beginner', target_muscle_group ?? null, id]
    )

    const updated = await pool.query(
      'SELECT * FROM training_programs WHERE id = $1',
      [id]
    )
    res.json({ program: updated.rows[0] })
  } catch (err) {
    console.error('Update program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const existing = await pool.query(
      'SELECT id FROM training_programs WHERE id = $1 AND user_id = $2',
      [id, req.userId!]
    )
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    await pool.query(
      'UPDATE training_programs SET is_active = FALSE WHERE id = $1',
      [id]
    )

    res.json({ message: 'Program deleted' })
  } catch (err) {
    console.error('Delete program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const addExercise = async (req: AuthRequest, res: Response) => {
  try {
    const { programId } = req.params
    const { name, sets, reps, weight_kg, rest_seconds, notes } = req.body

    if (!name) {
      res.status(400).json({ error: 'Exercise name is required' })
      return
    }

    const program = await pool.query(
      'SELECT id FROM training_programs WHERE id = $1 AND user_id = $2',
      [programId, req.userId!]
    )
    if (program.rows.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    const lastEx = await pool.query(
      'SELECT MAX(sort_order) as max_order FROM exercises WHERE program_id = $1',
      [programId]
    )
    const sortOrder = (lastEx.rows[0]?.max_order ?? -1) + 1

    const result = await pool.query(
      `INSERT INTO exercises (program_id, name, sets, reps, weight_kg, rest_seconds, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [programId, name, sets ?? 3, reps ?? 10, weight_kg ?? null, rest_seconds ?? 60, notes ?? null, sortOrder]
    )

    const created = await pool.query(
      'SELECT * FROM exercises WHERE id = $1',
      [result.rows[0].id]
    )
    res.status(201).json({ exercise: created.rows[0] })
  } catch (err) {
    console.error('Add exercise error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteExercise = async (req: AuthRequest, res: Response) => {
  try {
    const { exerciseId } = req.params

    const rows = await pool.query(
      `SELECT e.id FROM exercises e
       JOIN training_programs tp ON e.program_id = tp.id
       WHERE e.id = $1 AND tp.user_id = $2`,
      [exerciseId, req.userId!]
    )
    if (rows.rows.length === 0) {
      res.status(404).json({ error: 'Exercise not found' })
      return
    }

    await pool.query('DELETE FROM exercises WHERE id = $1', [exerciseId])
    res.json({ message: 'Exercise deleted' })
  } catch (err) {
    console.error('Delete exercise error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt((req.query as any).limit) || 30

    const result = await pool.query(
      `SELECT ts.*, tp.name as program_name
       FROM training_sessions ts
       LEFT JOIN training_programs tp ON ts.program_id = tp.id
       WHERE ts.user_id = $1
       ORDER BY ts.started_at DESC
       LIMIT $2`,
      [req.userId!, limit]
    )
    res.json({ sessions: result.rows })
  } catch (err) {
    console.error('Get sessions error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const logSession = async (req: AuthRequest, res: Response) => {
  try {
    const { program_id, duration_minutes, perceived_effort, notes }: CreateSessionBody = req.body

    if (program_id) {
      const program = await pool.query(
        'SELECT id FROM training_programs WHERE id = $1 AND user_id = $2',
        [program_id, req.userId!]
      )
      if (program.rows.length === 0) {
        res.status(404).json({ error: 'Program not found' })
        return
      }
    }

    const result = await pool.query(
      `INSERT INTO training_sessions (user_id, program_id, duration_minutes, perceived_effort, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.userId!, program_id ?? null, duration_minutes ?? null, perceived_effort ?? null, notes ?? null]
    )

    const created = await pool.query(
      'SELECT * FROM training_sessions WHERE id = $1',
      [result.rows[0].id]
    )
    res.status(201).json({ session: created.rows[0] })
  } catch (err) {
    console.error('Log session error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
