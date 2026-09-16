'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/format';
import type { LucideIcon } from 'lucide-react';

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  accent?: 'default' | 'profit' | 'loss' | 'warn';
  className?: string;
}) {
  const accentColor = {
    default: 'text-foreground',
    profit: 'text-profit',
    loss: 'text-loss',
    warn: 'text-zone-yellow',
  }[accent];

  return (
    <Card className={cn('p-4 gap-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className={cn('h-4 w-4 text-muted-foreground')} />}
      </div>
      <div className={cn('text-2xl font-semibold tabular font-mono', accentColor)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
