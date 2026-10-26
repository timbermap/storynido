/**
 * Suites de contrato: toda implementación (simulada o real) de un proveedor
 * tiene que pasarlas. Las reales se corren con credenciales de prueba.
 */
import {
  ProviderError,
  type AIImageProvider,
  type AITextProvider,
  type EmailProvider,
  type PaymentProvider,
  type PrintAddress,
  type PrintProvider,
  type StorageService,
  type StoryRequest,
  type WebhookInput,
} from '@storynido/shared';
import { describe, expect, it } from 'vitest';

export const sampleStoryRequest: StoryRequest = {
  language: 'es',
  childName: 'Martina',
  age: 5,
  pronouns: 'she',
  likes: ['dinosaurios', 'el espacio'],
  petName: 'Rocco',
  bestFriendName: 'Tomi',
  dedication: 'Para Martina, con amor',
  storyTitle: 'La gran aventura espacial',
  promptTemplate: 'Escribí un cuento para {{childName}} de {{age}} años sobre {{likes}}.',
  pageCount: 4,
};

export const sampleAddress: PrintAddress = {
  name: 'Ana Pérez',
  line1: 'Av. Reforma 123',
  line2: null,
  city: 'Ciudad de México',
  state: 'CDMX',
  postalCode: '06600',
  country: 'MX',
  phone: null,
};

export function describeAITextContract(name: string, create: () => AITextProvider) {
  describe(`AITextProvider: ${name}`, () => {
    const provider = create();

    it('genera la cantidad de páginas pedida, en orden y con texto', async () => {
      const story = await provider.generateStory(sampleStoryRequest);
      expect(story.pages).toHaveLength(sampleStoryRequest.pageCount);
      story.pages.forEach((page, index) => {
        expect(page.index).toBe(index);
        expect(page.text.trim().length).toBeGreaterThan(0);
        expect(page.illustrationPrompt.trim().length).toBeGreaterThan(0);
      });
      expect(story.usage.provider).toBe(provider.id);
      expect(story.usage.costUsdMicros).toBeGreaterThanOrEqual(0);
    });

    it('la revisión conserva las páginas', async () => {
      const story = await provider.generateStory(sampleStoryRequest);
      const review = await provider.reviewStory(story, sampleStoryRequest);
      expect(review.pages).toHaveLength(story.pages.length);
      expect(typeof review.approved).toBe('boolean');
    });

    it('permite texto apto para chicos', async () => {
      const result = await provider.moderateText('Martina juega con su perro en el parque.');
      expect(result.allowed).toBe(true);
    });
  });
}

export function describeAIImageContract(name: string, create: () => AIImageProvider) {
  describe(`AIImageProvider: ${name}`, () => {
    const provider = create();

    it('genera una imagen con bytes y tipo de imagen', async () => {
      const image = await provider.generateIllustration({
        prompt: 'Una nena de 5 años mirando las estrellas',
        stylePrompt: 'acuarela suave',
        character: { description: 'pelo castaño con rulos, ojos marrones', photo: null },
        aspectRatio: '1:1',
        seed: 42,
      });
      expect(image.bytes.byteLength).toBeGreaterThan(0);
      expect(image.mimeType).toMatch(/^image\//);
      expect(image.usage.provider).toBe(provider.id);
      expect((await provider.moderateImage(image)).allowed).toBe(true);
    });
  });
}

export function describePaymentContract(
  name: string,
  create: () => PaymentProvider,
  signWebhook: (payload: {
    id: string;
    type: string;
    data: Record<string, unknown>;
  }) => WebhookInput,
) {
  describe(`PaymentProvider: ${name}`, () => {
    const provider = create();
    const request = {
      orderId: `order-${name}`,
      customerEmail: 'ana@example.com',
      currency: 'MXN' as const,
      locale: 'es' as const,
      lineItems: [{ name: 'Libro tapa dura', amountMinor: 99900, quantity: 1 }],
      successUrl: 'https://storynido.test/checkout/success',
      cancelUrl: 'https://storynido.test/checkout/cancel',
    };

    it('crea un checkout con URL y vencimiento futuro', async () => {
      const session = await provider.createCheckout(request);
      expect(session.id).not.toHaveLength(0);
      expect(() => new URL(session.url)).not.toThrow();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('rechaza webhooks con firma inválida', () => {
      const input = signWebhook({ id: 'evt_1', type: 'checkout.completed', data: {} });
      expect(() => provider.parseWebhook({ ...input, rawBody: `${input.rawBody} ` })).toThrow(
        ProviderError,
      );
    });

    it('traduce un pago completado', () => {
      const event = provider.parseWebhook(
        signWebhook({
          id: 'evt_2',
          type: 'checkout.completed',
          data: {
            orderId: request.orderId,
            sessionId: 'cs_1',
            paymentId: 'pi_1',
            amountMinor: 99900,
            currency: 'MXN',
          },
        }),
      );
      expect(event).toMatchObject({
        type: 'checkout.completed',
        orderId: request.orderId,
        amountMinor: 99900,
      });
    });

    it('reembolsa', async () => {
      const refund = await provider.refund({
        paymentId: 'pi_1',
        amountMinor: null,
        reason: 'test',
        idempotencyKey: 'r1',
      });
      expect(refund.refundId).not.toHaveLength(0);
    });
  });
}

export function describePrintContract(
  name: string,
  create: () => PrintProvider,
  signWebhook: (payload: {
    id: string;
    type: string;
    data: Record<string, unknown>;
  }) => WebhookInput,
) {
  describe(`PrintProvider: ${name}`, () => {
    const provider = create();
    const items = [{ format: 'hardcover' as const, pageCount: 24, quantity: 1 }];

    it('cotiza envío y producción', async () => {
      const quote = await provider.quote(items, sampleAddress, 'MXN');
      expect(quote.currency).toBe('MXN');
      expect(quote.shippingMinor).toBeGreaterThanOrEqual(0);
      expect(quote.etaDaysMax).toBeGreaterThanOrEqual(quote.etaDaysMin);
    });

    it('crea un pedido y lo puede cancelar antes del despacho', async () => {
      const order = await provider.createOrder({
        orderId: `order-${name}`,
        items: items.map((item) => ({
          ...item,
          interiorPdfUrl: 'https://storynido.test/interior.pdf',
          coverPdfUrl: 'https://storynido.test/cover.pdf',
        })),
        address: sampleAddress,
        email: 'ana@example.com',
        currency: 'MXN',
      });
      expect(order.externalOrderId).not.toHaveLength(0);
      expect((await provider.cancelOrder(order.externalOrderId)).cancelled).toBe(true);
    });

    it('rechaza webhooks con firma inválida y traduce estados', () => {
      const input = signWebhook({
        id: 'evt_p1',
        type: 'order.status',
        data: {
          orderId: 'o1',
          externalOrderId: 'x1',
          status: 'shipped',
          trackingNumber: 'T1',
          trackingUrl: null,
        },
      });
      expect(() => provider.parseWebhook({ ...input, rawBody: `${input.rawBody} ` })).toThrow(
        ProviderError,
      );
      expect(provider.parseWebhook(input)).toMatchObject({
        type: 'status',
        status: 'shipped',
        trackingNumber: 'T1',
      });
    });
  });
}

export function describeEmailContract(name: string, create: () => EmailProvider) {
  describe(`EmailProvider: ${name}`, () => {
    const provider = create();
    const message = {
      to: 'ana@example.com',
      template: 'payment_confirmed' as const,
      locale: 'es' as const,
      data: { orderId: 'o1' },
      idempotencyKey: `o1:payment_confirmed:${name}`,
    };

    it('envía y devuelve un ID', async () => {
      expect((await provider.send(message)).messageId).not.toHaveLength(0);
    });

    it('no duplica envíos con la misma clave de idempotencia', async () => {
      const first = await provider.send(message);
      const second = await provider.send(message);
      expect(second.messageId).toBe(first.messageId);
    });
  });
}

export function describeStorageContract(name: string, create: () => StorageService) {
  describe(`StorageService: ${name}`, () => {
    const storage = create();
    const ref = { bucket: 'assets' as const, path: `contract/${name}/${Date.now()}.txt` };

    it('sube, lee, detecta y borra', async () => {
      await storage.upload(ref, new TextEncoder().encode('hola'), 'text/plain');
      expect(await storage.exists(ref)).toBe(true);
      expect(new TextDecoder().decode(await storage.download(ref))).toBe('hola');
      await storage.delete(ref);
      expect(await storage.exists(ref)).toBe(false);
    });

    it('emite URLs firmadas que vencen en el futuro', async () => {
      const upload = await storage.signedUploadUrl(ref, 'image/jpeg', 300);
      const download = await storage.signedDownloadUrl(ref, 300);
      for (const signed of [upload, download]) {
        expect(() => new URL(signed.url)).not.toThrow();
        expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
      }
      expect(upload.headers['content-type']).toBe('image/jpeg');
    });

    it('rechaza rutas peligrosas', async () => {
      await expect(
        storage.upload(
          { bucket: 'assets', path: '../fuera.txt' },
          new Uint8Array([1]),
          'text/plain',
        ),
      ).rejects.toThrow();
    });
  });
}
