import { expect, test, type Page } from '@playwright/test';

import { expectAccessible, expectNoHorizontalScroll, magicLink, uniqueEmail } from './helpers';

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();

/** Capturas para el PR: solo si se piden con E2E_SHOTS (carpeta de destino). */
async function shot(page: Page, name: string, isMobile: boolean) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.addStyleTag({
    content: 'nextjs-portal { display: none } header { position: static !important }',
  });
  await page.screenshot({
    path: `${dir}/${name}-${isMobile ? 'movil' : 'escritorio'}.png`,
    fullPage: true,
  });
}

test('Profesionales: del alias a la vista previa con texto editable y precio', async ({
  page,
  isMobile,
}) => {
  test.slow();
  await page.goto('/es/ingresar');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  const email = uniqueEmail('pro');
  await page.locator('#email:visible').fill(email);
  await page.getByRole('button', { name: 'Enviarme un enlace' }).click();
  await expect(page.locator('body')).toContainText('Revisa tu correo');
  await page.goto(await magicLink(email));
  await expect(page).toHaveURL(/\/es$/, { timeout: 30_000 });
  await page.goto('/es/crear?line=professionals');

  // La cuenta profesional se activa una sola vez: ahí va la profesión, no en el creador.
  await page.locator('main select').first().selectOption('teacher', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();

  // Personaje: un solo alias, sin apellido ni datos clínicos; arranca sin foto.
  await heading(page, '¿Para quién es el cuento?');
  await expect(page.locator('#child-name')).toHaveCount(0);
  await expect(page.locator('#child-pet')).toHaveCount(0);
  await next(page);
  await expect(page.locator('body')).toContainText('Escribe un alias para continuar.');
  await page.locator('#child-alias').fill('Mati');
  await page.locator('#child-age').selectOption('6');
  await page.locator('#child-like').fill('los trenes');
  await page.keyboard.press('Enter');
  await expectAccessible(page);
  await shot(page, '1-personaje', isMobile);
  await next(page);
  await heading(page, 'Elige cómo se ve');
  await expect(page.locator('label', { hasText: 'Sin foto' })).toContainText('Recomendado');
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await next(page);

  // Aventura: la situación primero; sin elegirla no se sigue.
  await heading(page, '¿Qué quieres trabajar?');
  await expect(page.locator('body')).toContainText('Etapa 2 de 4: Aventura');
  await next(page);
  await expect(page.locator('body')).toContainText('Elige una colección para continuar.');
  await page.locator('label', { hasText: 'Reconocer y expresar emociones' }).click();
  await next(page);
  await expect(page.locator('body')).toContainText('Elige un objetivo para continuar.');
  await page.locator('label', { hasText: 'Vínculos' }).click();
  await next(page);
  await expect(page.locator('body')).toContainText('Elige un cuento base para continuar.');
  await page.locator('label', { hasText: 'Hoy estoy triste' }).click();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, '2-aventura', isMobile);
  await next(page);

  // Ajustes: las tres opciones por separado y el aviso.
  await heading(page, 'Cómo se lee');
  await expect(page.locator('body')).toContainText('Etapa 3 de 4: Ajustes');
  await expect(page.locator('body')).toContainText('no es clínico');
  await expect(page.locator('body')).toContainText('12 páginas');
  await expect(page.locator('label', { hasText: 'Mini' }).locator('input')).toBeChecked();
  await page.locator('label', { hasText: 'Más lectura' }).click();
  await page.locator('label', { hasText: 'Inicial' }).click();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, '3-ajustes', isMobile);
  await next(page);

  // Vista previa: resumen, personaje y texto editable por página, antes de pagar.
  await heading(page, '¡Todo listo para la vista previa!');
  await expect(page.locator('body')).toContainText('Vínculos');
  await expect(page.locator('body')).toContainText('Más lectura');
  await page.getByRole('button', { name: 'Crear la vista previa gratis' }).click();
  await page.getByRole('button', { name: /Sí, es así/ }).click({ timeout: 120_000 });
  await expect(page.getByRole('link', { name: 'Aprobar y pagar' })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('body')).toContainText('no es clínico');
  await expect(page.locator('body')).toContainText('Cuento digital:');
  await expect(page.getByRole('button', { name: 'Probar otra ilustración' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('¿Le regalas');
  await expectAccessible(page);
  await shot(page, '4-vista-previa', isMobile);
  await page.getByRole('link', { name: 'Aprobar y pagar' }).click();
  await expect(page).toHaveURL(/\/es\/pagar\//, { timeout: 30_000 });
});
