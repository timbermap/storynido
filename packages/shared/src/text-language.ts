import type { Locale } from './i18n';

/**
 * Palabras muy frecuentes y propias de cada idioma (sin las que comparten, como «a» o «no»).
 * Alcanza para una frase corta como una dedicatoria; no es un detector general.
 */
const MARKERS: Record<Locale, ReadonlySet<string>> = {
  es: new Set(
    'el la los las que para con por una uno del al es eres te quiero queremos mucho tanto siempre cada noche sueña sueñes tu tus nuestro nuestra amor tía tío abuela abuelo mamá papá feliz cumpleaños gracias venir fiesta mi mis y o pero como cuando muy'.split(
      ' ',
    ),
  ),
  en: new Set(
    'the and for you your with to of is are love loves always every night dreams who my our we from happy birthday thanks thank coming party little big dear grandma grandpa mom dad mum this that'.split(
      ' ',
    ),
  ),
  pt: new Set(
    'o os as que para com por uma um do da dos das é você te amo amamos muito sempre cada noite sonha seu sua nosso nossa amor tia tio vovó vovô mamãe papai feliz aniversário obrigado obrigada vir festa meu minha e ou mas como quando'.split(
      ' ',
    ),
  ),
};

/**
 * En qué idioma parece estar escrito un texto corto (es, en o pt), o null si no se puede saber
 * con confianza (menos de 3 palabras, o sin un idioma que gane con claridad).
 */
export function guessTextLanguage(text: string): Locale | null {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  if (words.length < 3) return null;
  const scores = (Object.keys(MARKERS) as Locale[])
    .map((locale) => ({
      locale,
      score: words.filter((word) => MARKERS[locale].has(word)).length,
    }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (!best || best.score < 2) return null;
  return best.score >= (second?.score ?? 0) * 2 ? best.locale : null;
}

/** El idioma en que parece estar la dedicatoria, si es otro que el del libro (si no, null). */
export function dedicationLanguageMismatch(
  dedication: string | null | undefined,
  bookLanguage: Locale,
): Locale | null {
  const guess = dedication ? guessTextLanguage(dedication) : null;
  return guess && guess !== bookLanguage ? guess : null;
}
