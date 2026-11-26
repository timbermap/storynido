import { describe, expect, it } from 'vitest';

import type { AITextProvider, AiUsage, ImageData } from './ai';
import {
  hasJudgePanel,
  JUDGE_GATE_CODE,
  judgeGate,
  judgeGateMessage,
  judgePanelSchema,
  runPanel,
  storedPanel,
} from './judge-panel';

const usage: AiUsage = { provider: 'test', model: 'm', costUsdMicros: 1000 };
const image: ImageData = { bytes: new Uint8Array([1]), mimeType: 'image/webp' };

const buyer = {
  buy: 4,
  gift: 4,
  verdict: 'compra' as const,
  loved: ['la tapa'],
  refund: [],
  fixes: [{ area: 'armado' as const, fix: 'más aire en la página 2' }],
  sample: 4,
  sampleObjection: '',
  share: 5,
  sharePage: 0,
  shareWhy: 'la tapa con el perro',
};

function fakeText(overrides: Partial<AITextProvider> = {}): AITextProvider {
  return {
    reviewAsBuyer: () => Promise.resolve({ ...buyer, usage }),
    reviewAsChildListener: () =>
      Promise.resolve({
        score: 2,
        understood: 2,
        wantsMore: 3,
        hardWords: ['vulnerable'],
        lostPages: [3],
        favorite: 'ninguno',
        fixes: [{ area: 'texto' as const, fix: 'palabras de 4 años' }],
        usage,
      }),
    reviewContinuity: () =>
      Promise.resolve({
        score: 3,
        issues: [{ page: 2, who: 'la mamá', what: 'cambia de pelo' }],
        fixes: [{ area: 'dibujo' as const, fix: 'misma mamá en todas' }],
        usage,
      }),
    reviewAsProfessional: () =>
      Promise.resolve({
        score: 5,
        meetsGoal: 5,
        wouldUse: true,
        risks: [],
        fixes: [],
        usage,
      }),
    ...overrides,
  } as unknown as AITextProvider;
}

const input = {
  channel: 'families' as const,
  priceUsd: 15,
  order: 'Libro de prueba',
  title: 'El faro',
  texts: ['Uno.', 'Dos.', 'Tres.'],
  age: 4,
  language: 'es',
  style: 'acuarela',
  cover: image,
  composed: [image, image, image],
  drawn: [image, image, image],
  reference: image,
};

describe('mesa de jueces', () => {
  it('la nota de la mesa es la del juez más bajo y sus arreglos van primero', async () => {
    let spent = 0;
    const panel = await runPanel(fakeText(), input, (item) => {
      spent += item.costUsdMicros;
    });
    expect(panel.score).toBe(2);
    expect(panel.weakest).toBe('chico');
    expect(panel.fixes.map((fix) => fix.judge)).toEqual(['chico', 'continuidad', 'comprador']);
    expect(panel.professional).toBeUndefined();
    expect(spent).toBe(3000);
  });

  it('el profesional solo juzga la línea Profesionales; sin lámina no hay continuidad', async () => {
    const panel = await runPanel(
      fakeText(),
      { ...input, channel: 'professionals', reference: null },
      () => undefined,
    );
    expect(panel.professional?.score).toBe(5);
    expect(panel.continuity).toBeUndefined();
  });

  it('un juez que falla queda anotado y la mesa sigue con los demás', async () => {
    const panel = await runPanel(
      fakeText({ reviewContinuity: () => Promise.reject(new Error('timeout')) }),
      input,
      () => undefined,
    );
    expect(panel.errors).toEqual(['continuidad: timeout']);
    expect(panel.score).toBe(2);
  });

  it('la IA simulada no tiene mesa', () => {
    expect(hasJudgePanel({} as AITextProvider)).toBe(false);
    expect(hasJudgePanel(fakeText())).toBe(true);
  });

  it('lo que se guarda en el pedido pasa el esquema del admin', async () => {
    const panel = await runPanel(fakeText(), input, () => undefined);
    const stored = storedPanel(panel, 3000, new Date('2026-11-26T12:00:00Z'));
    expect(judgePanelSchema.parse(stored)).toEqual(stored);
    expect(stored.buyer).not.toHaveProperty('fixes');
    expect(stored.professional).toBeNull();
  });
});

describe('judgeGate (DECISIONS 350)', () => {
  const base = { score: 4, weakest: 'chico', buyer: null, professional: null };

  it('deja pasar un 4 con el comprador que compra', () => {
    expect(judgeGate({ ...base, buyer: { ...buyer, verdict: 'compra' } })).toEqual({
      pass: true,
      reasons: [],
    });
  });

  it('frena por nota baja, comprador que no compra o profesional que no lo usaría', () => {
    expect(judgeGate({ ...base, score: 3 }).reasons).toEqual(['mesa 3/5 (la baja chico)']);
    expect(judgeGate({ ...base, buyer: { ...buyer, verdict: 'no' } }).pass).toBe(false);
    expect(
      judgeGate({
        ...base,
        professional: { score: 4, meetsGoal: 4, wouldUse: false, risks: [] },
      }).reasons,
    ).toEqual(['el profesional no lo usaría así']);
  });

  it('sin mesa no frena (un juez caído no deja a la familia sin libro)', () => {
    expect(judgeGate(null).pass).toBe(true);
    expect(judgeGate({ ...base, score: null }).pass).toBe(true);
  });

  it('el mensaje empieza con el código y entra en 500 caracteres', () => {
    const message = judgeGateMessage(['mesa 2/5'], [{ area: 'dibujo', fix: 'x'.repeat(600) }]);
    expect(message.startsWith(`${JUDGE_GATE_CODE}: `)).toBe(true);
    expect(message.length).toBe(500);
  });
});
