import { describe, expect, it } from 'vitest';

import { PUBLIC_BRAND_DOMAIN, calmSideOf, isContactIssue, typographyOf } from './generation';

const scene = (pageIndex: number) => ({
  pageIndex,
  sceneGoal: '',
  emotionalBeat: '',
  mustBeVisible: [],
  notVisible: [],
  continuityFacts: [],
  wordBudget: 40,
  personalDetail: null,
});

describe('lado calmo para el texto', () => {
  it('es el mismo que pide el prompt: arriba en impares, abajo en pares', () => {
    expect(calmSideOf(scene(1))).toBe('top');
    expect(calmSideOf(scene(2))).toBe('bottom');
    expect(calmSideOf(null)).toBeNull();
  });
});

describe('QR de la contratapa', () => {
  it('apunta siempre al dominio público, también desde staging', () => {
    expect(PUBLIC_BRAND_DOMAIN).toBe('storynido.com');
  });
});

describe('letra por edad del libro congelado', () => {
  it('los libros anteriores a las franjas se arman como siempre (sin letra por edad)', () => {
    expect(typographyOf({ language: 'es' })).toBeNull();
    expect(typographyOf({ language: 'es', ageBand: '3-4', textBand: '3-4' })).toMatchObject({
      font: 'quicksand',
      uppercase: true,
    });
    expect(typographyOf({ language: 'en', ageBand: '3-4', textBand: '3-4' })?.uppercase).toBe(
      false,
    );
  });
});

describe('contacto físico en la revisión de una página', () => {
  const review = (issue: string) =>
    ({ criticalIssues: [issue] }) as unknown as Parameters<typeof isContactIssue>[0];
  it('se reconoce para repararlo en vez de mandarlo a revisión manual', () => {
    expect(
      isContactIssue(
        review(
          "The friend Sofía has her hand resting on Luli's arm, which violates the restriction",
        ),
      ),
    ).toBe(true);
    expect(isContactIssue(review('Two children hugging at the door'))).toBe(true);
    expect(isContactIssue(review('Readable text on the blackboard'))).toBe(false);
    expect(isContactIssue(null)).toBe(false);
  });
});
