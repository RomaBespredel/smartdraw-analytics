/**
 * Auto-seed: if the leagues table is empty on first launch, populate it
 * with the bundled TZ catalogue. This makes the app fully self-contained —
 * the user gets a working reference of 46 leagues right after install.
 *
 * Called from the leagues API on every GET (cheap idempotent check) and
 * explicitly from the Electron main process on startup.
 */

import { db } from './db';
import { LEAGUES_SEED } from './leagues-data';

let seeded = false;

export async function ensureSeeded(): Promise<boolean> {
  if (seeded) return false;
  try {
    const count = await db.league.count();
    if (count === 0) {
      await seedLeagues();
      seeded = true;
      return true; // did seed
    }
    seeded = true;
  } catch {
    // Database not ready yet — will retry on next call.
  }
  return false;
}

export async function seedLeagues(): Promise<number> {
  let n = 0;
  for (const seed of LEAGUES_SEED) {
    await db.league.upsert({
      where: { code: seed.code },
      create: {
        country: seed.country,
        name: seed.name,
        code: seed.code,
        tier: seed.tier,
        zone: seed.zone ?? null,
        avgDrawPct: seed.avgDrawPct ?? null,
        avgUnder25Pct: seed.avgUnder25Pct ?? null,
        notes: seed.notes ?? null,
      },
      update: {},
    });
    n++;
  }
  // Ensure settings singleton exists.
  await db.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });
  return n;
}
