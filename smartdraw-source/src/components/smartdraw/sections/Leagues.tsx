'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe2, Search, RefreshCw, CheckCircle2, Ban } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/format';

const ZONES = [
  'Все',
  'Латинская Америка',
  'Южная Европа',
  'Африка и БВ',
  'Восточная/Северная Европа',
  'Международные турниры',
  'Чёрный список',
];

export function Leagues() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tier, setTier] = useState<'all' | 'whitelist' | 'blacklist'>('all');
  const [zone, setZone] = useState('Все');
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leagues', tier, zone, q],
    queryFn: () => {
      const params: { tier?: string; zone?: string; q?: string } = {};
      if (tier !== 'all') params.tier = tier;
      if (zone !== 'Все') params.zone = zone;
      if (q) params.q = q;
      return api.leagues.list(params);
    },
  });

  const seedMut = useMutation({
    mutationFn: () => api.leagues.seed(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['leagues'] });
      toast({
        title: 'Справочник обновлён',
        description: `Загружено лиг: ${r.upserted}`,
      });
    },
  });

  const leagues = data?.leagues ?? [];

  const whitelistCount = useMemo(
    () => leagues.filter((l) => l.tier === 'whitelist').length,
    [leagues],
  );
  const blacklistCount = useMemo(
    () => leagues.filter((l) => l.tier === 'blacklist').length,
    [leagues],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Справочник лиг
          </h1>
          <p className="text-sm text-muted-foreground">
            Whitelist — прагматичные низкорезультативные лиги (ничьи 30%+, ТМ 2.5 60%+).
            Blacklist — аномально высокорезультативные (исключить).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => seedMut.mutate()}
          disabled={seedMut.isPending}
        >
          <RefreshCw className={cn('h-4 w-4 mr-1', seedMut.isPending && 'animate-spin')} />
          {seedMut.isPending ? 'Загрузка…' : 'Обновить из ТЗ'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {(['all', 'whitelist', 'blacklist'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                tier === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted',
              )}
            >
              {t === 'all'
                ? `Все (${leagues.length})`
                : t === 'whitelist'
                  ? `Whitelist (${whitelistCount})`
                  : `Blacklist (${blacklistCount})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск лиги или страны…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 w-56 pl-7 text-sm"
          />
        </div>
      </div>

      {/* Zone chips */}
      <div className="flex flex-wrap gap-1.5">
        {ZONES.map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
              zone === z
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {z}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe2 className="h-4 w-4" /> Каталог
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {leagues.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : leagues.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Лиг не найдено. Нажмите «Обновить из ТЗ».
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto scroll-area-custom">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-card z-10">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Страна</th>
                    <th className="text-left font-medium px-4 py-2">Лига</th>
                    <th className="text-left font-medium px-4 py-2">Зона</th>
                    <th className="text-right font-medium px-4 py-2">Ничьи %</th>
                    <th className="text-right font-medium px-4 py-2">ТМ 2.5 %</th>
                    <th className="text-left font-medium px-4 py-2">Статус</th>
                    <th className="text-left font-medium px-4 py-2">Заметка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leagues.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2 whitespace-nowrap">{l.country}</td>
                      <td className="px-4 py-2 font-medium">{l.name}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {l.zone ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular">
                        {l.avgDrawPct != null ? `${l.avgDrawPct}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular">
                        {l.avgUnder25Pct != null ? `${l.avgUnder25Pct}%` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {l.tier === 'whitelist' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-zone-green">
                            <CheckCircle2 className="h-3.5 w-3.5" /> whitelist
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-zone-red">
                            <Ban className="h-3.5 w-3.5" /> blacklist
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs">
                        {l.notes ?? ''}
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
