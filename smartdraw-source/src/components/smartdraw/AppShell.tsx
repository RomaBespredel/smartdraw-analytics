'use client';

import {
  LayoutDashboard,
  Radar,
  Activity,
  Globe2,
  BookOpen,
  Settings as SettingsIcon,
  Moon,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useUIStore, type SectionKey } from '@/store/ui';
import { cn } from '@/lib/format';
import { Button } from '@/components/ui/button';

const NAV: { key: SectionKey; label: string; icon: typeof Radar }[] = [
  { key: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { key: 'scanner', label: 'Прематч-сканнер', icon: Radar },
  { key: 'live', label: 'Лайв-хеджирование', icon: Activity },
  { key: 'leagues', label: 'Лиги', icon: Globe2 },
  { key: 'journal', label: 'Журнал', icon: BookOpen },
  { key: 'settings', label: 'Настройки', icon: SettingsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const section = useUIStore((s) => s.section);
  const setSection = useUIStore((s) => s.setSection);
  const { setTheme } = useTheme();

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold">SmartDraw</span>
              <span className="text-[10px] text-muted-foreground">
                Ничья + Нечет
              </span>
            </div>
          </div>
          <nav className="ml-4 hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  section === item.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleTheme}
              aria-label="Переключить тему"
            >
              <Sun className="h-4 w-4 hidden dark:block" />
              <Moon className="h-4 w-4 dark:hidden" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-2 pb-2 scroll-area-custom">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                section === item.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 md:px-6 py-6 w-full max-w-[1400px] mx-auto">
        {children}
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-border bg-background">
        <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            SmartDraw Analytics · стратегия «Ничья (X) + Нечетный Тотал»
          </span>
          <span className="font-mono">
            ROI = (1 / (1/K<sub>draw</sub> + 1/K<sub>odd</sub>) − 1) × 100%
          </span>
        </div>
      </footer>
    </div>
  );
}
