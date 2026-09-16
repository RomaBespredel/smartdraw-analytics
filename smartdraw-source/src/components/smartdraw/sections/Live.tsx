'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney, formatPct } from '@/lib/format';
import { classifyZone } from '@/lib/math';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ZoneBadge } from '../shared/ZoneBadge';
import { PnlText } from '../shared/Pnl';
import { useUIStore } from '@/store/ui';
import type { Match } from '@/lib/types';

export function Live() {
  const focusMatchId = useUIStore((s) => s.focusMatchId);
  const setFocusMatchId = useUIStore((s) => s.setFocusMatchId);

  const { data: matchesData, isLoading } = useQuery({
    queryKey: ['matches', 'live'],
    queryFn: () => api.matches.list({ status: 'live' }),
    refetchInterval: 5000,
  });

  const matches = matchesData?.matches ?? [];
  const activeId =
    focusMatchId && matches.some((m) => m.id === focusMatchId)
      ? focusMatchId
      : matches[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Лайв-хеджирование</h1>
        <p className="text-sm text-muted-foreground">
          Мониторинг с 55-й минуты. Опасные счета (2:0, 0:2, 3:1, 1:3) — расчёт страховки на Точный Счёт.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Активные матчи
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {matches.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Нет активных лайв-матчей.
                <br />
                Переведите матч из прематч-сканнера кнопкой «В лайв».
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto scroll-area-custom">
                {matches.map((m) => (
                  <LiveRow
                    key={m.id}
                    m={m}
                    active={m.id === activeId}
                    onClick={() => setFocusMatchId(m.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          {activeId ? (
            <LiveDetail key={activeId} matchId={activeId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Выберите матч слева для управления.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveRow({
  m,
  active,
  onClick,
}: {
  m: Match;
  active: boolean;
  onClick: () => void;
}) {
  const zone = classifyZone(m.homeScore, m.awayScore);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
        active ? 'bg-primary/5' : 'hover:bg-muted/40'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {m.homeTeam} — {m.awayTeam}
          </span>
          {zone.zone === 'red' && (
            <span className="h-1.5 w-1.5 rounded-full bg-zone-red animate-pulse" />
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {m.league?.name ?? 'Без лиги'}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-mono font-semibold tabular">
          {m.homeScore}:{m.awayScore}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">{m.minute}'</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function LiveDetail({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: matchesData } = useQuery({
    queryKey: ['matches', 'live'],
    queryFn: () => api.matches.list({ status: 'live' }),
  });
  const match = matchesData?.matches.find((m) => m.id === matchId) ?? null;

  // Local editable state — initialised once from the persisted match (key=matchId remounts)
  const [homeScore, setHomeScore] = useState(match?.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(match?.awayScore ?? 0);
  const [minute, setMinute] = useState(match?.minute || 65);
  const [kLive, setKLive] = useState(3.1);

  const updateMut = useMutation({
    mutationFn: () => {
      if (!match) throw new Error('Матч не найден');
      return api.matches.patch(match.id, {
        homeScore,
        awayScore,
        minute,
        status: 'live',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast({ title: 'Счёт обновлён' });
    },
  });

  const hedgeMut = useMutation({
    mutationFn: () => {
      if (!match) throw new Error('Матч не найден');
      return api.matches.hedge(match.id, {
        minute,
        kLiveCorrectScore: kLive,
        applied: true,
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      toast({
        title: 'Страховка применена',
        description: `Ставка ${formatMoney(r.hedge.sHedgeRounded)} на ТС ${r.hedge.scoreLabel}`,
      });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Ошибка', description: e.message }),
  });

  const finishMut = useMutation({
    mutationFn: (data: {
      homeScore: number;
      awayScore: number;
      hedgeWon?: boolean;
    }) => {
      if (!match) throw new Error('Матч не найден');
      return api.matches.finish(match.id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast({ title: 'Матч закрыт', description: 'P&L зафиксирован.' });
    },
  });

  if (!match) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Матч не найден.
        </CardContent>
      </Card>
    );
  }

  const zone = classifyZone(homeScore, awayScore);
  const total = homeScore + awayScore;
  const diff = Math.abs(homeScore - awayScore);
  const lastHedge = match.hedges[0];

  return (
    <div className="space-y-4">
      {/* Score update */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {match.homeTeam} — {match.awayTeam}
              </CardTitle>
              <CardDescription className="text-xs">
                {match.league?.name ?? 'Без лиги'} · кик-офф{' '}
                {new Date(match.kickoff).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </CardDescription>
            </div>
            <ZoneBadge zone={zone.zone} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Счёт хозяева</Label>
              <Input
                type="number"
                min={0}
                value={homeScore}
                onChange={(e) => setHomeScore(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Счёт гости</Label>
              <Input
                type="number"
                min={0}
                value={awayScore}
                onChange={(e) => setAwayScore(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Минута</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
              />
            </div>
          </div>

          <div
            className={`rounded-lg border p-3 ${
              zone.zone === 'green'
                ? 'border-zone-green/30 bg-zone-green/5'
                : zone.zone === 'red'
                  ? 'border-zone-red/30 bg-zone-red/5'
                  : 'border-zone-yellow/30 bg-zone-yellow/5'
            }`}
          >
            <div className="flex items-start gap-2">
              {zone.zone === 'green' && (
                <CheckCircle2 className="h-5 w-5 text-zone-green shrink-0 mt-0.5" />
              )}
              {zone.zone === 'red' && (
                <AlertTriangle className="h-5 w-5 text-zone-red shrink-0 mt-0.5" />
              )}
              {zone.zone === 'yellow' && (
                <Clock className="h-5 w-5 text-zone-yellow shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{zone.label}</div>
                <div className="text-xs text-muted-foreground">{zone.reason}</div>
                <div className="text-[11px] font-mono text-muted-foreground pt-1">
                  Тотал {total} · Разница {diff}
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending}
          >
            <Activity className="h-3.5 w-3.5 mr-1" />
            Обновить счёт
          </Button>
        </CardContent>
      </Card>

      {/* Hedge calculator */}
      <Card className={zone.zone === 'red' ? 'border-zone-red/40' : 'opacity-60'}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Калькулятор страховки
          </CardTitle>
          <CardDescription>
            Ставка на Точный Счёт {homeScore}:{awayScore} в лайве — вывод слепой зоны в контролируемый минус.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {zone.zone !== 'red' ? (
            <div className="text-sm text-muted-foreground py-2">
              {zone.zone === 'green'
                ? 'Страховка не требуется — зашло одно из плечей прематча.'
                : 'Аномальный счёт — дождитесь 80+ минуты. Вероятность 5-го гола (переход в Нечет) выше 50%.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    K<sub>live</sub> на ТС {homeScore}:{awayScore}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={kLive}
                    onChange={(e) => setKLive(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Минута</Label>
                  <Input
                    type="number"
                    value={minute}
                    onChange={(e) => setMinute(Number(e.target.value))}
                  />
                </div>
              </div>

              <HedgePreview
                totalBank={match.totalBank}
                kDraw={match.kDraw}
                kOdd={match.kOdd}
                kLive={kLive}
                scoreLabel={`${homeScore}:${awayScore}`}
              />

              <Button
                onClick={() => hedgeMut.mutate()}
                disabled={hedgeMut.isPending}
                className="w-full"
              >
                <Shield className="h-4 w-4 mr-1" />
                {hedgeMut.isPending ? 'Расчёт…' : 'Применить страховку'}
              </Button>
            </>
          )}

          {match.hedges.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase">
                История страховок
              </div>
              {match.hedges.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/40"
                >
                  <div>
                    <span className="font-mono font-medium">{h.scoreLabel}</span>
                    <span className="text-muted-foreground ml-2">
                      {h.minute}' · K {h.kLiveCorrectScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span>ставка {formatMoney(h.sHedgeRounded)}</span>
                    <span
                      className={h.netIfScoreHolds >= 0 ? 'text-profit' : 'text-loss'}
                    >
                      {formatPct(h.netIfScoreHoldsPct, true, 1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close match */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Закрыть матч
          </CardTitle>
          <CardDescription>
            Введите финальный счёт. Если была страховка — укажите, зашла ли она.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinishForm
            key={`${match.id}-${homeScore}-${awayScore}`}
            initialHome={homeScore}
            initialAway={awayScore}
            hasHedge={!!lastHedge && lastHedge.applied}
            onClose={(h, a, hedgeWon) =>
              finishMut.mutate({ homeScore: h, awayScore: a, hedgeWon })
            }
            pending={finishMut.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function HedgePreview({
  totalBank,
  kDraw,
  kOdd,
  kLive,
  scoreLabel,
}: {
  totalBank: number;
  kDraw: number;
  kOdd: number;
  kLive: number;
  scoreLabel: string;
}) {
  if (kLive <= 1) {
    return (
      <div className="text-xs text-muted-foreground">
        Введите лайв-кэффициент &gt; 1.
      </div>
    );
  }
  const sDraw = (totalBank * kOdd) / (kDraw + kOdd);
  const rPrematch = sDraw * kDraw;
  const rawSHedge = rPrematch / kLive;
  const sHedgeRounded = Math.max(50, Math.round(rawSHedge / 50) * 50);
  const netIfHolds = sHedgeRounded * kLive - totalBank - sHedgeRounded;
  const netIfGoal = rPrematch - totalBank - sHedgeRounded;
  const worst = Math.min(netIfHolds, netIfGoal);

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">
            Ставка на ТС {scoreLabel}
          </div>
          <div className="font-mono font-semibold tabular">
            {formatMoney(sHedgeRounded)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">
            Точная (до округл.)
          </div>
          <div className="font-mono tabular text-muted-foreground">
            {formatMoney(rawSHedge)}
          </div>
        </div>
      </div>
      <div className="border-t border-border pt-2 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-zone-green" />
            Счёт сохранится {scoreLabel}
          </span>
          <PnlText value={netIfHolds} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-zone-green" />
            Забьют ещё гол (Нечет)
          </span>
          <PnlText value={netIfGoal} />
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
        Без страховки при {scoreLabel}: убыток{' '}
        <span className="text-loss font-mono">−{formatMoney(totalBank, false)}</span>{' '}
        (−100%). Страховка снижает максимальный убыток до{' '}
        <span
          className={`font-mono ${worst >= 0 ? 'text-profit' : 'text-loss'}`}
        >
          {formatPct((worst / totalBank) * 100, true, 1)}
        </span>
        .
      </div>
    </div>
  );
}

function FinishForm({
  initialHome,
  initialAway,
  hasHedge,
  onClose,
  pending,
}: {
  initialHome: number;
  initialAway: number;
  hasHedge: boolean;
  onClose: (h: number, a: number, hedgeWon?: boolean) => void;
  pending: boolean;
}) {
  const [finalHome, setFinalHome] = useState(initialHome);
  const [finalAway, setFinalAway] = useState(initialAway);
  const [hedgeWon, setHedgeWon] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Финальный счёт хозяева</Label>
          <Input
            type="number"
            min={0}
            value={finalHome}
            onChange={(e) => setFinalHome(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Финальный счёт гости</Label>
          <Input
            type="number"
            min={0}
            value={finalAway}
            onChange={(e) => setFinalAway(Number(e.target.value))}
          />
        </div>
      </div>
      {hasHedge && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hedgeWon}
            onChange={(e) => setHedgeWon(e.target.checked)}
            className="rounded"
          />
          Страховка зашла (счёт после 65&rsquo; не изменился)
        </label>
      )}
      <Button
        onClick={() => onClose(finalHome, finalAway, hasHedge ? hedgeWon : undefined)}
        disabled={pending}
        className="w-full"
      >
        Закрыть матч и зафиксировать P&L
      </Button>
    </div>
  );
}
