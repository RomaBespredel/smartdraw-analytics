'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Activity,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { KpiCard } from '../shared/KpiCard';
import { PnlText } from '../shared/Pnl';
import { ZoneBadge } from '../shared/ZoneBadge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatMoney, formatPct, formatDateTime } from '@/lib/format';
import { useUIStore } from '@/store/ui';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Match, ResultType } from '@/lib/types';

const RESULT_LABELS: Record<ResultType, { label: string; cls: string }> = {
  draw: { label: 'Ничья', cls: 'text-zone-green' },
  odd: { label: 'Нечет', cls: 'text-zone-green' },
  hedged: { label: 'Страховка', cls: 'text-zone-yellow' },
  blind: { label: 'Слепая', cls: 'text-zone-red' },
};

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats.get,
  });
  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['matches', 'recent'],
    queryFn: () => api.matches.list({ limit: 8 }),
  });
  const setSection = useUIStore((s) => s.setSection);

  const ov = stats?.overview;
  const recent = (matchesData?.matches ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          Сводка по стратегии «Ничья + Нечет» на дистанции.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statsLoading || !ov ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-lg" />
          ))
        ) : (
          <>
            <KpiCard
              label="Общий ROI"
              value={formatPct(ov.totalRoi)}
              sub={`от ${formatMoney(ov.totalBankStaked)} банк-оборота`}
              icon={TrendingUp}
              accent={ov.totalRoi >= 0 ? 'profit' : 'loss'}
            />
            <KpiCard
              label="Чистый P&L"
              value={formatMoney(ov.totalPnl, true)}
              sub={`${ov.total} матчей закрыто`}
              icon={Wallet}
              accent={ov.totalPnl >= 0 ? 'profit' : 'loss'}
            />
            <KpiCard
              label="Win-rate"
              value={formatPct(ov.winRate, false, 1)}
              sub={`${ov.wins}П / ${ov.losses}У / ${ov.breakeven}↔`}
              icon={Target}
            />
            <KpiCard
              label="Активных лайв"
              value={ov.activeLive}
              sub={`${ov.activePrematch} в прематче`}
              icon={Activity}
              accent={ov.activeLive > 0 ? 'warn' : 'default'}
            />
            <KpiCard
              label="Страховок"
              value={ov.hedgeCount}
              sub={`${ov.matchesWithHedge} матчей`}
              icon={Shield}
            />
            <KpiCard
              label="Средний ROI/матч"
              value={formatPct(
                ov.total ? ov.totalRoi / ov.total : 0,
                true,
                1,
              )}
              sub="по дистанции"
              icon={Trophy}
              accent={
                ov.total
                  ? ov.totalRoi / ov.total >= 0
                    ? 'profit'
                    : 'loss'
                  : 'default'
              }
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent matches */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Последние матчи</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSection('journal')}
              >
                Весь журнал →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {matchesLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                title="Пока нет матчей"
                hint="Добавьте матч в прематч-сканнере, чтобы начать."
                actionLabel="Открыть сканнер"
                onAction={() => setSection('scanner')}
              />
            ) : (
              <div className="divide-y divide-border">
                {recent.map((m) => (
                  <RecentRow key={m.id} m={m} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Структура исходов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsLoading || !stats ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))
            ) : (
              <>
                {(['draw', 'odd', 'hedged', 'blind'] as ResultType[]).map((rt) => {
                  const count = stats.byResult[rt] ?? 0;
                  const total = stats.overview.total || 1;
                  const pctv = (count / total) * 100;
                  const cfg = RESULT_LABELS[rt];
                  return (
                    <div key={rt} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {rt === 'blind' && (
                            <AlertTriangle className="h-3.5 w-3.5 text-zone-red" />
                          )}
                          {rt === 'hedged' && (
                            <Shield className="h-3.5 w-3.5 text-zone-yellow" />
                          )}
                          {rt === 'draw' && (
                            <Trophy className="h-3.5 w-3.5 text-zone-green" />
                          )}
                          {rt === 'odd' && (
                            <TrendingUp className="h-3.5 w-3.5 text-zone-green" />
                          )}
                          <span className={cfg.cls}>{cfg.label}</span>
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {count} · {pctv.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={
                            rt === 'blind'
                              ? 'bg-zone-red h-full'
                              : rt === 'hedged'
                                ? 'bg-zone-yellow h-full'
                                : 'bg-zone-green h-full'
                          }
                          style={{ width: `${pctv}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 mt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Зелёная зона (профит)</span>
                    <span className="font-mono text-zone-green">
                      {stats.byResult.draw + stats.byResult.odd}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Спасено страховкой</span>
                    <span className="font-mono text-zone-yellow">
                      {stats.byResult.hedged}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Слепая зона (убыток)</span>
                    <span className="font-mono text-zone-red">
                      {stats.byResult.blind}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top leagues by P&L */}
      {stats && stats.byLeague.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Эффективность по лигам</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Лига</th>
                    <th className="text-right font-medium px-4 py-2">Матчей</th>
                    <th className="text-right font-medium px-4 py-2">Банк-оборот</th>
                    <th className="text-right font-medium px-4 py-2">P&L</th>
                    <th className="text-right font-medium px-4 py-2">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.byLeague.slice(0, 8).map((l) => (
                    <tr key={l.league} className="hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium">{l.league}</td>
                      <td className="px-4 py-2 text-right font-mono tabular">
                        {l.count}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular text-muted-foreground">
                        {formatMoney(l.bank)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <PnlText value={l.pnl} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <PnlText value={l.roi} type="pct" digits={1} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecentRow({ m }: { m: Match }) {
  const setSection = useUIStore((s) => s.setSection);
  const setFocusMatchId = useUIStore((s) => s.setFocusMatchId);
  const isLive = m.status === 'live';
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
      onClick={() => {
        if (isLive) {
          setFocusMatchId(m.id);
          setSection('live');
        } else if (m.status === 'finished') {
          setSection('journal');
        } else {
          setSection('scanner');
        }
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {m.homeTeam} — {m.awayTeam}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zone-red uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-zone-red animate-pulse" />
              LIVE {m.minute}'
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {m.league?.name ?? 'Без лиги'} · {formatDateTime(m.kickoff)}
        </div>
      </div>
      <div className="text-right shrink-0">
        {m.status === 'finished' ? (
          <>
            <div className="text-sm font-mono tabular">
              {m.homeScore}:{m.awayScore}
            </div>
            <PnlText value={m.finalPnl ?? 0} className="text-xs" />
          </>
        ) : isLive ? (
          <>
            <div className="text-sm font-mono tabular">
              {m.homeScore}:{m.awayScore}
            </div>
            {m.zone && <ZoneBadge zone={m.zone} className="text-[10px] px-1.5 py-0" />}
          </>
        ) : (
          <>
            <div className="text-xs font-mono tabular text-profit">
              ROI {formatPct(m.roiPrematch ?? 0, true, 1)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {m.passedFilter ? 'в работе' : 'отклонён'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      {actionLabel && (
        <Button size="sm" className="mt-3" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
