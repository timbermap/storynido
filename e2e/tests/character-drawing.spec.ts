import { expect, test, type Page } from '@playwright/test';

import { addPhotoFromTile, signInAtGate, uniqueEmail } from './helpers';

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

  // Sin dibujo y con rasgos: la acción principal de la cabecera es crearlo; el cuento, secundario.
  await expect(page.locator('body')).toContainText('Todavía no tiene dibujo');
  await expect(page.getByRole('button', { name: 'Crear su dibujo' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Crear un cuento con Lu' })).toBeVisible();
  // El primer dibujo se ve en el retrato, sin un «de ahora» vacío al lado.
  await page.getByRole('button', { name: 'Crear su dibujo' }).click();
  await expect(page.getByText('El nuevo', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('El de ahora', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descartar' })).toBeVisible();
  await page.getByRole('button', { name: 'Usar este dibujo' }).click();
  await expect(page.getByRole('img', { name: 'Lu', exact: false }).first()).toBeVisible();

  // Actualizarlo y ajustar el parecido con una nota; quedarse con el anterior.
  await page.getByRole('button', { name: 'Actualizar su dibujo' }).click();
  await expect(page.getByText('El nuevo', { exact: true })).toBeVisible({ timeout: 60_000 });
  // Con dibujo, el nuevo se compara con el de ahora (chico, al lado de las acciones).
  await expect(page.getByText('El de ahora', { exact: true })).toBeVisible();
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
  // La tarjeta no muestra el consentimiento hasta que se va a subir una foto.
  await expect(page.getByText('Soy el padre, la madre o el tutor legal')).toHaveCount(0);
  await addPhotoFromTile(page, { consent: true });
  // Vista previa antes de guardar, con quitar (sin confirmar: todavía no se guardó).
  await expect(page.getByRole('img', { name: 'Foto elegida 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar la foto 1' }).click();
  await expect(page.getByRole('img', { name: 'Foto elegida 1' })).toHaveCount(0);
  // Ya aceptó: la baldosa abre el selector directo.
  await addPhotoFromTile(page, { consent: false });
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await heading(page, 'Teo');
  await expect(page.getByRole('button', { name: 'Crear su dibujo' }).first()).toBeVisible({
    timeout: 60_000,
  });
  await expectThumbnailLoaded(page, 'Foto 1 de Teo');

  // En el perfil: quitar la foto (con confirmación) y volver a subir una desde ahí (sin cuento).
  await expect(page.getByText('Borrar la foto ahora')).toHaveCount(0);
  await page.getByRole('button', { name: 'Quitar la foto 1' }).click();
  await page
    .getByRole('dialog', { name: '¿Borrar esta foto?' })
    .getByRole('button', { name: 'Borrar' })
    .click();
  await expect(page.locator('body')).toContainText('Sube una foto de frente', { timeout: 30_000 });
  await addPhotoFromTile(page, { consent: true });
  await expect(page.getByRole('button', { name: 'Quitar la foto 1' })).toBeVisible({
    timeout: 60_000,
  });
  // La miniatura carga de verdad (antes una foto rechazada o pendiente quedaba rota).
  await expectThumbnailLoaded(page, 'Foto 1 de Teo');
  // Con la foto cargada, el recuadro del retrato ofrece crear el dibujo ahí mismo.
  await expect(page.locator('body')).toContainText('Todavía no tiene dibujo');
  await expect(page.getByRole('button', { name: 'Crear su dibujo' })).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('No pudimos subir la foto');
  await expect(page.getByRole('button', { name: 'Crear su dibujo' }).first()).toBeVisible();
});

async function expectThumbnailLoaded(page: Page, name: string) {
  const thumbnail = page.getByRole('img', { name });
  await expect(thumbnail).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
}
