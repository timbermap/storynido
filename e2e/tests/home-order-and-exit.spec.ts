import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const cursor = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).cursor);

test('home: orden fijo de líneas y manito; creador: etapa sin repetir y descartar desde «Guardar y salir»', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('orden'));
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('#child-name').fill('Lu');
  await page.locator('#child-age').selectOption('6');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await heading(page, 'Sube de 1 a 3 fotos');
  // «Personaje (2 de 2)», sin «Personaje · Personaje».
  await expect(page.locator('body')).toContainText('Etapa 1 de 4: Personaje (2 de 2)');
  await expect(page.locator('body')).not.toContainText('Personaje · Personaje');

  // «Guardar y salir» abre el diálogo; descartar pide confirmación y borra el borrador.
  await page.getByRole('button', { name: 'Guardar y salir' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Salir del creador?' });
  await expect(dialog).toBeVisible();
  // En el centro de la pantalla (antes quedaba pegado al encabezado) y con «Seguir creando».
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  if (box && viewport) expect(box.y).toBeGreaterThan(viewport.height * 0.15);
  await dialog.getByRole('button', { name: 'Seguir creando' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Guardar y salir' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Descartar este cuento' }).click();
  await page.getByRole('button', { name: 'Sí, descartar' }).click();
  await expect(page).toHaveURL(/\/es\/mis-cuentos/, { timeout: 30_000 });
  await expect(page.locator('body')).not.toContainText('El cuento de Lu');

  // Home con sesión: «Crear algo nuevo» siempre Familias, Celebraciones, Profesionales.
  await page.goto('/es/crear?line=professionals');
  await page.goto('/es');
  const cards = page.locator('[data-track="home_line_click"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(
    await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-track-line'))),
  ).toEqual(['families', 'events', 'professionals']);

  // Manito en todo lo que se toca (Tailwind v4 dejaba la flecha en los botones).
  expect(await cursor(page, 'header button')).toBe('pointer');
  expect(await cursor(page, '[data-track="home_line_click"]')).toBe('pointer');
  await page.goto('/es/mis-cuentos');
  await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 30_000 });
  expect(
    await page
      .getByRole('tab')
      .first()
      .evaluate((el) => getComputedStyle(el).cursor),
  ).toBe('pointer');
});
