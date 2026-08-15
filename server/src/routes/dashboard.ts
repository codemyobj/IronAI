// ============================================================
// Dashboard Routes
//
// Protected — all routes need authMiddleware.
// ============================================================

import { Router } from 'express'
import { getDashboard } from '../controllers/dashboardController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// GET /api/dashboard — 聚合接口，一次请求返回首页全部所需数据
router.get('/', authMiddleware, getDashboard)

export default router
