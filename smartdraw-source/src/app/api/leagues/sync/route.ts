import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { seedLeagues } from '@/lib/seed';

interface CatalogLeague {
  country: string;
  name: string;
  code: string;
  tier: 'whitelist' | 'blacklist' | 'neutral';
  zone?: string;
  avgDrawPct?: number;
  avgUnder25Pct?: number;
  notes?: string;
}

interface Catalog {
  version?: number;
  updatedAt?: string;
  source?: string;
  leagues: CatalogLeague[];
}

/**
 * Default public catalog URL (open source). Can be overridden via ?url=.
 * Points at the project's own public catalog on GitHub raw — this is an
 * openly accessible JSON file the user (or the maintainer) can update
 * independently of the app binary.
 */
const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/smartdraw-analytics/smartdraw-catalog/main/leagues-catalog.json';

/**
 * POST /api/leagues/sync?url=<optional>
 *
 * Updates the local leagues catalogue from an open-source JSON catalog.
 * Without ?url=, tries the default remote source; on any failure falls back
 * to the bundled catalog at /leagues-catalog.json (served by Next.js).
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  let catalog: Catalog | null = null;
  let source: 'remote' | 'bundled' = 'bundled';
  let sourceUrl = '';

  // 1) Try remote (explicit URL or default).
  const tryUrls = url ? [url] : [DEFAULT_CATALOG_URL];
  for (const u of tryUrls) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('json') && !u.endsWith('.json')) continue;
      const data = (await res.json()) as Catalog;
      if (data && Array.isArray(data.leagues) && data.leagues.length > 0) {
        catalog = data;
        source = 'remote';
        sourceUrl = u;
        break;
      }
    } catch {
      // network error / timeout — try next
    }
  }

  // 2) Fallback: bundled catalog (always available offline).
  if (!catalog) {
    try {
      const res = await fetch(new URL('/leagues-catalog.json', req.nextUrl.origin));
      if (res.ok) {
        catalog = (await res.json()) as Catalog;
      }
    } catch {
      // ignore
    }
  }

  // 3) Last resort: re-seed from the hardcoded TS catalogue.
  if (!catalog || !catalog.leagues?.length) {
    const n = await seedLeagues();
    return NextResponse.json({
      ok: true,
      upserted: n,
      source: 'bundled-ts',
      message: 'Удалённый источник недоступен — использован встроенный справочник.',
    });
  }

  let upserted = 0;
  for (const l of catalog.leagues) {
    if (!l.code || !l.name) continue;
    await db.league.upsert({
      where: { code: l.code },
      create: {
        country: l.country ?? '—',
        name: l.name,
        code: l.code,
        tier: l.tier ?? 'neutral',
        zone: l.zone ?? null,
        avgDrawPct: l.avgDrawPct ?? null,
        avgUnder25Pct: l.avgUnder25Pct ?? null,
        notes: l.notes ?? null,
      },
      update: {
        country: l.country ?? '—',
        name: l.name,
        tier: l.tier ?? 'neutral',
        zone: l.zone ?? null,
        avgDrawPct: l.avgDrawPct ?? null,
        avgUnder25Pct: l.avgUnder25Pct ?? null,
        notes: l.notes ?? null,
      },
    });
    upserted++;
  }

  return NextResponse.json({
    ok: true,
    upserted,
    source,
    sourceUrl,
    version: catalog.version ?? null,
    updatedAt: catalog.updatedAt ?? null,
  });
}
