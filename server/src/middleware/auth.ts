// ============================================================
// JWT Authentication Middleware
//
// How it works:
// 1. Extract "Bearer <token>" from the Authorization header
// 2. Verify the token using JWT_SECRET
// 3. If valid → attach userId to the request object → call next()
// 4. If invalid → return 401 Unauthorized
//
// This is the GATEKEEPER for all protected routes.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Extend Express Request type to include the authenticated user's ID
// This lets downstream handlers read req.userId without type errors
export interface AuthRequest extends Request {
  userId?: number
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Step 1: Check if Authorization header exists and is formatted correctly
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  // Step 2: Extract the token (the part after "Bearer ")
  const token = header.split(' ')[1]

  try {
    // Step 3: Verify the token signature and decode the payload
    // If the token is expired, tampered with, or signed with a different
    // secret — this throws an error and we go to the catch block
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number
    }

    // Step 4: Attach userId so downstream handlers know WHO is making the request
    req.userId = decoded.userId
    next() // Pass control to the route handler
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }
}
