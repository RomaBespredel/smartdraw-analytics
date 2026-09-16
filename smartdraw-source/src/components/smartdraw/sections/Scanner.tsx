'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle2, XCircle, Calculator } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney, formatPct } from '@/lib/format';
import { calcPrematch as calcPrematchFn } from '@/lib/math';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/store/ui';
import type { Match } from '@/lib/types';

export function Scanner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const setSection = useUIStore((s) => s.setSection);
  const setFocusMatchId = useUIStore((s) => s.setFocusMatchId);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings.get,
  });
  const { data: leaguesData } = useQuery({
    queryKey: ['leagues', 'whitelist'],
    queryFn: () => api.leagues.list({ tier: 'whitelist' }),
  });
  const { data: matchesData, isLoading } = useQuery({
    queryKey: ['matches', 'prematch'],
    queryFn: () => api.matches.list({ status: 'prematch' }),
  });

  const whitelistLeagues = leaguesData?.leagues ?? [];
  const s = settings?.settings;

  // Form state
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [leagueId, setLeagueId] = useState('');
  const [kickoff, setKickoff] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d.toISOString().slice(0, 16);
  });
  const [totalBank, setTotalBank] = useState<number>(10000);
  const [kDraw, setKDraw] = useState<number>(3.5);
  const [kOdd, setKOdd] = useState<number>(1.9);
  const [kFavorite, setKFavorite] = useState<number | ''>('');
  const [favoriteSide, setFavoriteSide] = useState<'1' | '2'>('1');
  const [bkDraw, setBkDraw] = useState('');
  const [bkOdd, setBkOdd] = useState('');

  // Live preview calculation
  const preview = useMemo(() => {
    if (!kDraw || !kOdd || kDraw <= 1 || kOdd <= 1) return null;
    return calcPrematchFn({
      totalBank: totalBank || 0,
      kDraw,
      kOdd,
      kFavorite: kFavorite === '' ? null : kFavorite,
      roundingStep: s?.roundingStep ?? 50,
      minRoi: s?.minRoi ?? 20,
      minFavoriteK: s?.minFavoriteK ?? 1.9,
    });
  }, [totalBank, kDraw, kOdd, kFavorite, s]);

  const createMut = useMutation({
    mutationFn: () =>
      api.matches.create({
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        leagueId: leagueId || null,
        kickoff: new Date(kickoff).toISOString(),
        totalBank,
        kDraw,
        kOdd,
        kFavorite: kFavorite === '' ? null : kFavorite,
        favoriteSide,
        bkDraw: bkDraw || null,
        bkOdd: bkOdd || null,
      }),
    onSuccess: () => {
      toast({ title: 'Матч добавлен', description: 'Прематч-расчёт сохранён.' });
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setHomeTeam('');
      setAwayTeam('');
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Ошибка', description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.matches.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const toLiveMut = useMutation({
    mutationFn: (id: string) => api.matches.patch(id, { status: 'live', minute: 0 }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      setFocusMatchId(id);
      setSection('live');
    },
  });

  const matches = matchesData?.matches ?? [];

  const onSubmit = () => {
    if (!homeTeam.trim() || !awayTeam.trim()) {
      toast({ variant: 'destructive', title: 'Укажите команды' });
      return;
    }
    createMut.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Прематч-сканнер</h1>
        <p className="text-sm text-muted-foreground">
          Расчёт вилки «Ничья + Нечет», фильтр по ROI и кэфу фаворита, округление сумм.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> Новый матч
            </CardTitle>
            <CardDescription>
              Введите коэффициенты с двух разных БК — система подберёт максимальные и рассчитает плечи.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="home">Хозяева</Label>
                <Input
                  id="home"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="Бока Хуниорс"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="away">Гости</Label>
                <Input
                  id="away"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="Ривер Плейт"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Лига (из whitelist)</Label>
                <Select value={leagueId} onValueChange={setLeagueId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите лигу" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {whitelistLeagues.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.country} · {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kickoff">Кик-офф</Label>
                <Input
                  id="kickoff"
                  type="datetime-local"
                  value={kickoff}
                  onChange={(e) => setKickoff(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bank">Флэт на матч, ₽</Label>
                <Input
                  id="bank"
                  type="number"
                  value={totalBank}
                  onChange={(e) => setTotalBank(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kd">K<sub>draw</sub></Label>
                <Input
                  id="kd"
                  type="number"
                  step="0.01"
                  value={kDraw}
                  onChange={(e) => setKDraw(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ko">K<sub>odd</sub></Label>
                <Input
                  id="ko"
                  type="number"
                  step="0.01"
                  value={kOdd}
                  onChange={(e) => setKOdd(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kf">K<sub>фав</sub> (фильтр)</Label>
                <Input
                  id="kf"
                  type="number"
                  step="0.01"
                  placeholder="необяз."
                  value={kFavorite}
                  onChange={(e) =>
                    setKFavorite(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Сторона фаворита</Label>
                <Select value={favoriteSide} onValueChange={(v) => setFavoriteSide(v as '1' | '2')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">П1 (хозяева)</SelectItem>
                    <SelectItem value="2">П2 (гости)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bkd">БК для Ничьи</Label>
                <Input
                  id="bkd"
                  value={bkDraw}
                  onChange={(e) => setBkDraw(e.target.value)}
                  placeholder="напр. Marathon"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bko">БК для Нечета</Label>
                <Input
                  id="bko"
                  value={bkOdd}
                  onChange={(e) => setBkOdd(e.target.value)}
                  placeholder="напр. Pinnacle"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSubmit} disabled={createMut.isPending}>
                <Plus className="h-4 w-4 mr-1" />
                {createMut.isPending ? 'Сохранение…' : 'Добавить матч'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card className={preview?.passed ? 'border-profit/40' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Предпросмотр расчёта
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!preview ? (
              <p className="text-xs text-muted-foreground">
                Введите коэффициенты, чтобы увидеть расчёт.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">ROI вилки</span>
                  <span
                    className={`font-mono font-semibold tabular ${
                      preview.roi >= (s?.minRoi ?? 20)
                        ? 'text-profit'
                        : 'text-loss'
                    }`}
                  >
                    {formatPct(preview.roi)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Сумма вероятностей
                  </span>
                  <span className="font-mono tabular text-sm">
                    {preview.impliedProbSum.toFixed(3)}
                  </span>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Ставка на Ничью</span>
                    <span className="font-mono tabular">
                      {formatMoney(preview.sDrawRounded)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Ставка на Нечет</span>
                    <span className="font-mono tabular">
                      {formatMoney(preview.sOddRounded)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Гарантийный возврат
                    </span>
                    <span className="font-mono tabular text-profit">
                      {formatMoney(preview.rPrematch)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      ROI после округления
                    </span>
                    <span className="font-mono tabular">
                      {formatPct(preview.roiRounded)}
                    </span>
                  </div>
                </div>
                <div
                  className={`flex items-start gap-2 rounded-md p-2.5 text-xs ${
                    preview.passed
                      ? 'bg-profit/10 text-profit'
                      : 'bg-loss/10 text-loss'
                  }`}
                >
                  {preview.passed ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{preview.passedReasons.join(' ')}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prematch list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Очередь прематча
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {matches.length}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Нет матчей в прематче. Добавьте матч выше.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {matches.map((m) => (
                <PrematchRow
                  key={m.id}
                  m={m}
                  onDelete={() => deleteMut.mutate(m.id)}
                  onToLive={() => toLiveMut.mutate(m.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PrematchRow({
  m,
  onDelete,
  onToLive,
}: {
  m: Match;
  onDelete: () => void;
  onToLive: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            {m.homeTeam} — {m.awayTeam}
          </span>
          {m.passedFilter ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-profit bg-profit/10 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="h-3 w-3" /> в работе
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-loss bg-loss/10 px-1.5 py-0.5 rounded">
              <XCircle className="h-3 w-3" /> отклонён
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {m.league?.name ?? 'Без лиги'} ·{' '}
          {new Date(m.kickoff).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground font-mono tabular">
        <div className="text-center">
          <div className="text-foreground">{m.kDraw.toFixed(2)}</div>
          <div className="text-[10px]">K<sub>draw</sub></div>
        </div>
        <div className="text-center">
          <div className="text-foreground">{m.kOdd.toFixed(2)}</div>
          <div className="text-[10px]">K<sub>odd</sub></div>
        </div>
        <div className="text-center">
          <div
            className={`font-semibold ${m.roiPrematch && m.roiPrematch >= 20 ? 'text-profit' : 'text-loss'}`}
          >
            {formatPct(m.roiPrematch ?? 0)}
          </div>
          <div className="text-[10px]">ROI</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={onToLive} className="h-7 text-xs">
          В лайв
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-loss"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
