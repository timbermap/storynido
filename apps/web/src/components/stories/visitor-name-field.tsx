'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

import { VISITOR_NAME_MAX, readVisitorName, saveVisitorName } from '@/lib/visitor-name';
import { cn } from '@/lib/utils';

/**
 * «¿Cómo se llama?»: con un nombre, todas las portadas del sitio lo muestran. Es solo una vista
 * previa: el dibujo es el de nuestro personaje, y el libro real lleva a su hijo.
 */
export function VisitorNameField({ className }: { className?: string }) {
  const t = useTranslations('Stories.visitorName');
  const id = useId();
  const [name, setName] = useState('');
  // localStorage solo se puede leer después de montar (en el servidor no existe): evita diferencias al hidratar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(readVisitorName() ?? '');
  }, []);
  return (
    <div className={cn('max-w-md', className)}>
      <label htmlFor={id} className="block text-sm font-bold">
        {t('label')}
      </label>
      <input
        id={id}
        value={name}
        maxLength={VISITOR_NAME_MAX}
        autoComplete="off"
        placeholder={t('placeholder')}
        onChange={(event) => {
          setName(event.target.value);
          saveVisitorName(event.target.value);
        }}
        className="mt-1.5 h-12 w-full rounded-xl border-[1.5px] border-[#b7bcc8] bg-card px-4 text-lg font-semibold focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d9cef0]"
      />
      <p aria-live="polite" className="mt-1.5 min-h-5 text-xs text-muted-foreground">
        {name.trim() ? t('note') : t('hint')}
      </p>
    </div>
  );
}
