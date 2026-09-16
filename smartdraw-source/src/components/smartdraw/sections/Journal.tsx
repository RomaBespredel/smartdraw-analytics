'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ZoneBadge } from '../shared/ZoneBadge';
import { PnlText } from '../shared/Pnl';
import { formatMoney, formatPct, formatDateTime } from '@/lib/format';
import type { ResultType } from '@/lib/types';

const RESULT_META: Record<ResultType, { label: string }> = {
  draw: { label: 'Ничья' },
  odd: { label: 'Нечет' },
  hedged: { label: 'Страховка' },
  blind: { label: 'Слепая' },
};

export function Journal() {
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'hedged' | 'blind'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['matches', 'finished'],
    queryFn: () => api.matches.list({ status: 'finished' }),
  });

  const matches = useMemo(() => {
    const all = data?.matches ?? [];
    return all.filter((m) => {
      if (filter === 'all') return true;
      if (filter === 'win') return (m.finalPnl ?? 0) > 0;
      if (filter === 'loss') return (m.finalPnl ?? 0) < 0;
      if (filter === 'hedged') return m.resultType === 'hedged';
      if (filter === 'blind') return m.resultType === 'blind';
      return true;
    });
  }, [data, filter]);

  const summary = useMemo(() => {
    const all = data?.matches ?? [];
    const pnl = all.reduce((s, m) => s + (m.finalPnl ?? 0), 0);
    const bank = all.reduce((s, m) => s + m.totalBank, 0);
    const wins = all.filter((m) => (m.finalPnl ?? 0) > 0).length;
    return { count: all.length, pnl, bank, wins, roi: bank ? (pnl / bank) * 100 : 0 };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Журнал</h1>
        <p className="text-sm text-muted-foreground">
          История закрытых матчей с зафиксированным P&L.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 gap-1">
          <div className="text-xs text-muted-foreground uppercase">Матчей</div>
          <div className="text-2xl font-mono font-semibold tabular">
            {summary.count}
          </div>
        </Card>
        <Card className="p-4 gap-1">
          <div className="text-xs text-muted-foreground uppercase">Win-rate</div>
          <div className="text-2xl font-mono font-semibold tabular">
            {summary.count ? ((summary.wins / summary.count) * 100).toFixed(1) : '0.0'}%
          </div>
        </Card>
        <Card className="p-4 gap-1">
          <div className="text-xs text-muted-foreground uppercase">P&L итог</div>
          <div className="text-2xl font-mono font-semibold tabular">
            <PnlText value={summary.pnl} />
          </div>
        </Card>
        <Card className="p-4 gap-1">
          <div className="text-xs text-muted-foreground uppercase">ROI</div>
          <div className="text-2xl font-mono font-semibold tabular">
            <PnlText value={summary.roi} type="pct" digits={2} />
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {([
          ['all', 'Все'],
          ['win', 'Профит'],
          ['loss', 'Убыток'],
          ['hedged', 'Страховка'],
          ['blind', 'Слепая'],
        ] as const).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors border ${
              filter === k
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Закрытые матчи
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Нет закрытых матчей.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Матч</th>
                    <th className="text-left font-medium px-4 py-2 hidden md:table-cell">Лига</th>
                    <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Дата</th>
                    <th className="text-center font-medium px-4 py-2">Счёт</th>
                    <th className="text-left font-medium px-4 py-2">Зона</th>
                    <th className="text-left font-medium px-4 py-2">Исход</th>
                    <th className="text-right font-medium px-4 py-2">Банк</th>
                    <th className="text-right font-medium px-4 py-2">P&L</th>
                    <th className="text-right font-medium px-4 py-2">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matches.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                        {m.homeTeam} — {m.awayTeam}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                        {m.league?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {formatDateTime(m.kickoff)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono tabular">
                        {m.homeScore}:{m.awayScore}
                      </td>
                      <td className="px-4 py-2.5">
                        {m.zone && <ZoneBadge zone={m.zone} />}
                      </td>
                      <td className="px-4 py-2.5">
                        {m.resultType && (
                          <span
                            className={`text-xs ${
                              m.resultType === 'blind'
                                ? 'text-zone-red'
                                : m.resultType === 'hedged'
                                  ? 'text-zone-yellow'
                                  : 'text-zone-green'
                            }`}
                          >
                            {RESULT_META[m.resultType].label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular text-muted-foreground">
                        {formatMoney(m.totalBank)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <PnlText value={m.finalPnl ?? 0} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <PnlText value={m.finalRoi ?? 0} type="pct" digits={1} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
