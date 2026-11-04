import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, testPhoto, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();

async function charactersTab(page: Page) {
  await page.goto('/es/mis-cuentos');
  await page.getByRole('tab', { name: /Personajes/ }).click();
}

test('crear otro cuento con un personaje: se elige qué crear y su dibujo se puede actualizar', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('elegir'));

  // Un primer cuento con Martina y una foto.
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

  // «Crear otro cuento con Martina» ya no va directo a Familias: se elige qué crear.
  await charactersTab(page);
  await page.getByRole('button', { name: 'Crear otro cuento con Martina' }).click();
  await expect(page).toHaveURL(/\/es\/nuevo\?personaje=/);
  await heading(page, '¿Qué creamos con Martina?');
  await expect(page.getByRole('link', { name: /Un cuento/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Profesional|proyecto/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Su cumpleaños/ }).click();
  // Celebraciones, con Martina ya elegida.
  await heading(page, '¿Quién es el protagonista de la fiesta?');
  await expect(page.locator('#child-name')).toHaveValue('Martina');

  // En su perfil, con fotos vigentes, se crea su dibujo ahí mismo (sin empezar un cuento).
  await charactersTab(page);
  await page.getByRole('link', { name: 'Ver perfil' }).first().click();
  await heading(page, 'Martina');
  await page.getByRole('button', { name: 'Crear su dibujo' }).first().click();
  await expect(page.getByText('El nuevo', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/personajes\//);
});
