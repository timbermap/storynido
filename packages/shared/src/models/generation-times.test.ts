import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GENERATION_TIMES,
  MAX_SAMPLES,
  addSample,
  bookProgress,
  generationTimesFrom,
  remainingMinutes,
  summarizeSamples,
  timeProgress,
  type BookStepState,
} from './generation-times';

describe('registro de tiempos de generación', () => {
  it('guarda segundos con un decimal, descarta lo absurdo y conserva las últimas', () => {
    expect(addSample([], 61_234)).toEqual([61.2]);
    expect(addSample([10], 200)).toEqual([10]);
    expect(addSample([10], 5 * 60 * 60 * 1000)).toEqual([10]);
    const full = Array.from({ length: MAX_SAMPLES }, (_, index) => index + 1);
    const next = addSample(full, 99_000);
    expect(next).toHaveLength(MAX_SAMPLES);
    expect(next.at(-1)).toBe(99);
    expect(next[0]).toBe(2);
  });

  it('con pocas muestras usa el valor de partida; con más, mediana y percentil 80', () => {
    expect(summarizeSamples('preview', [50, 60])).toEqual({
      ...DEFAULT_GENERATION_TIMES.preview,
      samples: 2,
    });
    expect(summarizeSamples('preview', [100, 90, 300, 110, 95])).toEqual({
      typicalSeconds: 100,
      slowSeconds: 148,
      samples: 5,
    });
  });

  it('arma todos los tipos, con los que faltan por defecto', () => {
    const times = generationTimesFrom([{ kind: 'illustrate', samples: [40, 42, 44] }]);
    expect(times.illustrate.typicalSeconds).toBe(42);
    expect(times.book).toEqual(DEFAULT_GENERATION_TIMES.book);
  });
});

describe('barra y tiempo que falta', () => {
  it('llega al 90 % en el tiempo típico y nunca al 100 %', () => {
    expect(timeProgress(0, 100)).toBe(0);
    expect(timeProgress(50_000, 100)).toBeCloseTo(0.45);
    expect(timeProgress(100_000, 100)).toBeCloseTo(0.9);
    expect(timeProgress(1_000_000, 100)).toBeLessThan(0.99);
    expect(timeProgress(200_000, 100)).toBeGreaterThan(timeProgress(150_000, 100));
  });

  it('redondea a minutos y deja de contar pasado el típico', () => {
    expect(remainingMinutes(0, 110)).toBe(2);
    expect(remainingMinutes(100_000, 110)).toBe(1);
    expect(remainingMinutes(120_000, 110)).toBeNull();
  });
});

describe('avance del libro completo', () => {
  const now = new Date('2026-11-18T12:00:00Z');
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
  const step = (
    name: BookStepState['name'],
    status: BookStepState['status'],
    startedAt: Date | null = null,
  ): BookStepState => ({ name, status, startedAt });

  it('cuenta los pasos hechos y las páginas pintadas', () => {
    const progress = bookProgress({
      steps: [
        step('prepare_photo', 'succeeded'),
        step('generate_story', 'succeeded'),
        step('generate_illustrations', 'running', ago(60)),
      ],
      pages: { done: 8, total: 16 },
      times: DEFAULT_GENERATION_TIMES,
      startedAt: ago(200),
      now,
    });
    expect(progress.stage).toBe('illustrations');
    expect(progress.pagesDone).toBe(8);
    expect(progress.pagesTotal).toBe(16);
    // 15 + 90 + 420/2 de 895 s.
    expect(progress.fraction).toBeCloseTo(315 / 895, 2);
    expect(progress.remainingSeconds).toBe(210 + 300 + 60 + 10);
    expect(progress.late).toBe(false);
  });

  it('recién pagado arranca en cero y avisa si ya tarda más de lo normal', () => {
    const start = bookProgress({
      steps: [],
      pages: null,
      times: DEFAULT_GENERATION_TIMES,
      startedAt: null,
      now,
    });
    expect(start.fraction).toBe(0);
    expect(start.stage).toBe('story');
    const late = bookProgress({
      steps: [step('quality_check', 'running', ago(10))],
      pages: null,
      times: DEFAULT_GENERATION_TIMES,
      startedAt: ago(3000),
      now,
    });
    expect(late.late).toBe(true);
    expect(late.fraction).toBeLessThan(1);
  });
});
