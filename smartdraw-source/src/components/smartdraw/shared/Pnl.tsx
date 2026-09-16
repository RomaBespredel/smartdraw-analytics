'use client';

import { cn } from '@/lib/format';
import { formatMoney, formatPct } from '@/lib/format';

export function PnlText({
  value,
  type = 'money',
  className,
  digits = 2,
}: {
  value: number;
  type?: 'money' | 'pct';
  className?: string;
  digits?: number;
}) {
  const positive = value > 0;
  const zero = Math.abs(value) < 0.005;
  return (
    <span
      className={cn(
        'tabular font-mono font-medium',
        positive && 'text-profit',
        !positive && !zero && 'text-loss',
        zero && 'text-muted-foreground',
        className,
      )}
    >
      {type === 'money'
        ? formatMoney(value, true)
        : formatPct(value, true, digits)}
    </span>
  );
}
