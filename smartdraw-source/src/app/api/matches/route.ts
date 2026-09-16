import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calcPrematch } from '@/lib/math';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const leagueId = searchParams.get('leagueId');
  const limit = Number(searchParams.get('limit') ?? 100);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (leagueId) where.leagueId = leagueId;

  const matches = await db.match.findMany({
    where,
    include: { league: true, hedges: { orderBy: { createdAt: 'desc' } } },
    orderBy: { kickoff: 'desc' },
    take: limit,
  });
  return NextResponse.json({ matches });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const settings = await db.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });

  const totalBank = Number(body.totalBank ?? settings.defaultBank);
  const kDraw = Number(body.kDraw);
  const kOdd = Number(body.kOdd);
  const kFavorite = body.kFavorite ? Number(body.kFavorite) : null;

  if (!kDraw || !kOdd || kDraw <= 1 || kOdd <= 1) {
    return NextResponse.json(
      { error: 'Кэфы должны быть > 1' },
      { status: 400 },
    );
  }

  const calc = calcPrematch({
    totalBank,
    kDraw,
    kOdd,
    kFavorite,
    roundingStep: settings.roundingStep,
    minRoi: settings.minRoi,
    minFavoriteK: settings.minFavoriteK,
  });

  const match = await db.match.create({
    data: {
      leagueId: body.leagueId || null,
      homeTeam: body.homeTeam,
      awayTeam: body.awayTeam,
      kickoff: new Date(body.kickoff),
      totalBank,
      kDraw,
      kOdd,
      kFavorite,
      favoriteSide: body.favoriteSide ?? null,
      bkDraw: body.bkDraw ?? null,
      bkOdd: body.bkOdd ?? null,
      sDraw: calc.sDraw,
      sOdd: calc.sOdd,
      sDrawRounded: calc.sDrawRounded,
      sOddRounded: calc.sOddRounded,
      roiPrematch: calc.roi,
      rPrematch: calc.rPrematch,
      passedFilter: calc.passed,
      status: 'prematch',
      notes: body.notes ?? null,
    },
    include: { league: true, hedges: true },
  });

  return NextResponse.json({ match, calc });
}
