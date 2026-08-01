// 把 Prisma 返回的 Date（@db.Date）格式化为 'YYYY-MM-DD'，匹配原 pg DATE 行为
export function formatDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
