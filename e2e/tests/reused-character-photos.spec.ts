import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, testPhoto, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();
const reusedBlock = (page: Page) =>
  page.locator('fieldset', { hasText: 'Fotos de Martina de su último cuento' });

/** Un cuento nuevo con el personaje guardado «Martina» hasta el paso de fotos. */
async function newStoryWithMartina(page: Page) {
  await page.goto('/es/crear?line=families&story=aventura-espacial');
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('label', { hasText: 'Martina' }).first().click();
  await expect(page.locator('#child-name')).toHaveValue('Martina');
  await next(page);
  await heading(page, 'Sube de 1 a 3 fotos');
}

test('un personaje reutilizado ofrece sus fotos del último cuento o elegir otras', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('reuso'));

  // Primer cuento: Martina con una foto.
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('#child-name').fill('Martina');
  await page.locator('#child-age').selectOption('5');
  await next(page);
  await heading(page, 'Sube de 1 a 3 fotos');
  await page.locator('input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Acepto y quiero subir fotos' }).click();
  await page.locator('#photo-input').setInputFiles(testPhoto());
  await expect(page.locator('li', { hasText: 'Lista' })).toHaveCount(1, { timeout: 60_000 });
  await next(page);
  await heading(page, 'Elige la aventura');

  // Segundo cuento: sus fotos aparecen y se usan sin subir nada.
  await newStoryWithMartina(page);
  await expect(reusedBlock(page)).toBeVisible();
  await expect(reusedBlock(page).locator('img')).toHaveCount(1);
  await expect(page.getByRole('radio', { name: 'Usar estas fotos' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Elegir fotos' })).toHaveCount(0);
  await next(page);
  await heading(page, 'Elige la aventura');

  // Tercer cuento: «Elegir otras» las saca de este cuento y se sube una nueva (no se suman).
  await newStoryWithMartina(page);
  await page.getByRole('radio', { name: 'Elegir otras' }).check();
  await expect(reusedBlock(page)).toHaveCount(0);
  await page.locator('#photo-input').setInputFiles(testPhoto());
  await expect(page.locator('li', { hasText: 'Lista' })).toHaveCount(1, { timeout: 60_000 });
  await next(page);
  await heading(page, 'Elige la aventura');
});
