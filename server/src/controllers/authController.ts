// ============================================================
// Auth Controller — handles registration & login logic
//
// Security principles demonstrated here:
// - Passwords are HASHED (not encrypted) — one-way, irreversible
// - bcrypt salt = 10 means 2^10 hash iterations (slows brute force)
// - JWT expires in 7 days (always set expiration!)
// - Never return password_hash to the client
// ============================================================

import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db'
import { RegisterBody, LoginBody, SafeUser, UserRow } from '../types'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

// Helper: strip password_hash from user object before sending to client
function toSafeUser(user: UserRow): SafeUser {
  const { password_hash, ...safe } = user
  return safe
}

// Helper: generate a JWT token for a given user ID
function generateToken(userId: number): string {
  return jwt.sign(
    { userId },                             // payload — what goes IN the token
    process.env.JWT_SECRET!,                // secret key — used to sign
    { expiresIn: '7d' }                     // expires in 7 days (always set this!)
  )
}

// ============================================================
// POST /api/auth/register
// ============================================================
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, age, height_cm, weight_kg, fitness_goal }: RegisterBody = req.body

    // --- Validation (never trust client input!) ---
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }
    // Basic email format check
    if (!email.includes('@')) {
      res.status(400).json({ error: 'Invalid email format' })
      return
    }

    // --- Check if email already exists ---
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    )
    if (existing.length > 0) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    // --- Hash the password ---
    // NEVER store plain text passwords. If your DB leaks, attackers
    // can't read the original passwords.
    const password_hash = await bcrypt.hash(password, 10) // salt rounds = 10

    // --- Insert new user ---
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, name, age, height_cm, weight_kg, fitness_goal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, password_hash, name, age ?? null, height_cm ?? null, weight_kg ?? null, fitness_goal ?? 'general']
    )

    // --- Fetch the newly created user (without the hash) ---
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    )
    const user = rows[0] as UserRow

    // --- Generate token & respond ---
    const token = generateToken(user.id)
    res.status(201).json({ token, user: toSafeUser(user) })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// POST /api/auth/login
// ============================================================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginBody = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    // --- Find user by email ---
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    )

    if (rows.length === 0) {
      // Don't reveal whether email exists or password is wrong —
      // this prevents attackers from enumerating registered emails
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const user = rows[0] as UserRow

    // --- Compare password with stored hash ---
    // bcrypt.compare takes the plain-text password, hashes it with the
    // same salt embedded in user.password_hash, and checks if they match
    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    // --- Generate token & respond ---
    const token = generateToken(user.id)
    res.json({ token, user: toSafeUser(user) })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ============================================================
// GET /api/auth/me — get current user from token
// Used by the frontend on page refresh to restore the session
// ============================================================
export const getMe = async (req: Request, res: Response) => {
  try {
    // req.userId is set by authMiddleware
    const authReq = req as any
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?',
      [authReq.userId]
    )

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user: toSafeUser(rows[0] as UserRow) })
  } catch (err) {
    console.error('GetMe error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
