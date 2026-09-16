'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Settings as SettingsIcon,
  Database,
  RefreshCw,
  Download,
  Upload,
  CloudDownload,
  HardDrive,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api } from '@/lib/api';
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
import type { Settings as SettingsType } from '@/lib/types';

export function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings.get,
  });

  // key on updatedAt so the form remounts with fresh values after a save
  const version = data?.settings?.updatedAt ?? 'init';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground">
          Параметры фильтрации, банк-менеджмента и локальной базы данных.
        </p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <SettingsForm
          key={version}
          initial={data.settings}
          onSaved={(s) => {
            qc.invalidateQueries({ queryKey: ['settings'] });
            toast({ title: 'Настройки сохранены' });
            void s;
          }}
        />
      )}

      <DatabaseSection />
    </div>
  );
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SettingsType;
  onSaved: (s: SettingsType) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<SettingsType>(initial);

  const mut = useMutation({
    mutationFn: (patch: Partial<SettingsType>) => api.settings.patch(patch),
    onSuccess: (r) => {
      onSaved(r.settings);
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Ошибка', description: e.message }),
  });

  const set = (k: keyof SettingsType, v: number) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> Фильтры сканнера
          </CardTitle>
          <CardDescription>Пороги отбора матчей в прематче.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Минимальный ROI вилки, %"
            hint="В работу берутся матчи с ROI ≥ порога (по ТЗ — 20%)."
            value={form.minRoi}
            onChange={(v) => set('minRoi', v)}
            step={0.5}
          />
          <Field
            label="Минимальный кэф фаворита"
            hint="Отсечение явных фаворитов (по ТЗ — ≥1.90, идеально ≥2.05)."
            value={form.minFavoriteK}
            onChange={(v) => set('minFavoriteK', v)}
            step={0.05}
          />
          <Field
            label="Флэт на матч по умолчанию, ₽"
            hint="Размер банка S на один матч."
            value={form.defaultBank}
            onChange={(v) => set('defaultBank', v)}
            step={500}
          />
          <Field
            label="Шаг округления ставки, ₽"
            hint="Округление кратно 50/100 для скрытия «вилочной» активности."
            value={form.roundingStep}
            onChange={(v) => set('roundingStep', v)}
            step={50}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Лайв-мониторинг</CardTitle>
          <CardDescription>Окно принятия решений по страховке.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field
            label="Старт мониторинга, мин"
            hint="С какой минуты включается отслеживание (по ТЗ — 55')."
            value={form.liveStartMin}
            onChange={(v) => set('liveStartMin', v)}
          />
          <Field
            label="Конец окна, мин"
            hint="До какой минуты принимается решение (по ТЗ — 65')."
            value={form.liveEndMin}
            onChange={(v) => set('liveEndMin', v)}
          />
          <Field
            label="Целевой убыток страховки, %"
            hint="Контролируемый минус после хеджа (по ТЗ — −18%)."
            value={form.hedgeTargetLoss}
            onChange={(v) => set('hedgeTargetLoss', v)}
            step={1}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {mut.isPending ? 'Сохранение…' : 'Сохранить настройки'}
        </Button>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  step,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && (
        <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
      )}
    </div>
  );
}

// ─── Database section: status, sync from network, backup/restore ───────────
function DatabaseSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [syncUrl, setSyncUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['db', 'status'],
    queryFn: api.db.status,
    refetchInterval: 15_000,
  });

  const syncMut = useMutation({
    mutationFn: () => api.leagues.sync(syncUrl || undefined),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['leagues'] });
      qc.invalidateQueries({ queryKey: ['db', 'status'] });
      toast({
        title: 'Справочник обновлён',
        description:
          r.source === 'remote'
            ? `Из сети: ${r.upserted} лиг (источник: ${r.sourceUrl ?? 'remote'}).`
            : r.source === 'bundled'
              ? `Локальный каталог: ${r.upserted} лиг (сеть недоступна).`
              : `Встроенный справочник: ${r.upserted} лиг.`,
      });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Ошибка синхронизации', description: e.message }),
  });

  const exportMut = useMutation({
    mutationFn: () => api.db.exportBackup(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartdraw-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Бэкап создан',
        description: `${data.counts.leagues} лиг, ${data.counts.matches} матчей, ${data.counts.hedges} страховок.`,
      });
    },
  });

  const importMut = useMutation({
    mutationFn: (data: unknown) => api.db.importBackup(data),
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast({
        title: 'База восстановлена',
        description: `Импортировано: ${r.imported.leagues} лиг, ${r.imported.matches} матчей, ${r.imported.hedges} страховок.`,
      });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Ошибка импорта', description: e.message }),
  });

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        importMut.mutate(data);
      } catch {
        toast({ variant: 'destructive', title: 'Файл повреждён', description: 'Не удалось разобрать JSON.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" /> Локальная база данных
        </CardTitle>
        <CardDescription>
          Приложение работает полностью офлайн — все данные хранятся в локальной SQLite-БД на вашем ПК.
          Справочник лиг можно обновить из открытого сетевого источника.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status */}
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : status ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Файл БД:</span>
              <span className="font-mono text-xs">{status.dbPath}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {status.dbSizeHuman}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <Stat label="Лиги" value={status.counts.leagues} />
              <Stat label="Матчи" value={status.counts.matches} />
              <Stat label="Страховки" value={status.counts.hedges} />
              <Stat label="Настройки" value={status.counts.settings} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
              {status.isPackaged ? (
                <>
                  <HardDrive className="h-3.5 w-3.5 text-profit" />
                  <span>Десктоп-режим (Electron) · {status.platform}</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5 text-zone-yellow" />
                  <span>Режим разработки · {status.platform}</span>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Sync from network */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CloudDownload className="h-4 w-4" />
            Обновить справочник лиг из сети
          </div>
          <p className="text-xs text-muted-foreground">
            Подтягивает актуальный каталог лиг из открытого JSON-источника.
            По умолчанию используется публичный репозиторий. Можно указать свой URL.
            Если сеть недоступна — будет использован встроенный каталог.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://…/leagues-catalog.json (необязательно)"
              value={syncUrl}
              onChange={(e) => setSyncUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              variant="outline"
            >
              {syncMut.isPending ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-1" />
              )}
              {syncMut.isPending ? 'Синхронизация…' : 'Обновить'}
            </Button>
          </div>
        </div>

        {/* Backup / restore */}
        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4" />
            Резервная копия и перенос
          </div>
          <p className="text-xs text-muted-foreground">
            Сохраните всю базу (лиги, матчи, страховки, настройки) в JSON-файл для бэкапа или переноса на другой ПК.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => exportMut.mutate()}
              disabled={exportMut.isPending}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-1" />
              Экспорт в файл
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importMut.isPending}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-1" />
              Импорт из файла
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFileSelected}
            />
          </div>
          {importMut.isPending && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Импорт…
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background px-2 py-1.5 border border-border">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-mono font-semibold tabular">{value}</div>
    </div>
  );
}
