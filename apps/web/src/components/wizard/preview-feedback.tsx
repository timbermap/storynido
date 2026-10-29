'use client';

import { PREVIEW_FEEDBACK_REASONS, type PreviewFeedbackReason } from '@storynido/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * "¿Qué mejorarías?" después de la muestra (AUDITORIA-PRODUCTO §1.12). Solo motivos, sin texto
 * libre: podría traer datos del niño. Es opcional y se responde una vez.
 */
export function PreviewFeedback({ bookId }: { bookId: string }) {
  const t = useTranslations('Wizard.feedback');
  const [selected, setSelected] = useState<PreviewFeedbackReason[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (state === 'sent') {
    return (
      <p role="status" className="mt-10 text-center text-sm font-semibold text-muted-foreground">
        {t('thanks')}
      </p>
    );
  }

  async function send() {
    setState('sending');
    try {
      await api('previewFeedback', { params: { bookId }, body: { reasons: selected } });
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <section
      aria-labelledby="preview-feedback"
      className="mt-10 rounded-2xl border bg-card p-5 sm:p-6"
    >
      <h2 id="preview-feedback" className="text-lg font-medium">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PREVIEW_FEEDBACK_REASONS.map((reason) => {
          const on = selected.includes(reason);
          return (
            <button
              key={reason}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setSelected((current) =>
                  on ? current.filter((item) => item !== reason) : [...current, reason],
                );
              }}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                on
                  ? 'border-navy bg-navy text-white'
                  : 'border-border bg-card hover:border-navy/40',
              )}
            >
              {t(`reasons.${reason}`)}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={selected.length === 0 || state === 'sending'}
          onClick={() => void send()}
        >
          {t('send')}
        </Button>
        {state === 'error' && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {t('error')}
          </p>
        )}
      </div>
    </section>
  );
}
