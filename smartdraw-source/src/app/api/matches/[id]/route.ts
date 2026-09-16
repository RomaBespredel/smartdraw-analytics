import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classifyZone } from '@/lib/math';

// Update match (status, live score/minute)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.homeScore !== undefined) data.homeScore = Number(body.homeScore);
  if (body.awayScore !== undefined) data.awayScore = Number(body.awayScore);
  if (body.minute !== undefined) data.minute = Number(body.minute);
  if (body.notes !== undefined) data.notes = body.notes;

  // Recompute live zone classification if score changed
  if (body.homeScore !== undefined || body.awayScore !== undefined) {
    const current = await db.match.findUnique({ where: { id } });
    if (current) {
      const home = data.homeScore ?? current.homeScore;
      const away = data.awayScore ?? current.awayScore;
      data.zone = classifyZone(home, away).zone;
    }
  }

  const match = await db.match.update({
    where: { id },
    data,
    include: { league: true, hedges: { orderBy: { createdAt: 'desc' } } },
  });

  return NextResponse.json({ match });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.match.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
