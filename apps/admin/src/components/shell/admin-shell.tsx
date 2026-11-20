'use client';

import { LogOut, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { useAdminAuth } from '@/components/auth/admin-auth';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { brand } from '@/lib/brand';
import { AREAS, areaOfAttention, areaOfPath, itemsOfArea, searchNav, type Area } from '@/lib/nav';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

import { ThemeToggle } from './theme-toggle';

/**
 * Panel por áreas de trabajo: la barra superior elige el área (General, Marketing, Operaciones…)
 * y el menú vertical muestra solo sus secciones. Un punto en cada área marca avisos pendientes.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAdminAuth();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => api('adminAttention'), []);
  const { data: attention } = useApi(load);
  const dots = useMemo(() => {
    const map = new Map<Area, 'urgent' | 'other'>();
    for (const item of attention?.items ?? []) {
      const area = areaOfAttention(item.kind);
      if (item.level === 'urgent') map.set(area, 'urgent');
      else if (!map.has(area)) map.set(area, 'other');
    }
    return map;
  }, [attention]);

  const area = areaOfPath(pathname);
  const searching = query.trim() !== '';
  const items = searching ? searchNav(query) : itemsOfArea(area);
  const hasMenu = searching || items.length > 1;
  const pathHref = pathname.replace(/\/$/, '') || '/';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="flex h-14 items-center gap-2 px-4">
          {hasMenu && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Abrir el menú"
              aria-expanded={open}
              onClick={() => {
                setOpen(!open);
              }}
            >
              <Menu aria-hidden="true" />
            </Button>
          )}
          <span className="font-semibold whitespace-nowrap">{brand.name} · Admin</span>
          <label className="ml-4 hidden h-9 w-60 items-center gap-2 rounded-md border bg-background px-2 text-sm sm:flex">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar en el panel"
              placeholder="Buscar en todo el panel…"
              className="w-full bg-transparent outline-none"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
            />
          </label>
          <p className="ml-auto hidden truncate text-sm text-muted-foreground lg:block">
            {user?.email} · {role}
          </p>
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Salir" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
          </Button>
        </div>
        <nav aria-label="Áreas" className="flex gap-1 overflow-x-auto px-3">
          {AREAS.map((name) => {
            const first = itemsOfArea(name)[0];
            const dot = dots.get(name);
            return (
              <Link
                key={name}
                href={first?.href ?? '/'}
                aria-current={!searching && name === area ? 'page' : undefined}
                onClick={() => {
                  setQuery('');
                  setOpen(false);
                }}
                className="relative flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:font-semibold aria-[current=page]:text-primary"
              >
                {name}
                {dot && (
                  <span
                    role="img"
                    aria-label={dot === 'urgent' ? 'Hay avisos urgentes' : 'Hay avisos'}
                    className={cn(
                      'size-2 rounded-full',
                      dot === 'urgent' ? 'bg-destructive' : 'bg-amber-500',
                    )}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className={cn(hasMenu && 'md:grid md:grid-cols-[14rem_1fr]')}>
        {hasMenu && (
          <aside
            className={cn(
              'border-r bg-card md:sticky md:top-24 md:block md:h-[calc(100dvh-6rem)] md:overflow-y-auto',
              open ? 'block' : 'hidden',
            )}
          >
            <nav aria-label={searching ? 'Resultados' : area} className="grid gap-1 p-3">
              <label className="mb-2 flex h-9 items-center gap-2 rounded-md border bg-background px-2 text-sm sm:hidden">
                <Search className="size-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar en el panel"
                  placeholder="Buscar…"
                  className="w-full bg-transparent outline-none"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                />
              </label>
              <p className="px-2 pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {searching ? 'Resultados' : area}
              </p>
              {items.map(({ href, label, icon: Icon, area: itemArea }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathHref === href ? 'page' : undefined}
                  onClick={() => {
                    setQuery('');
                    setOpen(false);
                  }}
                  className="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-primary"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                  {searching && (
                    <span className="ml-auto text-xs text-muted-foreground">{itemArea}</span>
                  )}
                </Link>
              ))}
              {items.length === 0 && (
                <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados.</p>
              )}
            </nav>
          </aside>
        )}
        <main className="mx-auto w-full max-w-5xl min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
