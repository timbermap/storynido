import type { PublicCollection, PublicStory } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { turningAgeFor } from '@storynido/shared';

import {
  matchTheme,
  offerPrices,
  miniBookOptions,
  piecesForOffer,
  storyForTheme,
  styleForStory,
} from './party';
import type { StyleOption } from './types';

const theme = (slug: string, name: string) => ({ slug, name }) as PublicCollection;
const story = (slug: string, collectionIds: string[], ageMin = 3, ageMax = 8) =>
  ({
    slug,
    collectionIds,
    ageMin,
    ageMax,
    channels: ['events'],
    defaultStyle: null,
  }) as unknown as PublicStory;

describe('temática de la fiesta', () => {
  const themes = [theme('cumple-campeones', 'Campeones'), theme('cumpleanos', 'Fiestas mágicas')];

  it('reconoce el nombre que manda la landing, sin importar mayúsculas', () => {
    expect(matchTheme(themes, ' fiestas MÁGICAS ')?.slug).toBe('cumpleanos');
    expect(matchTheme(themes, 'cumple-campeones')?.name).toBe('Campeones');
  });

  it('una temática escrita a mano en un borrador viejo no selecciona ninguna', () => {
    expect(matchTheme(themes, 'dinosaurios')).toBeNull();
    expect(matchTheme(themes, null)).toBeNull();
  });
});

describe('historia del cuento de recuerdo', () => {
  const stories = [
    story('chicos', ['cumpleanos'], 2, 4),
    story('grandes', ['cumpleanos'], 7, 12),
    story('goles', ['cumple-campeones']),
  ];

  it('elige la de la temática que le queda bien a la edad', () => {
    expect(storyForTheme(stories, 'cumpleanos', 8, null)?.slug).toBe('grandes');
  });

  it('conserva la que ya estaba si sigue siendo de la temática', () => {
    expect(storyForTheme(stories, 'cumpleanos', 8, 'chicos')?.slug).toBe('chicos');
    expect(storyForTheme(stories, 'cumple-campeones', 8, 'chicos')?.slug).toBe('goles');
  });

  it('sin historias en la temática, usa otra de Celebraciones', () => {
    expect(storyForTheme(stories, 'sin-historias', 3, null)?.slug).toBe('chicos');
    expect(storyForTheme([], 'cumpleanos', 3, null)).toBeNull();
  });
});

describe('estilo y opciones del kit', () => {
  const styles = [
    { slug: 'gouache-editorial', contentTypes: ['story'] },
    { slug: 'para-colorear', contentTypes: ['coloring'] },
  ] as StyleOption[];

  it('usa el recomendado si se ofrece; si no, el primero del tipo de contenido', () => {
    expect(styleForStory(story('a', []), styles, 'story')).toBe('gouache-editorial');
    expect(styleForStory(story('a', []), styles, 'coloring')).toBe('para-colorear');
    expect(styleForStory(story('a', []), [], 'story')).toBeNull();
  });

  it('el cuento de recuerdo siempre es mini', () => {
    expect(miniBookOptions(10).length).toBe('mini');
    expect(miniBookOptions(undefined)).toEqual({ length: 'mini' });
  });
});

describe('lo que se lleva', () => {
  const sold = ['invitation', 'thank_you', 'stickers'];

  it('el kit completo marca todo lo que se vende, más el librito', () => {
    expect(piecesForOffer('full_kit', sold)).toEqual([
      'mini_book',
      'invitation',
      'thank_you',
      'stickers',
    ]);
  });

  it('solo la invitación deja el diseño y la invitación', () => {
    expect(piecesForOffer('invitation', sold)).toEqual(['mini_book', 'invitation']);
    expect(piecesForOffer('invitation', ['stickers'])).toEqual(['mini_book']);
  });

  it('los precios de fábrica son los de la landing', () => {
    expect(
      offerPrices({
        designMinor: 999,
        pieces: { invitation: 0, thank_you: 300, activities: 400, stickers: 400, favor_tags: 400 },
      }),
    ).toEqual({ invitationMinor: 999, fullKitMinor: 2499 });
    expect(
      offerPrices({ designMinor: 1000, pieces: { stickers: 1000 }, bundlePercent: 10 })
        .fullKitMinor,
    ).toBe(1800);
  });
});

describe('edad que cumple', () => {
  it('solo en un cumpleaños y dentro del rango', () => {
    expect(turningAgeFor('birthday', 6)).toBe(6);
    expect(turningAgeFor('birthday', 0)).toBeNull();
    expect(turningAgeFor('baptism', 6)).toBeNull();
  });
});
