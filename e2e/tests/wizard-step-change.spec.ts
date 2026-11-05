import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, uniqueEmail } from './helpers';

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });

/** El paso nuevo aparece arriba al instante (sin el viaje del scroll) y con el foco en el título. */
async function expectAtTopWithFocus(page: Page) {
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('h1').first()).toBeFocused();
}

test('cambiar de paso en el creador: arriba al instante, foco en el título, también al volver', async ({
  page,
}) => {
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('pasos'));

  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('#child-name').fill('Mora');
  await page.getByRole('button', { name: 'Siguiente' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await heading(page, 'Sube de 1 a 3 fotos');
  await expectAtTopWithFocus(page);

  await page.getByRole('button', { name: 'Atrás' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await heading(page, 'Cuéntanos sobre el protagonista');
  await expectAtTopWithFocus(page);

  // Las anclas de la landing siguen con el desplazamiento suave.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    'smooth',
  );
});
