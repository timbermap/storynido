'use client';

import { ApiError } from '@storynido/shared';
import { Loader2, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Opinión sobre el libro recibido (1 a 5 estrellas y un comentario opcional). */
export function OrderReview({
  orderId,
  initial,
}: {
  orderId: string;
  initial: { rating: number; comment: string | null } | null;
}) {
  const t = useTranslations('Checkout.order.review');
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api('orderReview', {
        params: { orderId },
        body: { rating, comment: comment.trim() ? comment.trim() : null },
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="opinion"
      aria-labelledby="opinion-title"
      className="grid scroll-mt-28 gap-3 rounded-2xl border bg-card p-5"
    >
      <h2 id="opinion-title" className="text-xl font-medium">
        {t('title')}
      </h2>
      <div role="radiogroup" aria-label={t('rating')} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={t('stars', { count: value })}
            onClick={() => {
              setRating(value);
              setSaved(false);
            }}
            className="rounded-full p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Star
              className={cn('size-7', value <= rating ? 'fill-star text-star' : 'text-border')}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">{t('comment')}</span>
        <textarea
          id="review-comment"
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            setSaved(false);
          }}
          className="w-full rounded-xl border bg-background p-3"
        />
      </label>
      <p className="text-xs text-muted-foreground">{t('privacy')}</p>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={rating === 0 || saving || saved} onClick={() => void save()}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('save')}
        </Button>
        {saved && (
          <p role="status" className="text-sm font-semibold text-success">
            {t('thanks')}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
