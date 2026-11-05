import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, uniqueEmail } from './helpers';

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();
const chip = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Filtrar las aventuras' }).getByRole('button', { name });

test('Elige la aventura: por defecto las de su edad, un tema a la vez y la elegida siempre primera', async ({
  page,
  isMobile,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('filtros'));

  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('#child-name').fill('Nina');
  await page.locator('#child-age').selectOption('5');
  await next(page);
  await page.locator('label', { hasText: 'Sin foto' }).click();
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await next(page);
  await heading(page, 'Elige la aventura');

  const cards = page.locator('input[name="story"]');
  await expect(chip(page, /Para Nina \(5 años\)/)).toHaveAttribute('aria-pressed', 'true');
  const forAge = await cards.count();
  await chip(page, /Todas las edades/).click();
  expect(await cards.count()).toBeGreaterThanOrEqual(forAge);

  // Un tema: solo esas historias (con el contador del chip).
  const sports = chip(page, /Deportes/);
  const count = Number((await sports.textContent())?.match(/(\d+)\s*$/)?.[1]);
  await sports.click();
  await expect(sports).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(count);
  await expect(page.locator('label', { hasText: 'campeón' }).first()).toBeVisible();

  // La elegida queda visible y primera aunque otro tema la excluya.
  await page.locator('label', { hasText: 'campeón' }).first().click();
  await chip(page, /Fantasía y magia/).click();
  await expect(cards.first()).toBeChecked();

  // Tocar el tema activo lo quita.
  await chip(page, /Fantasía y magia/).click();
  await expect(chip(page, /Fantasía y magia/)).toHaveAttribute('aria-pressed', 'false');

  if (isMobile) {
    // En el móvil, la fila de chips se desplaza de costado: la página no.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );
  }
});
