// ============================================================
// MySQL database connection
//
// Local dev: uses individual DB_HOST, DB_USER, etc. from .env
// Production (Vercel): uses DATABASE_URL (PlanetScale / Aiven format)
//
// In serverless, connection pooling is less effective (each
// invocation may be a cold start). We keep a small pool (max 5)
// to handle concurrent requests within the same warm instance.
// ============================================================

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config()

// Parse connection from DATABASE_URL (standard for cloud DBs like PlanetScale)
// Format: mysql://user:password@host:port/database
function parseDatabaseUrl(url: string): mysql.PoolOptions {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 3306,
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.replace('/', ''),
    ssl: {
      // Free cloud DBs (PolarDB-X, etc.) often use self-signed certs.
      // Default to false for DATABASE_URL; set to 'true' if your provider uses valid CA certs.
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    },
  }
}

const baseConfig: mysql.PoolOptions = process.env.DATABASE_URL
  ? parseDatabaseUrl(process.env.DATABASE_URL)
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'ironai_user',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ironai',
    }

const pool = mysql.createPool({
  ...baseConfig,
  waitForConnections: true,
  connectionLimit: process.env.DATABASE_URL ? 5 : 10, // Smaller pool for serverless
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
})

export default pool
