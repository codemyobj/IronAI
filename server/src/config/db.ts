// ============================================================
// MySQL connection pool — manages database connections efficiently
//
// A POOL is better than a single connection because:
// 1. Multiple queries can run in parallel (up to connectionLimit)
// 2. Connections are reused (no overhead of creating/destroying)
// 3. Connections are automatically released back to the pool
// ============================================================

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'ironai_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ironai',
  waitForConnections: true,
  connectionLimit: 10,    // Max simultaneous connections
  queueLimit: 0,          // Unlimited queue — requests wait instead of failing
})

export default pool
