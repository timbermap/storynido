'use client';

import { LOCALES, samplePrompts, type Locale } from '@storynido/shared';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Probar la plantilla con datos de ejemplo (Martina, 5 años): muestra el prompt de texto y el
 * de una ilustración tal como le llegarían a la IA. No llama a la IA: no tiene costo.
 */
export function PromptTest({ data }: { data: Record<string, unknown> }) {
  const [result, setResult] = useState<{ text: string; image: string } | null>(null);
  const [language, setLanguage] = useState<Locale>('es');
  const [style, setStyle] = useState('soft watercolor, warm light, children book illustration');

  function run() {
    const titles = (data.title ?? {}) as Partial<Record<Locale, string>>;
    setResult(
      samplePrompts({
        textPromptTemplate:
          typeof data.textPromptTemplate === 'string' ? data.textPromptTemplate : '',
        imagePromptTemplate:
          typeof data.imagePromptTemplate === 'string' ? data.imagePromptTemplate : '',
        title: titles[language] ?? '',
        language,
        pageCount: typeof data.pageCount === 'number' ? data.pageCount : 12,
        styleModifier: style,
      }),
    );
  }

  return (
    <section className="grid gap-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="grid gap-1">
          Idioma
          <select
            className="h-9 rounded-md border bg-background px-2"
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value as Locale);
            }}
          >
            {LOCALES.map((locale) => (
              <option key={locale}>{locale}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-60 flex-1 gap-1">
          Estilo de ejemplo
          <input
            className="h-9 rounded-md border bg-background px-2"
            value={style}
            onChange={(event) => {
              setStyle(event.target.value);
            }}
          />
        </label>
        <Button type="button" variant="outline" onClick={run}>
          <FlaskConical aria-hidden="true" /> Probar prompt
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Con datos de ejemplo y sin llamar a la IA (sin costo).
      </p>
      {result && (
        <div className="grid gap-2 md:grid-cols-2">
          {(['text', 'image'] as const).map((key) => (
            <pre
              key={key}
              className="max-h-96 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap"
            >
              {result[key]}
            </pre>
          ))}
        </div>
      )}
    </section>
  );
}
