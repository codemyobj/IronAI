import { Response } from 'express'
import prisma from '../config/prisma'
import { AuthRequest } from '../middleware/auth'
import { CreateProgramBody, CreateSessionBody } from '../types'
import { invalidateDashboardCache } from './dashboardController'

export const getPrograms = async (req: AuthRequest, res: Response) => {
  try {
    const programs = await prisma.trainingProgram.findMany({
      where: { user_id: req.userId!, is_active: true },
      orderBy: { created_at: 'desc' },
    })
    res.json({ programs })
  } catch (err) {
    console.error('Get programs error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const program = await prisma.trainingProgram.findFirst({
      where: { id: Number(id), user_id: req.userId! },
      include: {
        exercises: { orderBy: { sort_order: 'asc' } },
      },
    })

    if (!program) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    res.json({ program })
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

    const program = await prisma.trainingProgram.create({
      data: {
        user_id: req.userId!,
        name,
        description: description ?? null,
        difficulty: difficulty ?? 'beginner',
        target_muscle_group: target_muscle_group ?? null,
        exercises: exercises.length > 0
          ? {
              create: exercises.map(ex => ({
                name: ex.name,
                sets: ex.sets ?? 3,
                reps: ex.reps ?? 10,
                weight_kg: ex.weight_kg ?? null,
                rest_seconds: ex.rest_seconds ?? 60,
                notes: ex.notes ?? null,
              })),
            }
          : undefined,
      },
      include: {
        exercises: { orderBy: { sort_order: 'asc' } },
      },
    })

    invalidateDashboardCache(req.userId!)
    res.status(201).json({ program })
  } catch (err) {
    console.error('Create program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, difficulty, target_muscle_group }: CreateProgramBody = req.body

    const existing = await prisma.trainingProgram.findFirst({
      where: { id: Number(id), user_id: req.userId! },
      select: { id: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    const updated = await prisma.trainingProgram.update({
      where: { id: existing.id },
      data: {
        name,
        description: description ?? null,
        difficulty: difficulty ?? 'beginner',
        target_muscle_group: target_muscle_group ?? null,
      },
    })
    invalidateDashboardCache(req.userId!)
    res.json({ program: updated })
  } catch (err) {
    console.error('Update program error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const existing = await prisma.trainingProgram.findFirst({
      where: { id: Number(id), user_id: req.userId! },
      select: { id: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    // 软删除：设置 is_active = false
    await prisma.trainingProgram.update({
      where: { id: existing.id },
      data: { is_active: false },
    })

    invalidateDashboardCache(req.userId!)
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

    const program = await prisma.trainingProgram.findFirst({
      where: { id: Number(programId), user_id: req.userId! },
      select: { id: true },
    })
    if (!program) {
      res.status(404).json({ error: 'Program not found' })
      return
    }

    const maxAgg = await prisma.exercise.aggregate({
      where: { program_id: program.id },
      _max: { sort_order: true },
    })
    const sortOrder = (maxAgg._max.sort_order ?? -1) + 1

    const exercise = await prisma.exercise.create({
      data: {
        program_id: program.id,
        name,
        sets: sets ?? 3,
        reps: reps ?? 10,
        weight_kg: weight_kg ?? null,
        rest_seconds: rest_seconds ?? 60,
        notes: notes ?? null,
        sort_order: sortOrder,
      },
    })

    res.status(201).json({ exercise })
  } catch (err) {
    console.error('Add exercise error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteExercise = async (req: AuthRequest, res: Response) => {
  try {
    const { exerciseId } = req.params

    // 通过关系过滤校验归属（等价原 JOIN 查询）
    const owned = await prisma.exercise.findFirst({
      where: {
        id: Number(exerciseId),
        program: { user_id: req.userId! },
      },
      select: { id: true },
    })
    if (!owned) {
      res.status(404).json({ error: 'Exercise not found' })
      return
    }

    await prisma.exercise.delete({ where: { id: owned.id } })
    res.json({ message: 'Exercise deleted' })
  } catch (err) {
    console.error('Delete exercise error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt((req.query as any).limit) || 30

    const sessions = await prisma.trainingSession.findMany({
      where: { user_id: req.userId! },
      include: {
        program: { select: { name: true } },
      },
      orderBy: { started_at: 'desc' },
      take: limit,
    })

    // flatten：program.name → program_name（保持前端契约）
    const mapped = sessions.map(s => {
      const { program, ...rest } = s
      return { ...rest, program_name: program?.name ?? null }
    })

    res.json({ sessions: mapped })
  } catch (err) {
    console.error('Get sessions error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const logSession = async (req: AuthRequest, res: Response) => {
  try {
    const { program_id, duration_minutes, perceived_effort, notes }: CreateSessionBody = req.body

    if (program_id) {
      const program = await prisma.trainingProgram.findFirst({
        where: { id: program_id, user_id: req.userId! },
        select: { id: true },
      })
      if (!program) {
        res.status(404).json({ error: 'Program not found' })
        return
      }
    }

    const session = await prisma.trainingSession.create({
      data: {
        user_id: req.userId!,
        program_id: program_id ?? null,
        duration_minutes: duration_minutes ?? null,
        perceived_effort: perceived_effort ?? null,
        notes: notes ?? null,
      },
    })

    invalidateDashboardCache(req.userId!)
    res.status(201).json({ session })
  } catch (err) {
    console.error('Log session error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
