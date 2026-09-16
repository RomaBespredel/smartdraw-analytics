import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calcHedge, classifyZone, type Zone } from '@/lib/math';

/**
 * Calculate and persist a live hedge for a match.
 * Body: { minute, kLiveCorrectScore, applied? }
 * Reads current live score from the match record.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const match = await db.match.findUnique({ where: { id } });
  if (!match) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });

  const kLiveCorrectScore = Number(body.kLiveCorrectScore);
  if (!kLiveCorrectScore || kLiveCorrectScore <= 1) {
    return NextResponse.json({ error: 'Лайв-кэф должен быть > 1' }, { status: 400 });
  }

  const zone = classifyZone(match.homeScore, match.awayScore);
  if (zone.zone !== 'red') {
    return NextResponse.json(
      {
        error: `Страховка считается только в Опасной зоне (2:0, 0:2, 3:1, 1:3). Текущая зона: ${zone.label}.`,
        zone: zone.zone as Zone,
      },
      { status: 400 },
    );
  }

  const calc = calcHedge({
    totalBank: match.totalBank,
    kDraw: match.kDraw,
    kOdd: match.kOdd,
    kLiveCorrectScore,
  });

  const hedge = await db.hedge.create({
    data: {
      matchId: match.id,
      minute: Number(body.minute ?? match.minute ?? 65),
      currentHome: match.homeScore,
      currentAway: match.awayScore,
      scoreLabel: `${match.homeScore}:${match.awayScore}`,
      kLiveCorrectScore,
      rawSHedge: calc.rawSHedge,
      sHedgeRounded: calc.sHedgeRounded,
      netIfScoreHolds: calc.netIfScoreHolds,
      netIfGoalScored: calc.netIfGoalScored,
      netIfScoreHoldsPct: calc.netIfScoreHoldsPct,
      netIfGoalScoredPct: calc.netIfGoalScoredPct,
      applied: Boolean(body.applied),
    },
  });

  return NextResponse.json({ hedge, calc, match });
}

/** List all hedges for a match */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hedges = await db.hedge.findMany({
    where: { matchId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ hedges });
}
