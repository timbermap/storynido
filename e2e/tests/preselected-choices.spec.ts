import { expect, test, type Page } from '@playwright/test';

import { magicLink, signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();
const traits = async (page: Page) => {
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
};

test('Familias: con la historia y la enseñanza elegidas, la aventura es un resumen con «Cambiar»', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families&story=aventura-espacial&lesson=compartir');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('elegido'));
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.locator('#child-name').fill('Lu');
  await page.locator('#child-age').selectOption('6');
  await next(page);
  await heading(page, 'Sube de 1 a 3 fotos');
  await page.locator('label', { hasText: 'Sin foto' }).click();
  await heading(page, 'Elige cómo se ve');
  await traits(page);
  await next(page);

  await heading(page, 'Elige la aventura');
  const summary = page.getByRole('region', { name: 'Vas a crear' });
  await expect(summary).toContainText('Enseñanza: Compartir');
  await expect(page.locator('input[name="story"]')).toHaveCount(0);
  // «Cambiar» despliega las historias, con la elegida marcada.
  await summary.getByRole('button', { name: 'Cambiar' }).click();
  await expect(page.locator('input[name="story"]:checked')).toHaveCount(1);
  await next(page);
  await expect(page.locator('h1').first()).not.toContainText('Elige la aventura', {
    timeout: 30_000,
  });
});

test('Profesionales: con el cuento base elegido, «Siguiente» sin volver a elegir colección ni objetivo', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/ingresar');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  const email = uniqueEmail('pro-elegido');
  await page.locator('#email:visible').fill(email);
  await page.getByRole('button', { name: 'Enviarme un enlace' }).click();
  await expect(page.locator('body')).toContainText('Revisa tu correo');
  await page.goto(await magicLink(email));
  await expect(page).toHaveURL(/\/es$/, { timeout: 30_000 });
  await page.goto(
    '/es/crear?line=professionals&story=chau-panal&lesson=dejar-el-panal-o-el-chupete',
  );
  await page.locator('main select').first().selectOption('teacher', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await heading(page, '¿Para quién es el cuento?');
  await page.locator('#child-alias').fill('Pepe');
  await page.locator('#child-age').selectOption('3');
  await next(page);
  await heading(page, 'Elige cómo se ve');
  await traits(page);
  await next(page);

  await heading(page, '¿Qué quieres trabajar?');
  const summary = page.getByRole('region', { name: 'Vas a crear' });
  await expect(summary).toBeVisible();
  await expect(page.locator('input[name="pro-collection"]')).toHaveCount(0);
  await next(page);
  await expect(page.locator('h1').first()).not.toContainText('¿Qué quieres trabajar?', {
    timeout: 30_000,
  });
});
