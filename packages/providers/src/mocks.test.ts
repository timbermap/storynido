import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  LocalStorageService,
  MOCK_UNSAFE_MARKER,
  MockAIImageProvider,
  MockAITextProvider,
  MockEmailProvider,
  MockPaymentProvider,
  MockPrintProvider,
  mockPrintWebhookSequence,
  signMockPaymentWebhook,
  signMockPrintWebhook,
} from './index';
import {
  describeAIImageContract,
  describeAITextContract,
  describeEmailContract,
  describePaymentContract,
  describePrintContract,
  describeStorageContract,
  sampleStoryRequest,
} from './testing';

const SECRET = 'test-secret';
const storageRoot = mkdtempSync(path.join(tmpdir(), 'storynido-storage-'));
const newStorage = (now?: () => number) =>
  new LocalStorageService({
    rootDir: storageRoot,
    publicBaseUrl: 'http://localhost:8080',
    secret: SECRET,
    now,
  });

describeAITextContract('mock', () => new MockAITextProvider());
describeAIImageContract('mock', () => new MockAIImageProvider());
describePaymentContract(
  'mock',
  () => new MockPaymentProvider(SECRET),
  (payload) => signMockPaymentWebhook(SECRET, payload),
);
describePrintContract(
  'mock',
  () => new MockPrintProvider(SECRET),
  (payload) => signMockPrintWebhook(SECRET, payload as never),
);
describeEmailContract('mock', () => new MockEmailProvider());
describeStorageContract('local', () => newStorage());

describe('mocks: comportamiento específico', () => {
  it('la IA simulada es determinista y respeta el idioma', async () => {
    const ai = new MockAITextProvider();
    const a = await ai.generateStory(sampleStoryRequest);
    const b = await ai.generateStory(sampleStoryRequest);
    expect(a).toEqual(b);
    const en = await ai.generateStory({ ...sampleStoryRequest, language: 'en' });
    expect(en.pages[0]?.text).toMatch(/^Page 1/);
  });

  it('la moderación simulada rechaza el marcador inseguro (para probar QA)', async () => {
    expect(
      (await new MockAITextProvider().moderateText(`hola ${MOCK_UNSAFE_MARKER}`)).allowed,
    ).toBe(false);
    const image = await new MockAIImageProvider().generateIllustration({
      prompt: MOCK_UNSAFE_MARKER,
      stylePrompt: '',
      character: { description: '', photo: null },
      references: [],
      aspectRatio: '1:1',
      seed: null,
    });
    expect((await new MockAIImageProvider().moderateImage(image)).allowed).toBe(false);
  });

  it('el checkout simulado es idempotente por pedido', async () => {
    const payments = new MockPaymentProvider(SECRET);
    const request = {
      orderId: 'o-1',
      customerEmail: null,
      currency: 'USD' as const,
      locale: 'en' as const,
      lineItems: [{ name: 'Book', amountMinor: 4999, quantity: 1 }],
      successUrl: 'http://localhost:3000/ok',
      cancelUrl: 'http://localhost:3000/cancel',
    };
    expect((await payments.createCheckout(request)).id).toBe(
      (await payments.createCheckout(request)).id,
    );
  });

  it('la imprenta simulada emite la secuencia completa y no cancela lo despachado', async () => {
    const printer = new MockPrintProvider(SECRET);
    const events = mockPrintWebhookSequence('o-1', 'mock_po_abc12345').map((payload) =>
      printer.parseWebhook(signMockPrintWebhook(SECRET, payload)),
    );
    expect(events.map((e) => (e.type === 'status' ? e.status : e.type))).toEqual([
      'in_production',
      'shipped',
      'delivered',
    ]);
    expect((await printer.cancelOrder('mock_po_abc12345')).cancelled).toBe(false);
  });

  it('las URLs firmadas locales se validan y vencen', async () => {
    let now = Date.now();
    const storage = newStorage(() => now);
    const ref = { bucket: 'photos' as const, path: 'u1/foto.jpg' };
    const params = Object.fromEntries(
      new URL((await storage.signedUploadUrl(ref, 'image/jpeg', 60)).url).searchParams,
    );
    const request = {
      op: 'put' as const,
      bucket: 'photos',
      path: 'u1/foto.jpg',
      exp: Number(params.exp),
      ct: params.ct ?? '',
      sig: params.sig ?? '',
    };

    expect(storage.verifySignedRequest(request)).toEqual(ref);
    expect(storage.verifySignedRequest({ ...request, path: 'u2/otra.jpg' })).toBeNull();
    expect(storage.verifySignedRequest({ ...request, op: 'get' })).toBeNull();
    now += 61_000;
    expect(storage.verifySignedRequest(request)).toBeNull();
  });
});
