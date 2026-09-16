import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const matches = await db.match.findMany({
    where: { status: 'finished' },
    include: { league: true, hedges: true },
  });

  const total = matches.length;
  const wins = matches.filter((m) => (m.finalPnl ?? 0) > 0).length;
  const losses = matches.filter((m) => (m.finalPnl ?? 0) < 0).length;
  const breakeven = total - wins - losses;

  const totalBankStaked = matches.reduce((sum, m) => sum + m.totalBank, 0);
  const totalPnl = matches.reduce((sum, m) => sum + (m.finalPnl ?? 0), 0);
  const totalRoi = totalBankStaked > 0 ? (totalPnl / totalBankStaked) * 100 : 0;

  const hedgeCount = await db.hedge.count({ where: { applied: true } });
  const matchesWithHedge = matches.filter((m) =>
    m.hedges.some((h) => h.applied),
  ).length;

  // Result-type breakdown
  const byResult = {
    draw: matches.filter((m) => m.resultType === 'draw').length,
    odd: matches.filter((m) => m.resultType === 'odd').length,
    hedged: matches.filter((m) => m.resultType === 'hedged').length,
    blind: matches.filter((m) => m.resultType === 'blind').length,
  };

  // By league
  const byLeagueMap = new Map<string, { league: string; count: number; pnl: number; bank: number }>();
  for (const m of matches) {
    const key = m.league?.name ?? 'Без лиги';
    const cur = byLeagueMap.get(key) ?? { league: key, count: 0, pnl: 0, bank: 0 };
    cur.count += 1;
    cur.pnl += m.finalPnl ?? 0;
    cur.bank += m.totalBank;
    byLeagueMap.set(key, cur);
  }
  const byLeague = Array.from(byLeagueMap.values())
    .map((x) => ({ ...x, roi: x.bank > 0 ? (x.pnl / x.bank) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);

  // Recent P&L series (for a single sparkline — kept minimal per UI rules)
  const series = [...matches]
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())
    .map((m) => ({
      id: m.id,
      label: `${m.homeTeam} — ${m.awayTeam}`,
      pnl: m.finalPnl ?? 0,
      roi: m.finalRoi ?? 0,
      date: m.kickoff.toISOString(),
    }));

  // Active live + prematch counts
  const activeLive = await db.match.count({ where: { status: 'live' } });
  const activePrematch = await db.match.count({ where: { status: 'prematch' } });

  return NextResponse.json({
    overview: {
      total,
      wins,
      losses,
      breakeven,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      totalBankStaked,
      totalPnl,
      totalRoi,
      hedgeCount,
      matchesWithHedge,
      activeLive,
      activePrematch,
    },
    byResult,
    byLeague,
    series,
  });
}
