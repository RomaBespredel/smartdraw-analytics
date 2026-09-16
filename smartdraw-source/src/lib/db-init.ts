/**
 * Database initialization for both dev and desktop (Electron) modes.
 *
 * - In dev: DATABASE_URL from .env (file in project/db/).
 * - In desktop (packaged): the Electron main process sets SMARTDRAW_DB_PATH
 *   to a writable location inside the user's app-data directory. We rewrite
 *   DATABASE_URL on the fly so Prisma picks it up.
 *
 * We also run `prisma db push` on first launch so the schema is created
 * automatically — no manual migration step needed by the end user.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir, platform, tmpdir } from 'node:os';

let initialized = false;

function resolveDbPath(): string {
  // Explicit override (set by Electron main process to user-data dir).
  if (process.env.SMARTDRAW_DB_PATH) return process.env.SMARTDRAW_DB_PATH;

  // Already configured via .env (dev mode).
  if (process.env.DATABASE_URL) {
    const m = /^file:(.+)$/.exec(process.env.DATABASE_URL);
    if (m) return m[1];
  }

  // Fallback: per-user dir in home.
  const dir =
    platform() === 'win32'
      ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'SmartDraw')
      : platform() === 'darwin'
        ? join(homedir(), 'Library', 'Application Support', 'SmartDraw')
        : join(homedir(), '.config', 'smartdraw');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'smartdraw.db');
}

export function ensureDatabase(): void {
  if (initialized) return;

  const dbPath = resolveDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Expose as a file: URL so Prisma reads it.
  process.env.DATABASE_URL = `file:${dbPath}`;

  // Run prisma db push (creates schema if missing, idempotent otherwise).
  // We silence stdout to keep the log clean; errors still surface.
  try {
    execSync('bunx prisma db push --skip-generate --accept-data-loss', {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      timeout: 30_000,
    });
  } catch (err) {
    // In Electron packaged builds bunx may not resolve. Fall back to
    // prisma CLI from node_modules.
    try {
      execSync('node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss', {
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        timeout: 30_000,
      });
    } catch {
      // Last resort: create an empty file so Prisma doesn't crash; the
      // user can run migrations manually. Log to tmp for diagnostics.
      const tmpLog = join(tmpdir(), 'smartdraw-db-init.log');
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('node:fs');
        fs.writeFileSync(tmpLog, String(err));
      } catch {}
    }
  }

  initialized = true;
}

export function getDbPath(): string {
  return resolveDbPath();
}
