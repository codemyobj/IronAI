// ============================================================
// IronAI Server — Local Dev Entry Point
// Starts the Express server on the configured port.
// NOT used in Vercel production (see /api/index.ts instead).
// ============================================================

import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🚀 IronAI server running on http://localhost:${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
})
