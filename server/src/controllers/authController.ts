import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db'
import { RegisterBody, LoginBody, SafeUser, UserRow } from '../types'

function toSafeUser(user: UserRow): SafeUser {
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

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const password_hash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, age, height_cm, weight_kg, fitness_goal)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [email, password_hash, name, age ?? null, height_cm ?? null, weight_kg ?? null, fitness_goal ?? 'general']
    )

    const userId = result.rows[0].id

    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    )
    const user = userResult.rows[0] as UserRow

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

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const user = result.rows[0] as UserRow

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
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [authReq.userId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user: toSafeUser(result.rows[0] as UserRow) })
  } catch (err) {
    console.error('GetMe error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
