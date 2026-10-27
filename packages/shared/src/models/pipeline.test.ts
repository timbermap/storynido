import { describe, expect, it } from 'vitest';

import {
  PIPELINE_STEPS,
  STEP_POLICIES,
  pipelineEventSchema,
  retryDelayMs,
  stepIdempotencyKey,
  stepsFrom,
} from './pipeline';

describe('pipeline', () => {
  it('tiene los 6 pasos en orden y una política para cada uno', () => {
    expect(PIPELINE_STEPS[0]).toBe('prepare_photo');
    expect(PIPELINE_STEPS.at(-1)).toBe('deliver');
    expect(Object.keys(STEP_POLICIES).sort()).toEqual([...PIPELINE_STEPS].sort());
  });

  it('los reintentos esperan cada vez más, con tope', () => {
    expect([1, 2, 3, 4].map((attempt) => retryDelayMs(attempt))).toEqual([2000, 4000, 8000, 16000]);
    expect(retryDelayMs(20)).toBe(60_000);
  });

  it('reintentar desde un paso incluye los siguientes', () => {
    expect(stepsFrom('quality_check')).toEqual(['quality_check', 'layout_pdf', 'deliver']);
  });

  it('la clave idempotente cambia con la generación, no con el intento', () => {
    expect(stepIdempotencyKey('o1', 0, 'deliver')).toBe('o1:g0:deliver');
    expect(stepIdempotencyKey('o1', 1, 'deliver')).not.toBe(stepIdempotencyKey('o1', 0, 'deliver'));
  });

  it('valida los eventos del pipeline', () => {
    expect(
      pipelineEventSchema.safeParse({ type: 'order.paid', orderId: 'o1', requestId: 'paid:o1' })
        .success,
    ).toBe(true);
    expect(
      pipelineEventSchema.safeParse({ type: 'order.shipped', orderId: 'o1', requestId: 'x' })
        .success,
    ).toBe(false);
  });
});
