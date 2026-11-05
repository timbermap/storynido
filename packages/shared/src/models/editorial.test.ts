import { describe, expect, it } from 'vitest';

import {
  AGE_BANDS,
  DEFAULT_AGE_BANDS,
  DEFAULT_EDITORIAL_CONFIG,
  READING_FORMATS,
  ageBandOf,
  editorialConfigSchema,
  editorialPlan,
  pagesOutOfRange,
  pagesOverCap,
  readingFormatsFor,
  suggestedReading,
  textBandFor,
  withEventWordCap,
  wordlessPages,
  wordsForAge,
} from './editorial';
import { storyTypography } from './typography';

const story = {
  textDensity: 'balanced',
  readingLevel: 'developing',
  contentType: 'story',
} as const;

describe('formatos de lectura por edad', () => {
  it('cada edad de 0 en adelante tiene formatos y uno solo recomendado primero', () => {
    for (const age of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15]) {
      const formats = readingFormatsFor(age);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats.length).toBeLessThanOrEqual(3);
      expect(formats[0]?.recommended).toBe(true);
      expect(formats.filter((format) => format.recommended)).toHaveLength(1);
    }
    expect(readingFormatsFor(null)).toEqual([]);
  });

  it('los bebés no ven libros largos ni los de 9 a 12 libros de bebé', () => {
    expect(readingFormatsFor(1).map((format) => format.length)).toEqual(['mini']);
    expect(readingFormatsFor(10).map((format) => format.key)).toEqual([
      'long_illustrated',
      'short_story',
      'illustrated_story',
    ]);
  });

  it('lo sugerido es el formato recomendado de la edad', () => {
    expect(suggestedReading(1)).toEqual({
      length: 'mini',
      textDensity: 'balanced',
      readingLevel: 'beginner',
    });
    expect(suggestedReading(4).length).toBe('short');
    expect(suggestedReading(7).length).toBe('classic');
    expect(suggestedReading(11).length).toBe('epic');
    // Lo recomendado es siempre la franja de la edad, sin escalones.
    for (const format of READING_FORMATS.filter((item) => item.recommended)) {
      expect(format.textDensity).toBe('balanced');
    }
  });

  it('«Leo solo» es menos texto por página, no un libro más largo', () => {
    const alone = READING_FORMATS.find((format) => format.key === 'read_alone');
    const together = READING_FORMATS.find((format) => format.key === 'read_together');
    expect(alone?.textDensity).toBe('visual');
    expect(alone?.length).toBe(together?.length);
    expect(wordsForAge(7, 'visual', DEFAULT_EDITORIAL_CONFIG).max).toBeLessThan(
      wordsForAge(7, 'balanced', DEFAULT_EDITORIAL_CONFIG).max,
    );
  });

  it('las páginas de cuento del recomendado quedan cerca de las sugeridas de la franja', () => {
    for (const age of [1, 3, 4, 7, 8, 10]) {
      const format = readingFormatsFor(age)[0];
      if (!format) throw new Error('sin formato');
      const plan = editorialPlan({ ...story, ...format }, DEFAULT_EDITORIAL_CONFIG, 12, age);
      const band = DEFAULT_AGE_BANDS[ageBandOf(age)];
      expect(plan.narrativePages).toBeGreaterThanOrEqual(band.minPages);
      expect(plan.narrativePages).toBeLessThanOrEqual(band.maxPages);
    }
  });
});

describe('franjas de edad', () => {
  it('parte 3-5 y 6-8 en 3-4, 5-6 y 7-8', () => {
    expect([0, 2, 3, 4, 5, 6, 7, 8, 9, 12].map(ageBandOf)).toEqual([
      '0-2',
      '0-2',
      '3-4',
      '3-4',
      '5-6',
      '5-6',
      '7-8',
      '7-8',
      '9+',
      '9+',
    ]);
  });

  it('la tabla de palabras por página de la edad', () => {
    expect(AGE_BANDS.map((band) => DEFAULT_AGE_BANDS[band])).toMatchObject([
      { minWords: 0, maxWords: 8, capWords: 10 },
      { minWords: 10, maxWords: 25, capWords: 30 },
      { minWords: 20, maxWords: 40, capWords: 50 },
      { minWords: 40, maxWords: 70, capWords: 80 },
      { minWords: 70, maxWords: 120, capWords: 140 },
    ]);
  });

  it('«Ajustar» mueve a lo sumo un escalón, y nunca fuera de la tabla', () => {
    expect(textBandFor(4, 'visual')).toBe('0-2');
    expect(textBandFor(4, 'balanced')).toBe('3-4');
    expect(textBandFor(4, 'rich')).toBe('5-6');
    expect(textBandFor(1, 'visual')).toBe('0-2');
    expect(textBandFor(11, 'rich')).toBe('9+');
  });

  it('con edad, las palabras salen de la franja; sin edad, de las densidades de siempre', () => {
    const choice = { ...story, length: 'classic' } as const;
    const withAge = editorialPlan(choice, DEFAULT_EDITORIAL_CONFIG, 12, 4);
    expect(withAge.words).toEqual({ min: 10, max: 25, cap: 30 });
    expect(withAge.ageBand).toBe('3-4');
    expect(withAge.textBand).toBe('3-4');
    const legacy = editorialPlan(choice, DEFAULT_EDITORIAL_CONFIG, 12);
    expect(legacy.words).toEqual({ min: 25, max: 60 });
    expect(legacy.ageBand).toBeUndefined();
  });

  it('para colorear, un escalón menos de texto', () => {
    const plan = editorialPlan(
      { ...story, contentType: 'coloring', length: 'short' },
      DEFAULT_EDITORIAL_CONFIG,
      12,
      6,
    );
    expect(plan.textBand).toBe('3-4');
  });

  it('la configuración guardada antes de las franjas toma las de fábrica', () => {
    const { ageBands: _ignored, ...old } = DEFAULT_EDITORIAL_CONFIG;
    const parsed = editorialConfigSchema.parse(old);
    expect(parsed.ageBands).toEqual(DEFAULT_AGE_BANDS);
    expect(
      editorialConfigSchema.safeParse({
        ...DEFAULT_EDITORIAL_CONFIG,
        ageBands: {
          ...DEFAULT_AGE_BANDS,
          '3-4': { minWords: 10, maxWords: 25, capWords: 20, minPages: 12, maxPages: 20 },
        },
      }).success,
    ).toBe(false);
  });
});

describe('tope de palabras del mini cuento', () => {
  it('eventos: el tope de la edad que celebra (60 sin edad) y un rango válido', () => {
    const rich = { words: { min: 70, max: 120 } };
    expect(withEventWordCap(rich, true).words).toEqual({ min: 36, max: 60 });
    expect(withEventWordCap({ words: { min: 5, max: 20 } }, true).words).toEqual({
      min: 5,
      max: 20,
    });
    expect(withEventWordCap(rich, false)).toBe(rich);
    // Un cumple de 4 con «más texto» (franja 5-6) no pasa el tope de los 4 años.
    expect(withEventWordCap({ words: { min: 20, max: 40, cap: 50 } }, true, 4).words).toEqual({
      min: 18,
      max: 30,
      cap: 30,
    });
  });
});

describe('control de palabras por página', () => {
  const words = { min: 10, max: 25, cap: 30 };
  const page = (count: number) => ({ text: Array.from({ length: count }, () => 'luna').join(' ') });

  it('pasa el tope: se reescribe; dentro del tope no', () => {
    expect(pagesOverCap([page(30), page(31), page(12)], words)).toEqual([1]);
    expect(pagesOutOfRange([page(31), page(3), page(12)], words)).toEqual([0, 1]);
  });

  it('las páginas sin texto del plan no cuentan como cortas', () => {
    expect(pagesOutOfRange([page(12), { text: '' }, { text: '' }], words, [1])).toEqual([2]);
  });

  it('los libros anteriores siguen con su margen del 30 %', () => {
    expect(pagesOverCap([page(78), page(79)], { min: 25, max: 60 })).toEqual([1]);
  });
});

describe('páginas sin texto', () => {
  const scenes = (marked: number[]) =>
    Array.from({ length: 12 }, (_, pageIndex) => ({
      pageIndex,
      wordless: marked.includes(pageIndex),
    }));

  it('solo de 3 a 6 años, a lo sumo 2, nunca la primera, la última ni dos seguidas', () => {
    expect(wordlessPages(scenes([0, 8, 9, 10, 11]), 4)).toEqual([8, 10]);
    expect(wordlessPages(scenes([8]), 2)).toEqual([]);
    expect(wordlessPages(scenes([8]), 7)).toEqual([]);
    expect(wordlessPages(scenes([3, 6, 9]), 6)).toEqual([3, 6]);
  });
});

describe('tipografía por edad', () => {
  it('de 0 a 6, Quicksand en MAYÚSCULAS en español y portugués; en inglés no', () => {
    expect(storyTypography('3-4', '3-4', 'es')).toEqual({
      font: 'quicksand',
      minPt: 22,
      maxPt: 26,
      uppercase: true,
    });
    expect(storyTypography('0-2', '0-2', 'pt').uppercase).toBe(true);
    expect(storyTypography('5-6', '5-6', 'en').uppercase).toBe(false);
  });

  it('de 7 a 8, Andika; de 9 en adelante, Fraunces; sin mayúsculas', () => {
    expect(storyTypography('7-8', '7-8', 'es')).toMatchObject({ font: 'andika', uppercase: false });
    expect(storyTypography('9+', '9+', 'es')).toMatchObject({ font: 'fraunces', minPt: 13 });
  });

  it('el tamaño sigue la cantidad de texto si el adulto subió un escalón', () => {
    expect(storyTypography('3-4', '5-6', 'es')).toMatchObject({
      font: 'quicksand',
      maxPt: 22,
      uppercase: true,
    });
  });
});
