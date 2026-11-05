import { expect, test, type Page } from '@playwright/test';

import { addPhotoFromTile, signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();

/** Desde el perfil: «Crear un cuento con…» → Familias → el personaje ya elegido → Siguiente. */
async function storyFromProfile(page: Page, name: string) {
  await page.getByRole('button', { name: `Crear un cuento con ${name}` }).click();
  await heading(page, `¿Qué creamos con ${name}?`);
  await page.locator('main a[data-track-line="families"]').click();
  await heading(page, 'Cuéntanos sobre el protagonista');
  await expect(page.locator('#child-name')).toHaveValue(name);
  await next(page);
}

test('personaje con dibujo aprobado: el cuento usa ese dibujo, sin fotos ni rasgos que elegir', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('con-dibujo'));

  await page.goto('/es/mis-cuentos/personajes/nuevo');
  await page.locator('#new-child-name').fill('Lu');
  await page.locator('label', { hasText: 'Sin foto, con sus rasgos' }).click();
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await heading(page, 'Lu');
  await page.getByRole('button', { name: 'Crear su dibujo' }).first().click();
  await expect(page.getByText('El nuevo', { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Usar este dibujo' }).click();
  await expect(page.getByText('El nuevo', { exact: true })).toHaveCount(0);

  await storyFromProfile(page, 'Lu');
  // El paso del personaje muestra su dibujo y sigue directo.
  await heading(page, 'Así se ve Lu');
  await expect(page.getByText('Usamos el dibujo de Lu')).toBeVisible();
  await expect(page.getByRole('img', { name: 'El dibujo de Lu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Elegir fotos' })).toHaveCount(0);
  await next(page);
  await heading(page, 'Elige la aventura');

  // «Cambiar» → sin foto, con sus rasgos: vuelve al paso de siempre.
  await page.getByRole('button', { name: 'Atrás' }).click();
  await heading(page, 'Así se ve Lu');
  await page.getByRole('button', { name: 'Cambiar' }).click();
  await page.getByRole('button', { name: 'Sin foto, con sus rasgos' }).click();
  await heading(page, 'Elige cómo se ve');
});

test('personaje con fotos subidas desde su perfil (sin dibujo): el cuento ofrece usarlas', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('con-fotos'));

  await page.goto('/es/mis-cuentos/personajes/nuevo');
  await page.locator('#new-child-name').fill('Teo');
  await addPhotoFromTile(page, { consent: true });
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await heading(page, 'Teo');
  await expect(page.getByRole('img', { name: 'Foto 1 de Teo' })).toBeVisible({ timeout: 60_000 });

  await storyFromProfile(page, 'Teo');
  await heading(page, 'Sube de 1 a 3 fotos');
  const reused = page.locator('fieldset', { hasText: 'Fotos de Teo que ya tenemos' });
  await expect(reused).toBeVisible();
  await expect(reused.locator('img')).toHaveCount(1);
  await expect(page.getByRole('radio', { name: 'Usar estas fotos' })).toBeChecked();
  await next(page);
  await heading(page, 'Elige la aventura');
});

test('con un personaje de Familias se puede crear en Profesionales: activa la cuenta y sigue con él', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('a-pro'));

  await page.goto('/es/mis-cuentos/personajes/nuevo');
  await page.locator('#new-child-name').fill('Nico');
  await page.locator('label', { hasText: 'Sin foto, con sus rasgos' }).click();
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await heading(page, 'Nico');
  await page.getByRole('button', { name: 'Crear un cuento con Nico' }).click();
  await heading(page, '¿Qué creamos con Nico?');
  await page.locator('main a[data-track-line="professionals"]').click();
  // Cuenta de familia: primero se activa la cuenta Pro, y el personaje sigue elegido.
  await page.locator('main select').first().selectOption('teacher', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await heading(page, '¿Para quién es el cuento?');
  // Sin alias propio: se precarga con su nombre (se puede cambiar).
  await expect(page.locator('#child-alias')).toHaveValue('Nico');
  await next(page);
  await expect(page.locator('body')).not.toContainText('Escribe un alias para continuar.');
});
