import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, uniqueEmail } from './helpers';

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();

/** Lo que manda la tarjeta «Mi primera comunión» de /eventos/tematicas a quien tiene sesión. */
async function cardHref(page: Page) {
  await page.goto('/es/eventos/tematicas');
  const card = page.locator('li', { has: page.locator('h3', { hasText: 'Mi primera comunión' }) });
  const link = card.locator('a[data-track="collection_start"]');
  // Sin sesión lleva a ingresar; con sesión (ya cargada), al creador.
  await expect(link).toHaveAttribute('href', /crear/, { timeout: 15_000 });
  return link.getAttribute('href');
}

/** `again`: Martu ya está guardada, así que se la reconoce por el nombre y se usan sus rasgos. */
async function toParty(page: Page, again = false) {
  await heading(page, '¿Quién es el protagonista de la fiesta?');
  // Ni la palabra «cumple»: en una comunión se pide la edad a secas.
  await expect(page.locator('label[for="child-age"]')).toHaveText('Edad');
  await page.locator('#child-name').fill('Martu');
  await page.locator('#child-age').selectOption('8');
  if (again) await expect(page.getByText('Ya tienes a Martu guardado')).toBeVisible();
  await next(page);
  if (!again) {
    await heading(page, 'Sube de 1 a 3 fotos');
    await page.locator('label', { hasText: 'Sin foto' }).click();
  }
  await heading(page, 'Elige cómo se ve');
  if (!again) {
    for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
      await page.locator('label', { hasText: label }).first().click();
    }
  }
  await next(page);
  await heading(page, 'La fiesta');
  await expect(page.locator('body')).toContainText('Etapa 2 de 4: Celebración');
  await expect(page.locator('#event-occasion')).toHaveValue('communion');
  await expect(
    page.locator('label', { hasText: 'Mi primera comunión' }).locator('input'),
  ).toBeChecked();
}

test('Celebraciones: la tarjeta de una ocasión abre el creador con esa ocasión', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Alcanza con escritorio.');
  test.slow();
  await page.goto('/es/crear?line=events');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('comunion'));
  // Con sesión: la tarjeta lleva al creador con la temática y la ocasión.
  const href = await cardHref(page);
  expect(href).toContain('ocasion=communion');
  await page.goto(href ?? '');
  await toParty(page);

  // Desde la ficha de la historia (la tapa de la tarjeta): solo viaja la historia, y la ocasión y
  // la temática salen de su colección.
  await page.goto('/es/historias/mi-primera-comunion?line=events');
  const create = page.locator('main a[href*="crear"]').first();
  await expect(create).toHaveAttribute('href', /story=mi-primera-comunion/, { timeout: 15_000 });
  await create.click();
  await toParty(page, true);

  // Con un borrador de cumpleaños empezado, la tarjeta igual llega con la comunión.
  await page.goto('/es/crear?line=events&tema=Campeones');
  await heading(page, '¿Quién es el protagonista de la fiesta?');
  await page.goto(href ?? '');
  await toParty(page, true);
});
