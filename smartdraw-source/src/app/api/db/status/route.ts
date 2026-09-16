import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDbPath } from '@/lib/db-init';
import { statSync } from 'node:fs';
import { basename } from 'node:path';

export async function GET() {
  const [leagues, matches, hedges, settings] = await Promise.all([
    db.league.count(),
    db.match.count(),
    db.hedge.count(),
    db.settings.count(),
  ]);

  let dbSize = 0;
  let dbFile = '';
  try {
    const p = getDbPath();
    dbFile = basename(p);
    dbSize = statSync(p).size;
  } catch {
    // ignore
  }

  return NextResponse.json({
    dbPath: dbFile,
    dbSizeBytes: dbSize,
    dbSizeHuman: formatBytes(dbSize),
    counts: { leagues, matches, hedges, settings },
    platform: process.platform,
    isPackaged: Boolean(process.env.IS_ELECTRON),
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
