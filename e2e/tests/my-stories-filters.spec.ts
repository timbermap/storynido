import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();
const filters = (page: Page) => page.locator('#drafts button[aria-pressed]');
const drafts = (page: Page) => page.locator('#drafts [role="tabpanel"] > ul > li');

test('Mis cuentos: filtros solo con dos líneas en la solapa y estado vacío sin botones que compitan', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('filtros'));
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('#child-name').fill('Sebas');
  await page.locator('#child-age').selectOption('7');
  await next(page);
  await heading(page, 'Sube de 1 a 3 fotos');
  // Un segundo borrador, de Celebraciones, con el mismo personaje.
  await page.goto('/es/crear?line=events&tema=Campeones');
  await heading(page, '¿Quién es el protagonista de la fiesta?');
  await page.locator('label', { hasText: 'Sebas' }).first().click();
  await expect(page.locator('#child-name')).toHaveValue('Sebas');
  await next(page);
  await expect(page.locator('h1').first()).not.toContainText('¿Quién es el protagonista');

  // En creación: dos líneas → filtros (Todas, Familias, Celebraciones) que filtran.
  await page.goto('/es/mis-cuentos?estado=en-creacion');
  await expect(drafts(page)).toHaveCount(2, { timeout: 30_000 });
  await expect(filters(page)).toHaveText(['Todas', 'Familias', 'Celebraciones']);
  await page.getByRole('button', { name: 'Celebraciones', pressed: false }).click();
  await expect(drafts(page)).toHaveCount(1);

  // Una solapa vacía no muestra filtros.
  await page.getByRole('tab', { name: /Terminados/ }).click();
  await expect(filters(page)).toHaveCount(0);

  // Sin borradores: el texto solo; la acción la dan las «Ideas para Sebas» de abajo.
  await page.getByRole('tab', { name: /En creación/ }).click();
  await page.getByRole('button', { name: 'Todas' }).click();
  for (let i = 0; i < 2; i += 1) {
    await drafts(page)
      .first()
      .getByRole('button', { name: /^Borrar/ })
      .click();
    await page.getByRole('button', { name: 'Sí, borrar' }).click();
    await expect(drafts(page)).toHaveCount(1 - i);
  }
  await expect(page.locator('#drafts')).toContainText('No tienes cuentos en creación.');
  await expect(page.getByRole('button', { name: 'Crear otro cuento con Sebas' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ideas para Sebas' })).toBeVisible();
});
