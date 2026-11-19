import { describe, expect, it } from 'vitest';

import { dedicationLanguageMismatch, guessTextLanguage } from './text-language';

describe('idioma de la dedicatoria', () => {
  it('reconoce frases cortas en español, inglés y portugués', () => {
    expect(guessTextLanguage('Para Lu que la queremos tanto')).toBe('es');
    expect(guessTextLanguage('For Emma, who dreams of the stars every night.')).toBe('en');
    expect(guessTextLanguage('Para Sofia, que toda noite sonha com as estrelas.')).toBe('pt');
  });

  it('no adivina con poco texto ni con nombres solos', () => {
    expect(guessTextLanguage('Para Lu')).toBeNull();
    expect(guessTextLanguage('Lu Martina Sofía García')).toBeNull();
  });

  it('avisa solo si no coincide con el idioma del libro', () => {
    expect(dedicationLanguageMismatch('Para Lu que la queremos tanto', 'en')).toBe('es');
    expect(dedicationLanguageMismatch('Para Lu que la queremos tanto', 'es')).toBeNull();
    expect(dedicationLanguageMismatch(null, 'en')).toBeNull();
  });
});
