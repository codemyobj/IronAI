// ============================================================
// AI Routes — all protected by authMiddleware
// ============================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { trainingAnalysis, dietRecommendation, getHistory } from '../controllers/aiController'

const router = Router()

router.use(authMiddleware)

router.post('/training-analysis', trainingAnalysis)   // POST /api/ai/training-analysis
router.post('/diet-recommendation', dietRecommendation) // POST /api/ai/diet-recommendation
router.get('/history', getHistory)                     // GET  /api/ai/history?type=training|diet

export default router
