import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDbPath } from '@/lib/db-init';
import { basename } from 'node:path';

/**
 * GET /api/db/backup
 * Exports the entire database (leagues, matches, hedges, settings) as JSON.
 * The user can save this file and restore on another PC.
 */
export async function GET() {
  const [leagues, matches, hedges, settings] = await Promise.all([
    db.league.findMany(),
    db.match.findMany({ include: { hedges: true } }),
    db.hedge.findMany(),
    db.settings.findMany(),
  ]);

  const payload = {
    $schema: 'smartdraw-backup/v1',
    exportedAt: new Date().toISOString(),
    dbPath: basename(getDbPath()),
    counts: {
      leagues: leagues.length,
      matches: matches.length,
      hedges: hedges.length,
      settings: settings.length,
    },
    data: { leagues, matches, hedges, settings },
  };

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': `attachment; filename="smartdraw-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}

/**
 * POST /api/db/backup
 * Restores the database from a JSON backup uploaded in the request body.
 * Existing rows with the same id are overwritten; new rows are inserted.
 * Matches and hedges for the same ids are replaced.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = body?.data;
  if (!data || !Array.isArray(data.leagues)) {
    return NextResponse.json(
      { error: 'Некорректный формат бэкапа' },
      { status: 400 },
    );
  }

  let counts = { leagues: 0, matches: 0, hedges: 0, settings: 0 };

  await db.$transaction([
    // Settings
    ...(data.settings ?? []).map((s: Record<string, unknown>) =>
      db.settings.upsert({
        where: { id: String(s.id) },
        create: s as never,
        update: s as never,
      }),
    ),
    // Leagues
    ...(data.leagues ?? []).map((l: Record<string, unknown>) =>
      db.league.upsert({
        where: { code: String(l.code) },
        create: l as never,
        update: l as never,
      }),
    ),
    // Matches
    ...(data.matches ?? []).map((m: Record<string, unknown>) => {
      const { hedges: _h, ...rest } = m;
      return db.match.upsert({
        where: { id: String(m.id) },
        create: rest as never,
        update: rest as never,
      });
    }),
    // Hedges
    ...(data.hedges ?? []).map((h: Record<string, unknown>) =>
      db.hedge.upsert({
        where: { id: String(h.id) },
        create: h as never,
        update: h as never,
      }),
    ),
  ]);

  counts = {
    leagues: data.leagues.length,
    matches: data.matches?.length ?? 0,
    hedges: data.hedges?.length ?? 0,
    settings: data.settings?.length ?? 0,
  };

  return NextResponse.json({ ok: true, imported: counts });
}
