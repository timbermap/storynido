'use client';

import type { OrderStatus } from '@storynido/shared';
import { Check, CircleDashed, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

const DIGITAL_STEPS = ['pending_payment', 'paid', 'generating', 'ready'] as const;
const PRINT_STEPS = [
  'pending_payment',
  'paid',
  'generating',
  'sent_to_print',
  'in_production',
  'shipped',
  'delivered',
] as const;

/** Estados en los que el libro ya está generado (se puede descargar o volver a pedir). */
export const GENERATED_STATUSES = new Set<OrderStatus>([
  'ready',
  'sent_to_print',
  'in_production',
  'shipped',
  'delivered',
]);

/** Estados en los que ya no hay nada que esperar. */
export const SETTLED_STATUSES = new Set<OrderStatus>([
  'delivered',
  'qa_failed',
  'cancelled',
  'refunded',
]);

export const isPrintOrder = (items: { format: string }[]) =>
  items.some((item) => item.format !== 'digital');

/** Pasos del pedido según el formato; -1 si el estado no es parte del camino normal. */
export function timelineFor(status: OrderStatus, print: boolean) {
  const steps: readonly OrderStatus[] = print ? PRINT_STEPS : DIGITAL_STEPS;
  // Un impreso pasa por "listo" un instante antes de ir a la imprenta.
  const current = steps.indexOf(print && status === 'ready' ? 'sent_to_print' : status);
  return { steps, current };
}

/** Línea de tiempo amable del pedido (vertical en la página del pedido, compacta en la cuenta). */
export function OrderTimeline({
  status,
  print,
  compact = false,
}: {
  status: OrderStatus;
  print: boolean;
  compact?: boolean;
}) {
  const t = useTranslations('Checkout.order');
  const { steps, current } = timelineFor(status, print);
  if (current < 0) return null;
  const last = current === steps.length - 1;

  if (compact) {
    return (
      <div
        role="img"
        aria-label={t('progress', { current: current + 1, total: steps.length })}
        className="flex gap-1"
      >
        {steps.map((step, index) => (
          <span
            key={step}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              index <= current ? 'bg-primary' : 'bg-border',
              index === current && !last && 'animate-pulse',
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <ol className="grid gap-3">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-3">
          <span
            className={cn(
              'grid size-7 place-items-center rounded-full border-2',
              (index < current || (last && index === current)) &&
                'border-primary bg-primary text-primary-foreground',
              index === current && !last && 'border-primary text-primary',
              index > current && 'border-border text-muted-foreground',
            )}
          >
            {index < current || (last && index === current) ? (
              <Check className="size-4" aria-hidden="true" />
            ) : index === current ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CircleDashed className="size-4" aria-hidden="true" />
            )}
          </span>
          <span className={index > current ? 'text-muted-foreground' : 'font-semibold'}>
            {t(`steps.${step}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
