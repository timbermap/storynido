'use client';

import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const THEME_KEY = 'storynido-admin:theme';

/** Script previo al pintado: aplica el tema guardado (o el del sistema) sin parpadeo. */
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export function ThemeToggle() {
  function toggle() {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      // Sin storage, el tema dura lo que la pestaña.
    }
  }
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar modo claro u oscuro">
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}
