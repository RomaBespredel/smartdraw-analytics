'use client';

import type { League, Match, Settings, Stats, Hedge } from './types';

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Leagues ────────────────────────────────────────────────────────────
export const api = {
  leagues: {
    list: (params: { tier?: string; zone?: string; q?: string } = {}) => {
      const sp = new URLSearchParams();
      if (params.tier) sp.set('tier', params.tier);
      if (params.zone) sp.set('zone', params.zone);
      if (params.q) sp.set('q', params.q);
      return jfetch<{ leagues: League[] }>(`/api/leagues?${sp}`);
    },
    seed: () =>
      jfetch<{ ok: boolean; upserted: number }>(`/api/leagues`, { method: 'POST' }),
    sync: (url?: string) => {
      const qs = url ? `?url=${encodeURIComponent(url)}` : '';
      return jfetch<{
        ok: boolean;
        upserted: number;
        source: string;
        sourceUrl?: string;
        version?: number | null;
        updatedAt?: string | null;
        message?: string;
      }>(`/api/leagues/sync${qs}`, { method: 'POST' });
    },
  },
  db: {
    status: () =>
      jfetch<{
        dbPath: string;
        dbSizeBytes: number;
        dbSizeHuman: string;
        counts: { leagues: number; matches: number; hedges: number; settings: number };
        platform: string;
        isPackaged: boolean;
      }>(`/api/db/status`),
    exportBackup: () =>
      jfetch<{
        $schema: string;
        exportedAt: string;
        dbPath: string;
        counts: { leagues: number; matches: number; hedges: number; settings: number };
        data: {
          leagues: League[];
          matches: unknown[];
          hedges: unknown[];
          settings: unknown[];
        };
      }>(`/api/db/backup`),
    importBackup: (data: unknown) =>
      jfetch<{ ok: boolean; imported: Record<string, number> }>(`/api/db/backup`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  settings: {
    get: () => jfetch<{ settings: Settings }>(`/api/settings`),
    patch: (data: Partial<Settings>) =>
      jfetch<{ settings: Settings }>(`/api/settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  matches: {
    list: (params: { status?: string; leagueId?: string; limit?: number } = {}) => {
      const sp = new URLSearchParams();
      if (params.status) sp.set('status', params.status);
      if (params.leagueId) sp.set('leagueId', params.leagueId);
      if (params.limit) sp.set('limit', String(params.limit));
      return jfetch<{ matches: Match[] }>(`/api/matches?${sp}`);
    },
    create: (data: Record<string, unknown>) =>
      jfetch<{ match: Match; calc: unknown }>(`/api/matches`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    patch: (id: string, data: Record<string, unknown>) =>
      jfetch<{ match: Match }>(`/api/matches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      jfetch<{ ok: boolean }>(`/api/matches/${id}`, { method: 'DELETE' }),
    hedge: (id: string, data: { minute?: number; kLiveCorrectScore: number; applied?: boolean }) =>
      jfetch<{ hedge: Hedge; calc: unknown; match: Match }>(`/api/matches/${id}/hedge`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    finish: (
      id: string,
      data: { homeScore: number; awayScore: number; hedgeId?: string; hedgeWon?: boolean },
    ) =>
      jfetch<{ match: Match; result: unknown }>(`/api/matches/${id}/finish`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  stats: {
    get: () => jfetch<Stats>(`/api/stats`),
  },
};
