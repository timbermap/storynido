import { describe, expect, it } from 'vitest';

import { bookLanguageFor } from '../i18n';
import { artDirection, TEXT_ZONE } from '../models/art-direction';
import { layoutSceneNote } from '../models/page-layout';
import type { CharacterSheet, ScenePlan } from './ai';
import {
  ageFitRule,
  buildStoryPrompt,
  coverScene,
  coverSetting,
  describeCharacter,
  identityFeatures,
} from './prompts';

/**
 * Casos fijos de la muestra de «Lu» en staging (DECISIONS 264): una foto de adulta para un cuento
 * de 5 años, el dibujo del perfil en gouache con el estilo «clásico», el borrador creado desde /en
 * con el perfil en español y el papá que nadie describió. Personaje inventado a partir de esos
 * datos; ninguna foto real.
 */
const LU_SHEET: CharacterSheet = {
  apparentAge: 'around 35-40 years old',
  hair: 'medium-length straight blond hair',
  eyes: 'brown eyes',
  skinTone: 'light skin',
  distinctiveFeatures: ['sunglasses', 'laugh lines', 'freckles on the nose', 'a cap'],
  clothing: 'a cream fleece jacket and blue jeans',
};
const LU_TRAITS = {
  skinTone: 'light',
  hairColor: 'blond',
  hairLength: 'medium',
  hairType: 'straight',
  eyeColor: 'brown',
  glasses: true,
  distinctive: null,
} as const;

describe('caso Lu: foto de adulta y cuento de 5 años', () => {
  const description = describeCharacter('Lu', 5, LU_SHEET, LU_TRAITS, ['hair', 'glasses']);

  it('la edad del cuento manda: nunca la edad aparente de la foto', () => {
    expect(description).toContain('Lu: a 5-year-old child');
    expect(description).toContain('as they would look at 5 years old');
    expect(description).not.toContain('35-40');
  });

  it('de la foto solo rasgos: sin anteojos de sol, gorros ni marcas de la edad', () => {
    expect(description.split('; also: ')[1]).toBe('freckles on the nose');
    expect(description).toContain('never copy sunglasses, hats');
    expect(description).toContain('clear prescription glasses (never sunglasses)');
    expect(identityFeatures(['round glasses', 'dimples', 'grey hair'])).toEqual(['dimples']);
  });

  it('la dirección de arte usa las proporciones de su edad', () => {
    const direction = artDirection({ age: 5, channel: 'families', style: 'cuento-clasico' });
    expect(direction).toContain('For ages 3-5');
    expect(direction).toContain('ink line and opaque paint');
  });

  it('un protagonista adulto o adolescente se nombra como tal', () => {
    expect(describeCharacter('Abu', 70, LU_SHEET, LU_TRAITS, [])).toContain('a 70-year-old adult');
    expect(describeCharacter('Tomi', 14, LU_SHEET, LU_TRAITS, [])).toContain(
      'a 14-year-old teenager',
    );
  });
});

describe('caso Lu: portada en un lugar del cuento y con la técnica de las páginas', () => {
  const plan = {
    places: [
      { name: 'the cave', look: 'a dark cave' },
      { name: "Lu's bedroom", look: 'a cozy bedroom with a wooden bed and a blue mat' },
    ],
    scenes: [0, 1, 2].map((pageIndex): ScenePlan => ({
      pageIndex,
      sceneGoal: '',
      emotionalBeat: '',
      mustBeVisible: [],
      notVisible: [],
      continuityFacts: [],
      wordBudget: 20,
      personalDetail: null,
      place: pageIndex === 0 ? 'the cave' : "Lu's bedroom",
    })),
  };

  it('elige el lugar que más se repite y no inventa paisajes', () => {
    const setting = coverSetting(plan);
    expect(setting).toBe("Lu's bedroom, a cozy bedroom with a wooden bed and a blue mat");
    const scene = coverScene('Lu stands on a mat.', 'Goodnight, Lu', setting);
    expect(scene).toContain("Setting: Lu's bedroom");
    expect(scene).toContain('never invent new landscapes');
    expect(scene).toContain('exactly the same art technique');
    expect(scene).not.toMatch(/striking hero pose|richer and more dramatic/);
  });

  it('sin lugares en el plan, null', () => {
    expect(coverSetting({ places: [], scenes: [] })).toBeNull();
    expect(coverSetting(null)).toBeNull();
  });
});

describe('caso Lu: zona del texto', () => {
  it('la página dice qué tercio lleva el texto y deja al personaje entero en los otros dos', () => {
    expect(layoutSceneNote({ kind: 'calm', side: 'bottom' })).toContain('upper two thirds');
    expect(layoutSceneNote({ kind: 'calm', side: 'top' })).toContain('lower two thirds');
    expect(layoutSceneNote({ kind: 'overlay', side: 'bottom' })).toContain('upper two thirds');
    // La regla general ya no deja que el modelo elija el tercio.
    expect(TEXT_ZONE).not.toContain('(or the top third)');
  });
});

describe('caso Lu: historia de otra edad', () => {
  it('Buenas noches (0 a 2) para una nena de 5: el cuento se adapta', () => {
    expect(ageFitRule(5, { min: 0, max: 2 })).toContain('adapta');
    expect(ageFitRule(1, { min: 0, max: 2 })).toBeNull();
    expect(ageFitRule(2, { min: 4, max: 8 })).toContain('simplifica');
    const prompt = buildStoryPrompt({
      template: 'Cuento para {{childName}}',
      language: 'es',
      spanishVoice: 'vos',
      pageCount: 10,
      storyTitle: 'Buenas noches, Lu',
      childName: 'Lu',
      age: 5,
      pronouns: 'she',
      likes: [],
      petName: null,
      bestFriendName: null,
      lessons: [],
      storyAges: { min: 0, max: 2 },
    });
    expect(prompt).toContain('pensada para 0 a 2 años');
    expect(prompt).toContain('español rioplatense');
  });
});

describe('caso Lu: idioma del libro', () => {
  it('el perfil (es) manda sobre la URL (en); sin perfil, la URL', () => {
    expect(bookLanguageFor('es', 'en')).toBe('es');
    expect(bookLanguageFor(null, 'en')).toBe('en');
    expect(bookLanguageFor(undefined, 'pt')).toBe('pt');
  });
});
