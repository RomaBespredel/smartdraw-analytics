'use client';

import { cn } from '@/lib/format';

type Zone = 'green' | 'red' | 'yellow';

const ZONE_CONFIG: Record<Zone, { label: string; cls: string; dot: string }> = {
  green: {
    label: 'Зелёная',
    cls: 'bg-zone-green/10 text-zone-green border-zone-green/30',
    dot: 'bg-zone-green',
  },
  red: {
    label: 'Опасная',
    cls: 'bg-zone-red/10 text-zone-red border-zone-red/30',
    dot: 'bg-zone-red',
  },
  yellow: {
    label: 'Аномальная',
    cls: 'bg-zone-yellow/10 text-zone-yellow border-zone-yellow/30',
    dot: 'bg-zone-yellow',
  },
};

export function ZoneBadge({
  zone,
  label,
  className,
}: {
  zone: Zone;
  label?: string;
  className?: string;
}) {
  const cfg = ZONE_CONFIG[zone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        cfg.cls,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {label ?? cfg.label}
    </span>
  );
}

export function ZoneDot({ zone, className }: { zone: Zone; className?: string }) {
  const cfg = ZONE_CONFIG[zone];
  return <span className={cn('h-2 w-2 rounded-full', cfg.dot, className)} />;
}
