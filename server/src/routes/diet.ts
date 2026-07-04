// ============================================================
// Diet Routes — all protected by authMiddleware
// ============================================================

import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getRecords, addRecord, deleteRecord, getSummary } from '../controllers/dietController'

const router = Router()

router.use(authMiddleware)

// NOTE: /summary must be defined BEFORE /:id,
// otherwise Express will match "summary" as an :id
router.get('/summary', getSummary)          // GET  /api/diet/summary?start=&end=
router.get('/records', getRecords)          // GET  /api/diet/records?date=
router.post('/records', addRecord)          // POST /api/diet/records
router.delete('/records/:id', deleteRecord) // DELETE /api/diet/records/:id

export default router
