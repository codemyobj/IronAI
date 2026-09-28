// ============================================================
// Body Routes — all protected by authMiddleware
// ============================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getRecords, addRecord } from '../controllers/bodyController'

const router = Router()

router.use(authMiddleware)

// GET  /api/body/records?days=30
router.get('/records', getRecords)

// POST /api/body/records
router.post('/records', addRecord)

export default router
