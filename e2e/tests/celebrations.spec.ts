import { expect, test, type Page } from '@playwright/test';

import { expectAccessible, expectNoHorizontalScroll, signInAtGate, uniqueEmail } from './helpers';

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();

/** Capturas para el PR: solo si se piden con E2E_SHOTS (carpeta de destino). */
async function shot(page: Page, name: string, isMobile: boolean) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  // Arriba de todo y sin el indicador de desarrollo: la cabecera fija no tapa la página.
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

test('Celebraciones: de la temática de la landing a la muestra y el pago del kit', async ({
  page,
  isMobile,
}) => {
  test.slow();
  await page.goto('/es/crear?line=events&tema=Campeones');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('fiesta'));

  // Personaje: nombre, edad que cumple y foto o rasgos; nada de gustos ni mascota.
  await heading(page, '¿Quién es el protagonista de la fiesta?');
  await expect(page.locator('#child-like')).toHaveCount(0);
  await expect(page.locator('label[for="child-age"]')).toHaveText('Edad que cumple');
  await page.locator('#child-name').fill('Tomi');
  await page.locator('#child-age').selectOption('7');
  await shot(page, '1-personaje', isMobile);
  await next(page);
  await heading(page, 'Sube de 1 a 3 fotos');
  await page.locator('label', { hasText: 'Sin foto' }).click();
  await heading(page, 'Elige cómo se ve');
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await next(page);

  // Aventura: la temática llega elegida y se puede cambiar; la historia no se pregunta.
  await heading(page, 'La fiesta');
  await expect(page.locator('body')).toContainText('Etapa 2 de 4: Celebración');
  await expect(page.locator('label', { hasText: 'Campeones' }).locator('input')).toBeChecked();
  await page.locator('#event-date').fill('2026-12-12');
  await page.locator('#event-place').fill('Parque Lezama');
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, '2-aventura', isMobile);
  await next(page);

  // Ajustes: kit completo preseleccionado, con el precio de la landing.
  await heading(page, '¿Qué llevas?');
  await expect(page.locator('body')).toContainText('Etapa 3 de 4: Ajustes');
  const kit = page.locator('label', { hasText: 'Kit digital completo' });
  await expect(kit.locator('input')).toBeChecked();
  await expect(kit).toContainText(/24[.,]99/);
  await expect(page.locator('label', { hasText: 'Solo la invitación' })).toContainText(/9[.,]99/);
  await page.locator('#kit-dedication').fill('Gracias por venir a mi fiesta.');
  await page.locator('label', { hasText: 'Tierno' }).click();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, '3-ajustes', isMobile);
  await page.getByRole('button', { name: 'Continuar a mi muestra' }).click();

  // Vista previa: resumen, personaje a aprobar y muestra gratis.
  await heading(page, '¡Todo listo para la vista previa!');
  await expect(page.locator('body')).toContainText('Etapa 4 de 4: Vista previa');
  await expect(page.locator('body')).toContainText('Parque Lezama');
  await page.getByRole('button', { name: 'Crear la vista previa gratis' }).click();
  await page.getByRole('button', { name: /Sí, es así/ }).click({ timeout: 120_000 });
  await expect(page.getByRole('heading', { name: 'Tu invitación' })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('body')).toContainText('¡Tomi cumple 7!');
  await expect(page.locator('body')).toContainText('Me encantaría que vengas a mi cumple');
  await expect(page.locator('body')).toContainText('El cuento de recuerdo');

  // El libro del cumpleañero se ofrece acá y se paga aparte: «Ahora no» viene marcado.
  await expect(page.locator('label', { hasText: 'Ahora no' }).locator('input')).toBeChecked();
  await page.locator('label', { hasText: 'Impreso' }).click();
  await expect(page.locator('body')).toContainText('desde tu pedido creas su libro');
  await expect(page.getByRole('button', { name: 'Enviarles el enlace' })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, '4-vista-previa', isMobile);

  // Al pago llega todo lo elegido; el lugar ya está cargado y el kit, marcado.
  await page.getByRole('link', { name: 'Aprobar y pagar' }).click();
  await expect(page.locator('#kit-place')).toHaveValue('Parque Lezama', { timeout: 30_000 });
  await expect(page.locator('label', { hasText: 'Stickers' }).locator('input')).toBeChecked();
});

test('Celebraciones: solo la invitación llega así al pago', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Alcanza con escritorio.');
  test.slow();
  await page.goto('/es/crear?line=events');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('invitacion'));
  await heading(page, '¿Quién es el protagonista de la fiesta?');
  await page.locator('#child-name').fill('Lola');
  await next(page);
  await heading(page, 'Sube de 1 a 3 fotos');
  await page.locator('label', { hasText: 'Sin foto' }).click();
  await heading(page, 'Elige cómo se ve');
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await next(page);

  // Sin venir de un tema de la landing, la temática se pide.
  await heading(page, 'La fiesta');
  await next(page);
  await expect(page.locator('body')).toContainText('Elige una temática para continuar.');
  await page.locator('label', { hasText: 'El clásico de cumpleaños' }).click();
  // Las demás ocasiones también se guardan.
  await page.locator('#event-occasion').selectOption('baptism');
  await next(page);

  await heading(page, '¿Qué llevas?');
  // El tono de la invitación habla del bautismo (no del cumple) y se llama Alegre, Tierno, Emotivo.
  const tones = page.locator('fieldset', { hasText: 'Tono de la invitación' });
  await expect(tones).toContainText('«¡Te invito a mi bautismo!»');
  await expect(tones).toContainText('Emotivo');
  await expect(tones).toContainText('Un día muy especial: acompáñame en mi bautismo');
  await expect(tones).not.toContainText(/cumple|Aventurero/);
  await shot(page, '4-tono-bautismo', isMobile);
  await page.locator('label', { hasText: 'Solo la invitación' }).click();
  await expect(page.locator('#kit-dedication')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar a mi muestra' }).click();
  await heading(page, '¡Todo listo para la vista previa!');
  await page.getByRole('button', { name: 'Crear la vista previa gratis' }).click();
  await page.getByRole('button', { name: /Sí, es así/ }).click({ timeout: 120_000 });
  await expect(page.getByRole('link', { name: 'Aprobar y pagar' })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('body')).toContainText('Solo la invitación');
  await page.getByRole('link', { name: 'Aprobar y pagar' }).click();
  await expect(
    page.locator('label', { hasText: 'Invitación' }).first().locator('input'),
  ).toBeChecked({
    timeout: 30_000,
  });
  await expect(page.locator('label', { hasText: 'Stickers' }).locator('input')).not.toBeChecked();
});
