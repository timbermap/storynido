'use client';

import type { OrderStatus } from '@storynido/shared';
import { Check, CircleDashed, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { isPrintOrder } from '@/lib/order-state';
import { cn } from '@/lib/utils';

/**
 * Pasos que ve quien compra (cinco en el impreso; el digital no pasa por imprenta ni envío). El
 * pago y su confirmación son un solo paso: «Pagado».
 */
export const PRINT_STEPS = ['paid', 'creating', 'printing', 'shipping', 'delivered'] as const;
export const DIGITAL_STEPS = ['paid', 'creating', 'delivered'] as const;

export type TimelineStep = (typeof PRINT_STEPS)[number];

/** En qué paso está cada estado del pedido (los que no son parte del camino normal no están). */
const STEP_OF: Partial<Record<OrderStatus, TimelineStep>> = {
  pending_payment: 'paid',
  paid: 'creating',
  generating: 'creating',
  qa_failed: 'creating',
  // Un impreso pasa por "listo" un instante antes de ir a la imprenta.
  ready: 'printing',
  sent_to_print: 'printing',
  in_production: 'printing',
  shipped: 'shipping',
  delivered: 'delivered',
};

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

/** Cómo se agrupan los pedidos para quien compra: se arma, está en camino o ya lo tiene. */
export type OrderGroup = 'creating' | 'inProgress' | 'delivered' | 'closed';

export function orderGroup(status: OrderStatus, print: boolean): OrderGroup {
  if (status === 'cancelled' || status === 'refunded') return 'closed';
  if (status === 'delivered') return 'delivered';
  // Un digital listo se entrega al instante: va directo a «Entregados».
  if (status === 'ready') return print ? 'inProgress' : 'delivered';
  if (status === 'sent_to_print' || status === 'in_production' || status === 'shipped') {
    return 'inProgress';
  }
  // Pago, generación y revisión del libro.
  return 'creating';
}

export { isPrintOrder };

/**
 * Pasos del pedido según el formato y en cuál está (-1 si el estado no es parte del camino
 * normal). El último paso, cuando se llega, cuenta como hecho.
 */
export function timelineFor(status: OrderStatus, print: boolean) {
  const steps: readonly TimelineStep[] = print ? PRINT_STEPS : DIGITAL_STEPS;
  // Un digital listo ya está entregado: se descarga al instante.
  const step = !print && status === 'ready' ? 'delivered' : STEP_OF[status];
  const current = step ? steps.indexOf(step) : -1;
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

  const done = (index: number) => index < current || (last && index === current);

  if (compact) {
    return (
      <ol
        aria-label={t('progress', { current: current + 1, total: steps.length })}
        className="grid gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${String(steps.length)}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => (
          <li key={step} className="grid min-w-0 gap-1">
            <span
              className={cn(
                'h-1.5 rounded-full',
                index <= current ? 'bg-primary' : 'bg-border',
                index === current && !last && 'animate-pulse motion-reduce:animate-none',
              )}
            />
            <span
              aria-current={index === current ? 'step' : undefined}
              className={cn(
                'text-[0.625rem] leading-tight tracking-tight sm:text-xs sm:tracking-normal',
                index === current ? 'font-bold text-foreground' : 'text-muted-foreground',
              )}
            >
              {t(`steps.${step}`)}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="grid gap-3">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-3">
          <span
            className={cn(
              'grid size-7 place-items-center rounded-full border-2',
              done(index) && 'border-primary bg-primary text-primary-foreground',
              index === current && !last && 'border-primary text-primary',
              index > current && 'border-border text-muted-foreground',
            )}
          >
            {done(index) ? (
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
