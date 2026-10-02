const { PrismaClient } = require('@prisma/client');

/**
 * Shared PrismaClient singleton.
 *
 * Every `new PrismaClient()` opens its own connection pool. Under Vercel's
 * serverless runtime a module can be instantiated once per lambda invocation,
 * so per-module clients multiply the number of live pools until the Neon
 * pooler (or the per-database connection limit) is exhausted — which surfaces
 * as intermittent "Too many connections" errors rather than anything that
 * points at the real cause. One client per process is the fix.
 *
 * The `globalThis` cache additionally survives `nodemon` reloads in
 * development, so editing a file does not leak a pool on every save.
 */
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__pharmazenPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__pharmazenPrisma = prisma;
}

module.exports = prisma;