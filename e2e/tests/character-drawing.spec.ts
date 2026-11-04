import { expect, test, type Page } from '@playwright/test';

import { signInAtGate, testPhoto, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });

test('agregar a un chico sin cuento y crear, usar, ajustar y descartar su dibujo', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('dibujo'));

  // «Agregar a otro chico» desde Personajes: solo el personaje, sin cuento.
  await page.goto('/es/mis-cuentos?estado=personajes');
  await page.getByRole('link', { name: /Agregar a otro chico/ }).click();
  await heading(page, 'Agregar a otro chico');
  await page.locator('#new-child-name').fill('Lu');
  await page.locator('#new-child-age').selectOption('4');
  // «¿Qué le gusta?» como en el creador: Enter agrega un chip; lo que queda escrito se guarda igual.
  await page.locator('#new-child-likes').fill('dinosaurios');
  await page.keyboard.press('Enter');
  await expect(page.locator('li', { hasText: 'dinosaurios' })).toBeVisible();
  await page.locator('#new-child-likes').fill('pintar');
  await page.locator('label', { hasText: 'Sin foto, con sus rasgos' }).click();
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await heading(page, 'Lu');
  // En el perfil, los gustos también son chips.
  await expect(page.locator('li', { hasText: 'dinosaurios' })).toBeVisible();
  await expect(page.locator('li', { hasText: 'pintar' })).toBeVisible();
  // Ningún cuento nuevo.
  await expect(page.locator('body')).not.toContainText('Borrador');

  // Crear su dibujo → el de ahora (ninguno) y el nuevo, lado a lado → usarlo.
  await page.getByRole('button', { name: 'Crear su dibujo' }).click();
  await expect(page.getByText('El nuevo', { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Usar este dibujo' }).click();
  await expect(page.getByRole('img', { name: 'Lu', exact: false }).first()).toBeVisible();

  // Actualizarlo y ajustar el parecido con una nota; quedarse con el anterior.
  await page.getByRole('button', { name: 'Actualizar su dibujo' }).click();
  await expect(page.getByText('El nuevo', { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Ajustar el parecido' }).click();
  await page.locator('#drawing-note').fill('que se vea un poco más chica');
  await page.getByRole('button', { name: 'Volver a dibujarlo' }).click();
  await expect(page.getByText('El nuevo', { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Quedarme con el anterior' }).click();
  await expect(page.getByText('El nuevo', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Actualizar su dibujo' })).toBeVisible();

  // Con foto: el personaje queda con su foto y se le puede crear el dibujo.
  await page.goto('/es/mis-cuentos/personajes/nuevo');
  await page.locator('#new-child-name').fill('Teo');
  await page.locator('input[type=checkbox]').first().check();
  await page.locator('#new-child-photo').setInputFiles(testPhoto());
  // Vista previa antes de guardar, con quitar.
  await expect(page.getByRole('img', { name: 'Foto elegida 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar la foto 1' }).click();
  await expect(page.getByRole('img', { name: 'Foto elegida 1' })).toHaveCount(0);
  await page.locator('#new-child-photo').setInputFiles(testPhoto());
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await heading(page, 'Teo');
  await expect(page.getByRole('button', { name: 'Crear su dibujo' })).toBeVisible({
    timeout: 60_000,
  });

  // En el perfil: quitar la foto y volver a subir una desde ahí (sin cuento).
  await page.getByRole('button', { name: 'Quitar la foto 1' }).click();
  await expect(page.locator('body')).toContainText('No hay fotos guardadas', { timeout: 30_000 });
  await page
    .locator('section', { hasText: 'No hay fotos guardadas' })
    .locator('input[type=checkbox]')
    .check();
  await page.locator('#profile-photo').setInputFiles(testPhoto());
  await expect(page.getByRole('button', { name: 'Quitar la foto 1' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('button', { name: 'Crear su dibujo' })).toBeVisible();
});
