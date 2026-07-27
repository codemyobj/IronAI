// ============================================================
// MySQL database connection
//
// Local dev: uses individual DB_HOST, DB_USER, etc. from .env
// Production (Vercel): uses DATABASE_URL (PolarDB-X format)
//
// PolarDB-X notes:
// - Mandatory SSL for public connections
// - Serverless needs minimal pool (cold starts)
// - Use connection timezone to avoid date mismatches
// ============================================================

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config()

// Parse connection from DATABASE_URL
// Format: mysql://user:password@host:port/database
function parseDatabaseUrl(url: string): mysql.PoolOptions {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace('/', ''),
    ssl: {
      // PolarDB-X uses self-signed certs by default
      // Set DB_SSL_REJECT_UNAUTHORIZED=true if using valid CA certs
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    },
    timezone: '+08:00',
    connectTimeout: 10000,
  }
}

const isProd = !!process.env.DATABASE_URL

const baseConfig: mysql.PoolOptions = isProd
  ? parseDatabaseUrl(process.env.DATABASE_URL!)
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'ironai_user',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ironai',
    }

const pool = mysql.createPool({
  ...baseConfig,
  waitForConnections: true,
  connectionLimit: isProd ? 1 : 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: isProd ? 30000 : 10000,
  charset: 'utf8mb4',
})

export default pool
