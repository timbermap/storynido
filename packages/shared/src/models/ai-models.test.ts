import { describe, expect, it } from 'vitest';

import { acceptsChildPhotos, aiModelProblems, catalogPrices, type AiModelEntry } from './ai-models';

const model = (overrides: Partial<AiModelEntry> = {}): AiModelEntry => ({
  provider: 'vertex',
  model: 'gemini-3.5-flash',
  kind: 'text',
  price: { inputPerMTok: 0.5, outputPerMTok: 3 },
  dataPolicy: {
    trainsOnData: false,
    humanReview: false,
    regions: ['global'],
    enterpriseAgreement: true,
  },
  allowedEnvironments: ['local', 'staging', 'production'],
  childPhotosAllowed: true,
  lastEval: null,
  notes: null,
  ...overrides,
});

describe('catálogo de modelos de IA', () => {
  it('un modelo que entrena con los datos o tiene revisión humana nunca va a producción', () => {
    expect(aiModelProblems(model(), 'production')).toEqual([]);
    const trains = model({
      dataPolicy: {
        trainsOnData: true,
        humanReview: false,
        regions: [],
        enterpriseAgreement: false,
      },
    });
    expect(aiModelProblems(trains, 'production').join(' ')).toMatch(
      /no se puede usar en producción/,
    );
    // Fuera de producción se puede probar (con datos sintéticos).
    expect(aiModelProblems(trains, 'staging')).toEqual([]);
    const reviewed = model({
      dataPolicy: {
        trainsOnData: false,
        humanReview: true,
        regions: [],
        enterpriseAgreement: true,
      },
    });
    expect(aiModelProblems(reviewed, 'production')).toHaveLength(1);
  });

  it('respeta los ambientes habilitados', () => {
    expect(aiModelProblems(model({ allowedEnvironments: ['local'] }), 'staging')).toEqual([
      'gemini-3.5-flash no está habilitado en staging.',
    ]);
  });

  it('fotos de chicos: solo si el modelo las admite y no entrena ni revisa con personas', () => {
    expect(acceptsChildPhotos(model())).toBe(true);
    expect(acceptsChildPhotos(model({ childPhotosAllowed: false }))).toBe(false);
    expect(
      acceptsChildPhotos(
        model({
          dataPolicy: {
            trainsOnData: true,
            humanReview: false,
            regions: [],
            enterpriseAgreement: false,
          },
        }),
      ),
    ).toBe(false);
  });

  it('precios del catálogo: los modelos sin precio o inválidos se saltean (peor caso)', () => {
    expect(
      catalogPrices([model(), model({ model: 'sin-precio', price: null }), { roto: true }]),
    ).toEqual({ 'gemini-3.5-flash': { inputPerMTok: 0.5, outputPerMTok: 3 } });
  });
});
