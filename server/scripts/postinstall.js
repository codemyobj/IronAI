// postinstall: 生成 Prisma Client
// 在 Vercel 构建环境中，DATABASE_URL 可能未设置（仅在 runtime 配置），
// 此脚本提供占位值确保 prisma generate 不会因缺少 env 而失败。
// prisma generate 不连接数据库，只需 schema.prisma 即可生成 client 代码。
const { execSync } = require('child_process')
const path = require('path')

const env = { ...process.env }
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder'
  console.log('[postinstall] DATABASE_URL not set, using placeholder for prisma generate')
}

try {
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env,
    cwd: path.resolve(__dirname, '..'),
  })
  console.log('[postinstall] Prisma Client generated successfully')
} catch (err) {
  console.error('[postinstall] prisma generate failed:', err.message)
  // 不退出进程，允许构建继续（client 构建不依赖 Prisma）
  if (process.env.VERCEL) {
    console.log('[postinstall] Running on Vercel, continuing build...')
  } else {
    process.exit(1)
  }
}
