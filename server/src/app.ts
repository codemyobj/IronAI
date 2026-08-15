// ============================================================
// IronAI Server — Express App (shared between local dev & Vercel)
// This file sets up the Express app WITHOUT starting the server,
// so it can be imported by both index.ts (local) and api/ (Vercel).
// ============================================================

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import trainingRoutes from './routes/training'
import dietRoutes from './routes/diet'
import aiRoutes from './routes/ai'
import dashboardRoutes from './routes/dashboard'

dotenv.config()

const app = express()

// --- CORS ---
// Local dev: allow Vite dev server origins
// Production: API and frontend on same Vercel domain → no CORS needed.
// Add ALLOWED_ORIGINS env var if you need cross-origin access later.
const corsOrigin = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}))

// Parse JSON request bodies
app.use(express.json())

// --- Request timing + logger (dev only) ---
// 帮助用户直观看到"远程数据库 RTT + 查询" vs "Node 本身处理"的耗时。
// 典型结果：health check <10ms, 带 DB 的接口 200-400ms（因走了 us-east-1）。
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const start = Date.now()
    const urlShort = req.originalUrl.split('?')[0]
    console.log(`\n→ ${req.method} ${urlShort}`)
    _res.on('finish', () => {
      const ms = Date.now() - start
      const mark =
        ms > 1000 ? ' 🔴' : ms > 400 ? ' 🟡' : ' 🟢'
      console.log(`← ${req.method} ${urlShort}  ${_res.statusCode}  ${ms}ms${mark}`)
    })
    next()
  })
}

// --- Routes ---
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/training', trainingRoutes)
app.use('/api/diet', dietRoutes)
app.use('/api/ai', aiRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
