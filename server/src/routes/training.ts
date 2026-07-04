// ============================================================
// Training Routes — all protected by authMiddleware
// ============================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  getPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,
  addExercise,
  deleteExercise,
  getSessions,
  logSession,
} from '../controllers/trainingController'

const router = Router()

// All training routes require authentication
router.use(authMiddleware)

// --- Programs ---
router.get('/programs', getPrograms)                       // GET  /api/training/programs
router.post('/programs', createProgram)                    // POST /api/training/programs
router.get('/programs/:id', getProgram)                    // GET  /api/training/programs/:id
router.put('/programs/:id', updateProgram)                 // PUT  /api/training/programs/:id
router.delete('/programs/:id', deleteProgram)              // DELETE /api/training/programs/:id

// --- Exercises (nested under programs) ---
router.post('/programs/:programId/exercises', addExercise) // POST /api/training/programs/:programId/exercises
router.delete('/exercises/:exerciseId', deleteExercise)    // DELETE /api/training/exercises/:exerciseId

// --- Sessions ---
router.get('/sessions', getSessions)                       // GET  /api/training/sessions
router.post('/sessions', logSession)                       // POST /api/training/sessions

export default router
