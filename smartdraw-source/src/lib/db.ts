import { PrismaClient } from '@prisma/client';
import { ensureDatabase } from './db-init';

// Ensure the database file exists and is migrated before instantiating Prisma.
// In the desktop build, DATABASE_URL points to a file in the user data dir.
ensureDatabase();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
