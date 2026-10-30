'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type SubmitEvent } from 'react';

import { ApiError, CONTACT_TOPICS, type Locale } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';

export const CONTACT_ID = 'contact';

const inputClass =
  'w-full rounded-[0.75rem] border-[1.5px] border-[#b7bcc8] bg-card px-3.5 text-base text-foreground placeholder:text-[#555c6e] focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d9cef0]';
const labelClass = 'text-[0.91rem] font-semibold';

/**
 * Formulario de contacto: llega al equipo por mail y "Responder" le contesta a quien escribió.
 * El mail del equipo no aparece en la página. `website` es una trampa para bots (oculta).
 */
export function ContactForm() {
  const t = useTranslations('Contact');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<(typeof CONTACT_TOPICS)[number]>('order');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'limited'>('idle');

  // Con sesión, nombre y mail ya completos (se pueden cambiar).
  useEffect(() => {
    if (!user) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName((current) => current || (user.displayName ?? ''));
    setEmail((current) => current || (user.email ?? ''));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    try {
      await api('contact', {
        body: {
          name: name.trim(),
          email: email.trim(),
          topic,
          message: message.trim(),
          locale,
          page: pathname,
          ...(website ? { website } : {}),
        },
      });
      setStatus('sent');
    } catch (error) {
      setStatus(error instanceof ApiError && error.status === 429 ? 'limited' : 'error');
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl bg-mint p-6 text-success">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t('sentTitle')}</p>
          <p className="mt-1 text-sm">{t('sentText')}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="contact-name" className={labelClass}>
            {t('name')}
          </label>
          <input
            id="contact-name"
            required
            maxLength={80}
            autoComplete="name"
            className={`${inputClass} h-12`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="contact-email" className={labelClass}>
            {t('email')}
          </label>
          <input
            id="contact-email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            inputMode="email"
            className={`${inputClass} h-12`}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="contact-topic" className={labelClass}>
          {t('topic')}
        </label>
        <select
          id="contact-topic"
          className={`${inputClass} h-12`}
          value={topic}
          onChange={(event) => {
            setTopic(event.target.value as (typeof CONTACT_TOPICS)[number]);
          }}
        >
          {CONTACT_TOPICS.map((item) => (
            <option key={item} value={item}>
              {t(`topics.${item}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <label htmlFor="contact-message" className={labelClass}>
          {t('message')}
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          maxLength={2000}
          className={`${inputClass} h-36 py-3`}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
        />
      </div>
      {/* Trampa para bots: una persona no la ve ni la completa. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => {
            setWebsite(event.target.value);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('privacy')}</p>
      <div>
        <Button type="submit" size="lg" disabled={status === 'sending'}>
          {status === 'sending' && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('send')}
        </Button>
      </div>
      {(status === 'error' || status === 'limited') && (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {t(status === 'limited' ? 'limited' : 'error')}
        </p>
      )}
    </form>
  );
}
