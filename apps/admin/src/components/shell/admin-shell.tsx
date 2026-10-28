'use client';

import { LogOut, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { useAdminAuth } from '@/components/auth/admin-auth';
import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';
import { searchNav } from '@/lib/nav';
import { cn } from '@/lib/utils';

import { ThemeToggle } from './theme-toggle';

/** Panel tipo SaaS: navegación lateral con búsqueda, modo claro/oscuro y la sesión. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAdminAuth();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const items = searchNav(query);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside
        className={cn(
          'border-r bg-card md:sticky md:top-0 md:block md:h-dvh',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="flex h-14 items-center px-4 font-semibold">{brand.name} · Admin</div>
        <div className="px-3 pb-3">
          <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-2 text-sm">
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
        </div>
        <nav aria-label="Secciones" className="grid gap-1 px-3">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={() => {
                setOpen(false);
              }}
              className="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-primary"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
          {items.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex h-14 items-center gap-2 border-b px-4">
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
          <p className="ml-auto truncate text-sm text-muted-foreground">
            {user?.email} · {role}
          </p>
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Salir" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
          </Button>
        </header>
        <main className="mx-auto max-w-5xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
