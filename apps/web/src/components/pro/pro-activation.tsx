'use client';

import { BadgeCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type SubmitEvent } from 'react';

import { ApiError, PROFESSIONS, type CountryCode, type Locale } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { countriesByName } from '@/lib/country-names';

const inputClass =
  'h-12 w-full rounded-[0.75rem] border-[1.5px] border-[#b9acbf] bg-card px-3.5 text-base text-foreground placeholder:text-[#756b80] focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d8c1f2]';
const labelClass = 'text-[0.91rem] font-semibold';

type Profession = (typeof PROFESSIONS)[number];

/**
 * Activa la cuenta Pro con un perfil mínimo (profesión, espacio opcional y país). El tipo de
 * cuenta lo escribe la API: el cliente no puede ponérselo solo.
 */
export function ProActivationForm({ onActivated }: { onActivated: () => void }) {
  const t = useTranslations('Pro.activation');
  const locale = useLocale() as Locale;
  const [profession, setProfession] = useState<Profession | ''>('');
  const [other, setOther] = useState('');
  const [practice, setPractice] = useState('');
  const [country, setCountry] = useState<CountryCode>('MX');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profession || (profession === 'other' && !other.trim())) {
      setError(t('required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('proActivate', {
        body: {
          profession,
          professionOther: profession === 'other' ? other.trim() : null,
          practiceName: practice.trim() || null,
          country,
        },
      });
      onActivated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="pro-profession" className={labelClass}>
          {t('profession')}
        </label>
        <select
          id="pro-profession"
          className={inputClass}
          value={profession}
          onChange={(event) => {
            setProfession(event.target.value as Profession);
          }}
        >
          <option value="">{t('professionEmpty')}</option>
          {PROFESSIONS.map((value) => (
            <option key={value} value={value}>
              {t(`professions.${value}`)}
            </option>
          ))}
        </select>
      </div>
      {profession === 'other' && (
        <div className="grid gap-2">
          <label htmlFor="pro-other" className={labelClass}>
            {t('professionOther')}
          </label>
          <input
            id="pro-other"
            className={inputClass}
            value={other}
            maxLength={60}
            onChange={(event) => {
              setOther(event.target.value);
            }}
          />
        </div>
      )}
      <div className="grid gap-2">
        <label htmlFor="pro-practice" className={labelClass}>
          {t('practice')}
        </label>
        <input
          id="pro-practice"
          className={inputClass}
          value={practice}
          maxLength={80}
          placeholder={t('practicePlaceholder')}
          onChange={(event) => {
            setPractice(event.target.value);
          }}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="pro-country" className={labelClass}>
          {t('country')}
        </label>
        <select
          id="pro-country"
          className={inputClass}
          value={country}
          onChange={(event) => {
            setCountry(event.target.value as CountryCode);
          }}
        >
          {countriesByName(locale).map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-muted-foreground">{t('note')}</p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {t('submit')}
      </Button>
    </form>
  );
}

/** Tarjeta para el creador (línea Profesionales): pide activar la cuenta antes de empezar. */
export function ProActivationCard({ onActivated }: { onActivated: () => void }) {
  const t = useTranslations('Pro.activation');
  return (
    <section className="container-page flex max-w-md flex-col gap-8 py-14">
      <header className="space-y-3 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <BadgeCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-medium">{t('title')}</h1>
        <p className="text-muted-foreground">{t('text')}</p>
      </header>
      <ProActivationForm onActivated={onActivated} />
    </section>
  );
}
