// ============================================================
// Vercel Serverless Function — wraps the Express API
//
// Vercel's @vercel/node runtime calls the default export as
// (req, res) on each request. Express apps match this signature
// exactly, so we can just export the app directly.
//
// All /api/* requests are routed here by vercel.json rewrites.
// ============================================================

import app from '../server/src/app'

export default app
