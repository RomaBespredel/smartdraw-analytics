import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSeeded } from '@/lib/seed';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tier = searchParams.get('tier');
  const zone = searchParams.get('zone');
  const q = searchParams.get('q');

  // Auto-seed on first call if the table is empty (covers desktop first launch).
  await ensureSeeded();

  const where: Record<string, unknown> = {};
  if (tier) where.tier = tier;
  if (zone) where.zone = zone;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { country: { contains: q } },
    ];
  }

  const leagues = await db.league.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { zone: 'asc' }, { country: 'asc' }],
  });
  return NextResponse.json({ leagues });
}

// Manual re-seed from the bundled TZ catalogue (offline).
export async function POST() {
  const { seedLeagues } = await import('@/lib/seed');
  const n = await seedLeagues();
  return NextResponse.json({ ok: true, upserted: n, source: 'bundled' });
}
