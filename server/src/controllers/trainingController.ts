// ============================================================
// Training Controller — CRUD for programs, exercises, and sessions
//
// Pattern demonstrated: ONE controller handles related resources.
// Programs contain exercises (1:many relationship).
// Sessions are independent records of completed workouts.
// ============================================================

import { Response } from 'express'
import pool from '../config/db'
import { AuthRequest } from '../middleware/auth'
import { CreateProgramBody, CreateSessionBody } from '../types'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

// ============================================================
// TRAINING PROGRAMS
// ============================================================

// GET /api/training/programs — list all programs for the logged-in user
export const getPrograms = async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM training_programs WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC',
      [req.userId!]
    )
    res.json({ programs: rows })
  } catch (err) {
    console.error('Get programs error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/training/programs/:id — get ONE program WITH its exercises
export const getProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Fetch the program
    const [programRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM training_programs WHERE id = ? AND user_id = ?',
      [id, req.userId!]
    )

    if (programRows.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    // Fetch exercises for this program, ordered by sort_order
    const [exerciseRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM exercises WHERE program_id = ? ORDER BY sort_order ASC',
      [id]
    )

    // Return program WITH exercises nested inside
    res.json({
      program: {
        ...programRows[0],
        exercises: exerciseRows,
      },
    })
  } catch (err) {
    console.error('Get program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/training/programs — create a new program (optionally with exercises)
export const createProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, difficulty, target_muscle_group, exercises = [] }: CreateProgramBody = req.body

    if (!name) {
      res.status(400).json({ error: 'Program name is required' })
      return
    }

    // Insert the program
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO training_programs (user_id, name, description, difficulty, target_muscle_group)
       VALUES (?, ?, ?, ?, ?)`,
      [req.userId!, name, description ?? null, difficulty ?? 'beginner', target_muscle_group ?? null]
    )

    const programId = result.insertId

    // If exercises were provided, insert them all
    if (exercises.length > 0) {
      const values = exercises.map((ex, i) => [
        programId,
        ex.name,
        ex.sets ?? 3,
        ex.reps ?? 10,
        ex.weight_kg ?? null,
        ex.rest_seconds ?? 60,
        ex.notes ?? null,
        i, // sort_order — preserves the order the client sent
      ])

      // Batch INSERT — one query, many rows (efficient!)
      await pool.query(
        `INSERT INTO exercises (program_id, name, sets, reps, weight_kg, rest_seconds, notes, sort_order)
         VALUES ?`,
        [values]
      )
    }

    // Return the created program with exercises
    const [created] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM training_programs WHERE id = ?',
      [programId]
    )
    const [createdExercises] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM exercises WHERE program_id = ?',
      [programId]
    )

    res.status(201).json({
      program: { ...created[0], exercises: createdExercises },
    })
  } catch (err) {
    console.error('Create program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /api/training/programs/:id — update a program
export const updateProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, difficulty, target_muscle_group }: CreateProgramBody = req.body

    // Verify ownership — user can only update their OWN programs
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM training_programs WHERE id = ? AND user_id = ?',
      [id, req.userId!]
    )
    if (existing.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    await pool.query(
      `UPDATE training_programs
       SET name = ?, description = ?, difficulty = ?, target_muscle_group = ?
       WHERE id = ?`,
      [name, description ?? null, difficulty ?? 'beginner', target_muscle_group ?? null, id]
    )

    const [updated] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM training_programs WHERE id = ?',
      [id]
    )
    res.json({ program: updated[0] })
  } catch (err) {
    console.error('Update program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/training/programs/:id — soft-delete a program (set is_active = FALSE)
export const deleteProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM training_programs WHERE id = ? AND user_id = ?',
      [id, req.userId!]
    )
    if (existing.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    // Soft delete — keeps the data, just marks it inactive
    // This is safer than hard DELETE (can be recovered, preserves history)
    await pool.query(
      'UPDATE training_programs SET is_active = FALSE WHERE id = ?',
      [id]
    )

    res.json({ message: 'Program deleted' })
  } catch (err) {
    console.error('Delete program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// EXERCISES (nested under programs)
// ============================================================

// POST /api/training/programs/:programId/exercises — add an exercise to a program
export const addExercise = async (req: AuthRequest, res: Response) => {
  try {
    const { programId } = req.params
    const { name, sets, reps, weight_kg, rest_seconds, notes } = req.body

    if (!name) {
      res.status(400).json({ error: 'Exercise name is required' })
      return
    }

    // Verify program belongs to user
    const [program] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM training_programs WHERE id = ? AND user_id = ?',
      [programId, req.userId!]
    )
    if (program.length === 0) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    // Get next sort_order
    const [lastEx] = await pool.query<RowDataPacket[]>(
      'SELECT MAX(sort_order) as max_order FROM exercises WHERE program_id = ?',
      [programId]
    )
    const sortOrder = (lastEx[0]?.max_order ?? -1) + 1

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO exercises (program_id, name, sets, reps, weight_kg, rest_seconds, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [programId, name, sets ?? 3, reps ?? 10, weight_kg ?? null, rest_seconds ?? 60, notes ?? null, sortOrder]
    )

    const [created] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM exercises WHERE id = ?',
      [result.insertId]
    )
    res.status(201).json({ exercise: created[0] })
  } catch (err) {
    console.error('Add exercise error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/training/exercises/:exerciseId — remove an exercise
export const deleteExercise = async (req: AuthRequest, res: Response) => {
  try {
    const { exerciseId } = req.params

    // Verify the exercise belongs to one of the user's programs
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT e.id FROM exercises e
       JOIN training_programs tp ON e.program_id = tp.id
       WHERE e.id = ? AND tp.user_id = ?`,
      [exerciseId, req.userId!]
    )
    if (rows.length === 0) {
      res.status(404).json({ error: 'Exercise not found' })
      return
    }

    await pool.query('DELETE FROM exercises WHERE id = ?', [exerciseId])
    res.json({ message: 'Exercise deleted' })
  } catch (err) {
    console.error('Delete exercise error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// TRAINING SESSIONS (workout log)
// ============================================================

// GET /api/training/sessions — list recent sessions
export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    // Express 5 — req.query may need special handling; cast to any for safety
    const limit = parseInt((req.query as any).limit) || 30

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ts.*, tp.name as program_name
       FROM training_sessions ts
       LEFT JOIN training_programs tp ON ts.program_id = tp.id
       WHERE ts.user_id = ?
       ORDER BY ts.started_at DESC
       LIMIT ?`,
      [req.userId!, limit]
    )
    res.json({ sessions: rows })
  } catch (err) {
    console.error('Get sessions error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/training/sessions — log a completed workout
export const logSession = async (req: AuthRequest, res: Response) => {
  try {
    const { program_id, duration_minutes, perceived_effort, notes }: CreateSessionBody = req.body

    // If program_id is provided, verify it belongs to user
    if (program_id) {
      const [program] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM training_programs WHERE id = ? AND user_id = ?',
        [program_id, req.userId!]
      )
      if (program.length === 0) {
        res.status(404).json({ error: 'Program not found' })
        return
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO training_sessions (user_id, program_id, duration_minutes, perceived_effort, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [req.userId!, program_id ?? null, duration_minutes ?? null, perceived_effort ?? null, notes ?? null]
    )

    const [created] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM training_sessions WHERE id = ?',
      [result.insertId]
    )
    res.status(201).json({ session: created[0] })
  } catch (err) {
    console.error('Log session error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
