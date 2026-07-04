// ============================================================
// Auth Routes
//
// Public routes — no authMiddleware needed (except /me)
// ============================================================

import { Router } from 'express'
import { register, login, getMe } from '../controllers/authController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// POST /api/auth/register — create a new account
router.post('/register', register)

// POST /api/auth/login — sign in
router.post('/login', login)

// GET /api/auth/me — get currently logged-in user (protected)
router.get('/me', authMiddleware, getMe)

export default router
