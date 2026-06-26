// Single PrismaClient for the whole server process.
//
// Why a module of its own:
//   - Prisma documentation: instantiate exactly one client per process. The
//     adapter holds a Postgres connection pool — duplicating it leaks
//     connections.
//   - Decouples data access from any specific repository. Anything in
//     `server/` that needs raw Prisma access does `import { prisma }` here,
//     never `import { bdManager }` (which used to be the only path).
//
// Re-export the type so consumers can hint return types without depending
// on the @prisma/client path directly.

import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL as string,
})

const adapter = new PrismaPg(pool)

export const prisma = new PrismaClient({ adapter })

export type { PrismaClient }
