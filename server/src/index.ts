// ============================================================
// IronAI Server — Local Dev Entry Point
// Starts the Express server on the configured port.
// NOT used in Vercel production (see /api/index.ts instead).
// ============================================================

import app from './app'

const PORT = process.env.PORT || 3000

console.log('Starting IronAI server...')
console.log('PORT:', PORT)

const server = app.listen(PORT, () => {
  console.log(`🚀 IronAI server running on http://localhost:${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason)
})
