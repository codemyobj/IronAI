import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool, types } = pg

types.setTypeParser(types.builtins.NUMERIC, (val: string) => parseFloat(val))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ironai'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: process.env.NODE_ENV === 'production' ? 1 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err)
})

export default pool
