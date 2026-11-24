'use client';

import { Check, Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Compartir por WhatsApp, el canal donde se mueve el boca a boca. En el celular abre el menú del
 * sistema (con WhatsApp primero); en la compu abre WhatsApp Web con el mensaje escrito. El enlace
 * lleva utm_source/medium/campaign para verlo en «Visitas y campañas» y nunca datos del niño.
 */
export function ShareButton({
  text,
  url,
  campaign,
  label,
  copyLabel,
  copiedLabel,
}: {
  text: string;
  /** Ruta ya localizada, p. ej. `/es/families`. */
  url: string;
  campaign: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  function link(): string {
    const target = new URL(url, window.location.origin);
    target.searchParams.set('utm_source', 'whatsapp');
    target.searchParams.set('utm_medium', 'share');
    target.searchParams.set('utm_campaign', campaign);
    return target.toString();
  }

  async function share() {
    const href = link();
    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text, url: href }).catch(() => undefined);
      return;
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text} ${href}`)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${link()}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sin permiso para el portapapeles: queda el botón de WhatsApp.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => void share()}>
        <MessageCircle aria-hidden="true" />
        {label}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void copy()}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        <span role="status">{copied ? copiedLabel : copyLabel}</span>
      </Button>
    </div>
  );
}
