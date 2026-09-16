'use client';

import { AppShell } from '@/components/smartdraw/AppShell';
import { QueryProvider } from '@/components/smartdraw/QueryProvider';
import { useUIStore } from '@/store/ui';
import { Dashboard } from '@/components/smartdraw/sections/Dashboard';
import { Scanner } from '@/components/smartdraw/sections/Scanner';
import { Live } from '@/components/smartdraw/sections/Live';
import { Leagues } from '@/components/smartdraw/sections/Leagues';
import { Journal } from '@/components/smartdraw/sections/Journal';
import { Settings } from '@/components/smartdraw/sections/Settings';

function SectionSwitch() {
  const section = useUIStore((s) => s.section);
  switch (section) {
    case 'dashboard':
      return <Dashboard />;
    case 'scanner':
      return <Scanner />;
    case 'live':
      return <Live />;
    case 'leagues':
      return <Leagues />;
    case 'journal':
      return <Journal />;
    case 'settings':
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

/**
 * Auto-seed is handled server-side now: the /api/leagues GET endpoint calls
 * ensureSeeded() on first request, which populates the DB from the bundled TZ
 * catalogue if it's empty. This works both in dev and in the packaged desktop
 * app, so no client-side bootstrap is needed.
 */
export default function Home() {
  return (
    <QueryProvider>
      <AppShell>
        <SectionSwitch />
      </AppShell>
    </QueryProvider>
  );
}
