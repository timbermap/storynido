import { describe, expect, it } from 'vitest';

import { avatarKey, avatarToSheet, hasMemories, type Avatar } from '../models/character';
import { describeCharacterSheet } from './ai';
import { buildStoryPrompt, lessonsBlock, renderTemplate } from './prompts';

const base = {
  template: 'Cuento de {{pageCount}} páginas para {{childName}} ({{age}}). Enseñanzas: {{lessons}}',
  language: 'es' as const,
  pageCount: 12,
  storyTitle: 'La gran aventura espacial',
  childName: 'Martina',
  age: 5,
  pronouns: 'she' as const,
  likes: ['dinosaurios'],
  petName: null,
  bestFriendName: null,
  lessons: [],
};

describe('plantillas de prompts', () => {
  it('completa las variables y deja "—" en las vacías o desconocidas', () => {
    expect(renderTemplate('{{a}} {{ b }} {{c}}', { a: 'uno', b: '' })).toBe('uno — —');
  });

  it('la primera enseñanza es la principal', () => {
    const block = lessonsBlock([
      { name: 'Compartir', guidance: 'a' },
      { name: 'Valentía', guidance: 'b' },
    ]);
    expect(block).toMatch(/^Principal: Compartir/);
    expect(block).toContain('Secundaria: Valentía');
  });

  it('agrega los recuerdos de la familia solo si hay alguno', () => {
    expect(buildStoryPrompt(base)).not.toContain('Detalles reales de la familia');
    const prompt = buildStoryPrompt({
      ...base,
      memories: { moment: null, companion: 'Su abuela Rosa', nickname: 'Tini', favorite: null },
    });
    expect(prompt).toContain('Detalles reales de la familia');
    expect(prompt).toContain('Quién lo acompaña en la aventura: Su abuela Rosa');
    expect(prompt).toContain('Cómo le dicen en casa: Tini');
    expect(prompt).not.toContain('Un momento especial');
    expect(prompt).toContain('Exactamente 12 páginas');
  });

  it('detecta si hay recuerdos cargados', () => {
    expect(hasMemories(null)).toBe(false);
    expect(hasMemories({ moment: null, companion: null, nickname: null, favorite: null })).toBe(
      false,
    );
    expect(hasMemories({ moment: 'x', companion: null, nickname: null, favorite: null })).toBe(
      true,
    );
  });
});

describe('modo sin foto', () => {
  const avatar: Avatar = {
    skinTone: 'brown',
    hairColor: 'dark-brown',
    hairLength: 'medium',
    hairType: 'curly',
    eyeColor: 'hazel',
    glasses: true,
  };

  it('arma la ficha del personaje con los rasgos elegidos', () => {
    const description = describeCharacterSheet(avatarToSheet(avatar, 6));
    expect(description).toContain('about 6 years old');
    expect(description).toContain('shoulder-length, curly, dark brown hair');
    expect(description).toContain('brown skin');
    expect(description).toContain('round glasses');
  });

  it('la clave cambia si cambia un rasgo', () => {
    expect(avatarKey(avatar)).not.toBe(avatarKey({ ...avatar, glasses: false }));
    expect(avatarKey(avatar)).toBe(avatarKey({ ...avatar }));
  });
});
