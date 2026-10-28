import { expect, test, type Page } from '@playwright/test';

import {
  ADMIN_URL,
  expectAccessible,
  readField,
  seedDoc,
  staffAccount,
  uniqueEmail,
} from './helpers';

test.skip(({ isMobile }) => isMobile, 'El panel se opera en escritorio.');

/**
 * Admin contra los emuladores. Con emuladores no hay segundo factor (el MFA se prueba en la API:
 * un admin sin 2FA no entra; ver app.test.ts); el ingreso es con email y contraseña de prueba.
 */
async function signIn(page: Page, role: 'admin' | 'superadmin') {
  const email = uniqueEmail(role);
  const { uid, password } = await staffAccount(email, role);
  await page.goto(ADMIN_URL);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 });
  return { email, uid };
}

test('un customer no entra al panel', async ({ page }) => {
  const email = uniqueEmail('cliente');
  const { password } = await staffAccount(email, 'admin');
  // Misma cuenta pero sin rol de staff: se le saca el rol.
  await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-storynido/accounts:update',
    {
      method: 'POST',
      headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
      body: JSON.stringify({
        localId: (
          (await (
            await fetch(
              'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake',
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email, password, returnSecureToken: true }),
              },
            )
          ).json()) as { localId: string }
        ).localId,
        customAttributes: JSON.stringify({ role: 'customer' }),
      }),
    },
  );
  await page.goto(ADMIN_URL);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible({ timeout: 30_000 });
});

test('el modo del sitio cambia la web en segundos, sin redeploy', async ({ page }) => {
  await signIn(page, 'admin');
  await expectAccessible(page);
  await page.getByRole('link', { name: 'Sitio' }).click();
  await page.locator('label', { hasText: 'Solo vista previa' }).click();
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('(actual)')).toBeVisible();
  try {
    // La web revalida el modo cada 15 s.
    await expect(async () => {
      const web = await page.context().newPage();
      await web.goto('/es');
      await expect(
        web.getByRole('status').filter({ hasText: 'compras están pausadas' }),
      ).toBeVisible({
        timeout: 2_000,
      });
      await web.close();
    }).toPass({ timeout: 60_000 });
  } finally {
    await page.locator('label', { hasText: 'En vivo' }).click();
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.locator('label', { hasText: 'En vivo' })).toContainText('(actual)');
  }
});

test('reembolso desde el detalle del pedido: confirmación, motivo y auditoría', async ({
  page,
}) => {
  const orderId = `e2e-refund-${String(Date.now())}`;
  await seedDoc(`users/e2e-cliente`, {
    email: 'cliente-e2e@storynido.test',
    createdAt: new Date(),
  });
  await seedDoc(`orders/${orderId}`, {
    ownerUid: 'e2e-cliente',
    bookId: 'e2e-book',
    status: 'ready',
    channel: 'families',
    country: 'MX',
    currency: 'MXN',
    items: [{ piece: 'book', format: 'digital', quantity: 1 }],
    amounts: {
      subtotalMinor: 34900,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 4814,
      totalMinor: 34900,
    },
    payment: { provider: 'mock', checkoutSessionId: 'cs_e2e', paymentId: `pay_${orderId}` },
    costsUsdMicros: { ai: 900000, print: 0, shipping: 0 },
    pipeline: { generation: 0, failedStep: null, error: null },
    createdAt: new Date(),
  });
  await signIn(page, 'admin');
  await page.goto(`${ADMIN_URL}/order?id=${orderId}`);
  await expect(page.getByRole('heading', { name: `Pedido ${orderId}` })).toBeVisible();
  await expect(page.getByText('Costos y margen')).toBeVisible();
  page.on('dialog', (dialog) => {
    void (dialog.type() === 'prompt' ? dialog.accept('Prueba E2E de reembolso') : dialog.accept());
  });
  await page.getByRole('button', { name: 'Reembolsar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Reembolsado' })).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => readField(`orders/${orderId}`, 'status')).toBe('refunded');
  await page.getByRole('link', { name: 'Auditoría' }).click();
  await expect(page.getByText('order.refund').first()).toBeVisible({ timeout: 30_000 });
});

test('cola de revisión manual: el pedido aparece y "Aprobar páginas" lo devuelve al pipeline', async ({
  page,
}) => {
  const orderId = `e2e-qa-${String(Date.now())}`;
  await seedDoc(`orders/${orderId}`, {
    ownerUid: 'e2e-cliente',
    bookId: 'e2e-book-qa',
    status: 'qa_failed',
    channel: 'families',
    country: 'US',
    currency: 'USD',
    items: [{ piece: 'book', format: 'digital', quantity: 1 }],
    amounts: {
      subtotalMinor: 1999,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: 1999,
    },
    payment: { provider: 'mock', checkoutSessionId: 'cs_qa', paymentId: `pay_${orderId}` },
    costsUsdMicros: { ai: 0, print: 0, shipping: 0 },
    pipeline: { generation: 1, failedStep: 'quality_check', error: 'página 3 a revisión humana' },
    createdAt: new Date(),
  });
  await signIn(page, 'admin');
  await page.getByRole('link', { name: 'Revisión manual' }).click();
  await page.getByRole('link', { name: orderId }).click();
  page.on('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Aprobar páginas' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Aprobado' })).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => readField(`orders/${orderId}`, 'pipeline')).toBeTruthy();
});
