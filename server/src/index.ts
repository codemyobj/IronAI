// ============================================================
// IronAI Server — Entry Point
//
// This is where everything comes together:
// 1. Load environment variables
// 2. Configure Express (CORS, JSON parsing)
// 3. Mount all route groups under /api
// 4. Start listening for requests
// ============================================================

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import trainingRoutes from './routes/training'
import dietRoutes from './routes/diet'
import aiRoutes from './routes/ai'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// --- Middleware ---

// CORS: allow your React dev server to call the API
// In production, replace with your actual frontend domain
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}))

// Parse JSON request bodies — this is how req.body works
app.use(express.json())

// --- Routes ---

// Each route file handles one resource group
app.use('/api/auth', authRoutes)           // Register, login, me
app.use('/api/training', trainingRoutes)   // Programs, exercises, sessions
app.use('/api/diet', dietRoutes)           // Diet records, summaries
app.use('/api/ai', aiRoutes)               // AI analysis, recommendations

// --- Health check (public, no auth needed) ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 IronAI server running on http://localhost:${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
})
