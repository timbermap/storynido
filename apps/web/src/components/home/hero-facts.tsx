import { Globe, MapPin, Sparkles, Truck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/**
 * Lo que hay que saber de un vistazo: digital o impreso, atendemos en todo el mundo, el envío
 * depende del país y la vista previa es gratis.
 */
export async function HeroFacts() {
  const t = await getTranslations('Home.trustInline');
  const facts = [
    { icon: Sparkles, text: t('preview') },
    { icon: Globe, text: t('formats') },
    { icon: MapPin, text: t('global') },
    { icon: Truck, text: t('shipping') },
  ];
  return (
    <ul className="mt-8 grid gap-x-8 gap-y-3 text-left text-sm font-semibold text-muted-foreground sm:grid-cols-2">
      {facts.map(({ icon: Icon, text }) => (
        <li key={text} className="inline-flex items-start gap-2.5">
          <Icon
            className="mt-0.5 size-[1.15rem] shrink-0 text-primary/70"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {text}
        </li>
      ))}
    </ul>
  );
}
