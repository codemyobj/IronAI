import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma'
import { RegisterBody, LoginBody, SafeUser } from '../types'
import { invalidateDashboardCache } from './dashboardController'

function toSafeUser(user: any): SafeUser {
  const { password_hash, ...safe } = user
  return safe
}

function generateToken(userId: number): string {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )
}

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, age, height_cm, weight_kg, fitness_goal }: RegisterBody = req.body

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }
    if (!email.includes('@')) {
      res.status(400).json({ error: 'Invalid email format' })
      return
    }

    const existing = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const password_hash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        name,
        age: age ?? null,
        height_cm: height_cm ?? null,
        weight_kg: weight_kg ?? null,
        fitness_goal: fitness_goal ?? 'general',
      },
    })

    const token = generateToken(user.id)
    res.status(201).json({ token, user: toSafeUser(user) })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginBody = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const user = await prisma.user.findFirst({
      where: { email },
    })

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = generateToken(user.id)
    res.json({ token, user: toSafeUser(user) })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getMe = async (req: Request, res: Response) => {
  try {
    const authReq = req as any
    const user = await prisma.user.findFirst({
      where: { id: authReq.userId },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user: toSafeUser(user) })
  } catch (err) {
    console.error('GetMe error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

const VALID_GOALS = ['general', 'weight_loss', 'muscle_gain', 'endurance']

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const authReq = req as any
    const userId = authReq.userId
    const body = req.body as any

    // Whitelist of allowed fields (prevent email/password changing here)
    const allowedFields = [
      'name', 'age', 'height_cm', 'weight_kg', 'fitness_goal',
    ]

    const data: Record<string, any> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        data[key] = body[key] === '' ? null : body[key]
      }
    }

    // Validate fitness_goal if provided
    if (data.fitness_goal && !VALID_GOALS.includes(data.fitness_goal)) {
      res.status(400).json({ error: `Invalid fitness_goal. Must be one of: ${VALID_GOALS.join(', ')}` })
      return
    }

    // Validate age/height/weight are positive numbers if provided
    for (const numericKey of ['age', 'height_cm', 'weight_kg']) {
      if (data[numericKey] !== null && data[numericKey] !== undefined) {
        const v = Number(data[numericKey])
        if (isNaN(v) || v <= 0) {
          res.status(400).json({ error: `${numericKey} must be a positive number` })
          return
        }
        data[numericKey] = v
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' })
      return
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    })

    invalidateDashboardCache(userId)
    res.json({ user: toSafeUser(updated) })
  } catch (err: any) {
    console.error('updateProfile error:', err)
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getProfileStats = async (req: Request, res: Response) => {
  try {
    const authReq = req as any
    const userId = authReq.userId

    const [sessionCount, dietRecordCount] = await Promise.all([
      prisma.trainingSession.count({ where: { user_id: userId } }),
      prisma.dietRecord.count({ where: { user_id: userId } }),
    ])

    res.json({
      totalTrainingSessions: sessionCount,
      totalDietRecords: dietRecordCount,
    })
  } catch (err) {
    console.error('getProfileStats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
