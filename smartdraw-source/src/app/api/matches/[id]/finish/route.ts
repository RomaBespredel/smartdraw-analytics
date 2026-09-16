import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calcFinalPnl, classifyZone } from '@/lib/math';

/**
 * Close a match with the final score and (optionally) a hedge outcome.
 * Body: { homeScore, awayScore, hedgeId?, hedgeWon? }
 *
 * If hedgeId is provided and hedgeWon is true → the live Correct Score bet won
 * (score did not change after the hedge). If hedgeWon is false → a goal was
 * scored after the hedge and the pre-match Odd shoulder won (hedge lost).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const match = await db.match.findUnique({
    where: { id },
    include: { hedges: { orderBy: { createdAt: 'desc' } } },
  });
  if (!match) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });

  const homeScore = Number(body.homeScore);
  const awayScore = Number(body.awayScore);

  // Pick the hedge to use (latest applied, or the one specified)
  let hedge = body.hedgeId
    ? match.hedges.find((h) => h.id === body.hedgeId)
    : match.hedges.find((h) => h.applied) ?? match.hedges[0];

  const result = calcFinalPnl({
    totalBank: match.totalBank,
    kDraw: match.kDraw,
    kOdd: match.kOdd,
    sDrawRounded: match.sDrawRounded ?? 0,
    sOddRounded: match.sOddRounded ?? 0,
    homeScore,
    awayScore,
    hedge: hedge
      ? {
          sHedgeRounded: hedge.sHedgeRounded,
          kLiveCorrectScore: hedge.kLiveCorrectScore,
          hedgeWon: Boolean(body.hedgeWon ?? false),
        }
      : null,
  });

  const updated = await db.match.update({
    where: { id },
    data: {
      homeScore,
      awayScore,
      status: 'finished',
      zone: classifyZone(homeScore, awayScore).zone,
      resultType: result.resultType,
      finalPnl: result.finalPnl,
      finalRoi: result.finalRoi,
    },
    include: { league: true, hedges: { orderBy: { createdAt: 'desc' } } },
  });

  return NextResponse.json({ match: updated, result });
}
