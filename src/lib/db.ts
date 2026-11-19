import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Neon suspends idle compute; waking it can take longer than Prisma's default
 * 5s connect timeout, so the first query after a pause failed with P1001.
 * Neon recommends `connect_timeout=15` for Prisma — add it unless the URL
 * already sets one.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url || !url.startsWith('postgres')) return url
  if (/[?&]connect_timeout=/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}connect_timeout=15`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
