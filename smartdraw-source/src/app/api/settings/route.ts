import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const s = await db.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });
  return NextResponse.json({ settings: s });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of [
    'roundingStep', 'minRoi', 'minFavoriteK', 'defaultBank',
    'liveStartMin', 'liveEndMin', 'hedgeTargetLoss',
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  const s = await db.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...(data as any) },
    update: data,
  });
  return NextResponse.json({ settings: s });
}
