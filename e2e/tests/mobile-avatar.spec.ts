import { expect, test, type Page } from '@playwright/test';

import { expectAccessible, expectNoHorizontalScroll, signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'Recorrido pensado para el teléfono (390 px).');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();

test('móvil, sin foto: rasgos elegidos, libro para colorear Mini y muestra a 390 px', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('movil'));
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('#child-name').fill('Mía');
  await page.locator('#child-age').selectOption('7');
  await next(page);

  await heading(page, 'Sube de 1 a 3 fotos');
  await page.locator('label', { hasText: 'Sin foto' }).click();
  await heading(page, 'Elige cómo se ve');
  await next(page);
  await expect(page.locator('body')).toContainText('Elige todos los rasgos para continuar.');
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  // Escenario 2 del informe: los anteojos se eligen y se mantienen en la lámina.
  await page.locator('label', { hasText: 'Usa anteojos' }).locator('input').check();
  await expectAccessible(page);
  await next(page);

  await heading(page, 'Elige la aventura');
  await page.locator('label', { hasText: 'El valle de los dinosaurios' }).click();
  await page.locator('label', { hasText: 'Para colorear' }).click();
  await page.locator('label', { hasText: 'Mini' }).click();
  await next(page);
  await heading(page, 'Hazlo realmente suyo');
  await page.getByRole('button', { name: 'Saltar este paso' }).click();
  await heading(page, '¿Qué quieres que aprenda?');
  await next(page);
  await heading(page, 'Elige el estilo de ilustración');
  // Para colorear solo ofrece el estilo de contornos (y viene elegido).
  await expect(page.locator('input[name=style]')).toHaveCount(1);
  await next(page);
  await heading(page, '¡Todo listo para la vista previa!');
  const summary = page.locator('dl').first();
  // Escenario 6: "Mía" conserva la tilde.
  for (const expected of [
    'Mía',
    'Sin foto (rasgos elegidos)',
    'Mini · 12 páginas · Para colorear',
  ]) {
    await expect(summary).toContainText(expected);
  }
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Crear la vista previa gratis' }).click();
  await expect(page.locator('body')).toContainText('Así vamos a dibujar a Mía', {
    timeout: 120_000,
  });
  const traits = page.locator('section[aria-labelledby=character-review] ul');
  for (const expected of ['Morena', 'Rizado', 'Verdes', 'Usa anteojos']) {
    await expect(traits).toContainText(expected);
  }
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});
