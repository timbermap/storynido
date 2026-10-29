import { expect, test } from '@playwright/test';

import { expectAccessible, signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

test('crear pide cuenta y el borrador se puede borrar desde Mis cuentos', async ({ page }) => {
  await page.goto('/es/crear?line=events');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('borrador'));
  await expect(page.locator('h1').first()).toContainText('Cuéntanos sobre el protagonista', {
    timeout: 30_000,
  });
  await page.locator('#child-name').fill('Tomi');
  await page.locator('#child-age').selectOption('6');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.locator('h1').first()).not.toContainText('Cuéntanos sobre el protagonista');

  await page.goto('/es/mis-cuentos');
  const draft = page.locator('#drafts li', { hasText: 'El cuento de Tomi' });
  await expect(draft).toBeVisible({ timeout: 30_000 });
  await draft.getByRole('button', { name: 'Borrar El cuento de Tomi' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('body')).not.toContainText('El cuento de Tomi');
  // Recargando sigue borrado.
  await page.reload();
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('El cuento de Tomi');
});

test('si Firestore no responde, el creador avisa y deja reintentar (no queda cargando)', async ({
  page,
}) => {
  await page.goto('/es/crear');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('sin-red'));
  await expect(page.locator('h1').first()).toContainText('Cuéntanos sobre el protagonista', {
    timeout: 30_000,
  });
  // Sin Firestore (red cortada o bloqueada), entrar de nuevo al creador.
  await page.route('**/google.firestore.v1.Firestore/**', (route) => route.abort());
  await page.goto('/es/crear');
  await expect(
    page.getByRole('alert').filter({ hasText: 'No pudimos preparar tu cuento' }),
  ).toBeVisible({ timeout: 40_000 });
  await page.unroute('**/google.firestore.v1.Firestore/**');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('h1').first()).toContainText('Cuéntanos sobre el protagonista', {
    timeout: 30_000,
  });
});
