import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Mientras carga una página: una ruedita en el centro, debajo del encabezado (que no se mueve).
 * Aparece recién a los 300 ms, así una carga rápida no hace parpadear nada.
 */
export default function Loading() {
  const t = useTranslations('Loading');
  return (
    <div
      role="status"
      aria-live="polite"
      className="page-loading grid min-h-[60vh] place-items-center"
    >
      <span className="grid justify-items-center gap-3 text-sm font-semibold text-muted-foreground">
        <Loader2 className="size-9 animate-spin text-primary" aria-hidden="true" />
        {t('text')}
      </span>
    </div>
  );
}
