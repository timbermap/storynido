import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

import { expect, test, type Page } from '@playwright/test';

import { expectAccessible, expectNoHorizontalScroll, signInAtGate, uniqueEmail } from './helpers';

test.skip(
  ({ isMobile }) => isMobile,
  'El recorrido completo corre en escritorio; el móvil tiene el suyo.',
);

/** CRC32 de un bloque PNG. */
function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Foto de prueba sintética en PNG (un tablero nítido y bien iluminado; no es una persona). */
function testPhoto(): string {
  const [w, h] = [1200, 1600];
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x += 1) {
      const value = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 165 : 105;
      rows.fill(value, row + 1 + x * 3, row + 4 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'storynido-e2e-')), 'foto.png');
  writeFileSync(file, png);
  return file;
}

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });
const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();
const body = (page: Page) => page.locator('body');

test('familia en México: foto, muestra, cuenta, impreso con cupón, entrega, recompra y borrado', async ({
  page,
  context,
}) => {
  test.slow();
  const email = uniqueEmail('e2e');
  await context.addCookies([{ name: 'sn_country', value: 'MX', url: 'http://localhost:3000' }]);

  // --- Crear pide cuenta: enlace mágico y vuelta al creador ---
  await page.goto('/es/crear');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, email);
  await heading(page, 'Cuéntanos sobre el protagonista');
  await expect(page.locator('header button[aria-controls="menu-account"]')).toBeVisible();
  await page.locator('#child-name').fill('Martina');
  await page.locator('#child-age').selectOption('5');
  await page.locator('#child-like').fill('dinosaurios');
  await page.keyboard.press('Enter');
  await expectAccessible(page);
  await next(page);

  // Foto: el consentimiento del adulto va antes (queda registrado).
  await heading(page, 'Sube de 1 a 3 fotos');
  await page.locator('input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Acepto y quiero subir fotos' }).click();
  await page.locator('#photo-input').setInputFiles(testPhoto());
  await expect(page.locator('li', { hasText: 'Lista' })).toBeVisible({ timeout: 60_000 });
  await next(page);

  await heading(page, 'Elige la aventura');
  await page.locator('label', { hasText: 'La gran aventura espacial' }).click();
  await page.locator('label', { hasText: 'Corto' }).click();
  await page.locator('summary', { hasText: 'Ajustar la lectura' }).click();
  await page.locator('label', { hasText: 'Más lectura' }).click();
  await next(page);
  await heading(page, 'Hazlo realmente suyo');
  await page.locator('#memory-companion').fill('Su abuela Rosa');
  await next(page);
  await heading(page, '¿Qué quieres que aprenda?');
  await page.locator('label', { hasText: 'Compartir' }).click();
  await next(page);
  await heading(page, 'Elige el estilo de ilustración');
  await page.locator('label', { hasText: 'Acuarela' }).click();
  await next(page);
  await heading(page, '¡Todo listo para la vista previa!');
  const summary = page.locator('dl').first();
  for (const expected of [
    'Martina',
    'La gran aventura espacial',
    'Corto · 16 páginas',
    'Acuarela',
  ]) {
    await expect(summary).toContainText(expected);
  }
  await expectAccessible(page);

  // --- Etapa 1: historia y lámina (IA simulada) ---
  await page.getByRole('button', { name: 'Crear la vista previa gratis' }).click();
  await expect(body(page)).toContainText('Así vamos a dibujar a Martina', { timeout: 120_000 });
  await expect(page.locator('[aria-live=polite]').first()).toContainText('1 de 17');

  // Corrección guiada: primero qué no se parece y solo esos rasgos.
  await page.getByRole('button', { name: 'No se parece: corregir' }).click();
  const save = page.getByRole('button', { name: 'Guardar y volver a dibujar' });
  await expect(save).toBeDisabled();
  await expect(page.getByRole('group', { name: 'Color de pelo' })).toHaveCount(0);
  await page.getByLabel('El pelo').check();
  await expect(page.getByRole('group', { name: 'Color de pelo' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Color de ojos' })).toHaveCount(0);
  await expect(save).toBeEnabled();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();

  // --- Etapa 2: portada y páginas; editar y regenerar ---
  await page.getByRole('button', { name: 'Sí, es así' }).click();
  await expect(body(page)).toContainText('Personaje aprobado', { timeout: 120_000 });
  await page.locator('nav[aria-label="Páginas del libro"] button[aria-label="Página 1"]').click();
  await page.getByRole('button', { name: 'Editar texto' }).click();
  await page.locator('#page-text-editor').fill('Martina miró las estrellas y sonrió.');
  await page.getByRole('button', { name: 'Guardar texto' }).click();
  await expect(page.locator('[role=group]').first()).toContainText(
    'Martina miró las estrellas y sonrió.',
  );
  const before = await page.locator('[role=group] img').first().getAttribute('src');
  await page.getByRole('button', { name: 'Probar otra ilustración' }).first().click();
  await expect(body(page)).toContainText('Ya usaste la regeneración gratis', { timeout: 120_000 });
  expect(await page.locator('[role=group] img').first().getAttribute('src')).not.toBe(before);

  // --- Checkout: tapa blanda, dirección, cupón y pago simulado ---
  await page.getByRole('link', { name: 'Elegir formato' }).click();
  await heading(page, 'Tu libro');
  await page.locator('label', { hasText: 'Tapa blanda' }).click();
  // Sin dirección, el envío se cotiza después (no se puede pagar todavía).
  await expect(page.locator('aside dl')).toContainText('Envío: se calcula con tu dirección');
  await expect(page.getByRole('button', { name: 'Pagar' })).toBeDisabled();
  const address = {
    name: 'Ana Pérez',
    line1: 'Av. Reforma 123',
    city: 'Ciudad de México',
    state: 'CDMX',
    postalCode: '06600',
    phone: '+52 55 1234 5678',
  };
  for (const [key, value] of Object.entries(address))
    await page.locator(`#address-${key}`).fill(value);
  // Con la dirección completa se cotiza con las imprentas: envío real y plazo.
  await expect(page.locator('aside dl')).toContainText('Envío (llega en', { timeout: 30_000 });

  // Escenario 22: una fecha de regalo imposible nunca se promete.
  await page.locator('label', { hasText: 'Es un regalo' }).locator('input').check();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.locator('#gift-date').fill(tomorrow);
  await expect(page.locator('#gift-date-status')).toContainText('No llega para esa fecha');
  await page.locator('#gift-date').fill('2099-12-31');
  await expect(page.locator('#gift-date-status')).toContainText('Llega a tiempo');
  await page.locator('label', { hasText: 'Es un regalo' }).locator('input').uncheck();
  await page.locator('#coupon').fill('prueba10');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.locator('aside dl')).toContainText('Cupón PRUEBA10');
  await expect(page.locator('aside dl')).toContainText('IVA incluido');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Pagar' }).click();
  await expect(page).toHaveURL(/\/es\/pedido\//, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Simular el pago' }).click();

  // --- Pipeline completo (worker con IA e imprenta simuladas) ---
  await expect(body(page)).toContainText(/Tu libro está en la imprenta|está revisando tu libro/, {
    timeout: 240_000,
  });
  await expect(body(page)).toContainText('Tu libro está en la imprenta');
  await expect(page.getByRole('button', { name: 'Descargar el PDF' })).toBeEnabled();
  for (const expected of [
    'Tu libro se está imprimiendo',
    'Tu libro va en camino',
    'Tu libro fue entregado',
  ]) {
    await page.getByRole('button', { name: 'Avanzar la imprenta' }).click();
    await expect(body(page)).toContainText(expected);
  }
  await expect(page.locator('a[target=_blank]', { hasText: 'Seguir el envío' })).toBeVisible();
  await page.locator('#opinion button[aria-label="5 estrellas"]').click();
  await page.locator('#review-comment').fill('¡Le encantó verse en el cuento!');
  await page.getByRole('button', { name: 'Enviar mi opinión' }).click();
  await expect(page.locator('#opinion')).toContainText('¡Gracias por contarnos!');

  // --- Mis cuentos: pedido en vivo y recompra sin IA; Mi cuenta: borrado ---
  await page.goto('/es/mis-cuentos');
  await expect(page.locator('#orders li').first()).toContainText('Tu libro fue entregado');
  await page.locator('#orders a', { hasText: 'Pedir de nuevo' }).first().click();
  await expect(body(page)).toContainText('Pides de nuevo el mismo libro');
  await page.locator('label', { hasText: 'Digital' }).click();
  await expect(page.locator('aside dl')).toContainText('Total');
  await page.getByRole('button', { name: 'Pagar' }).click();
  await expect(page).toHaveURL(/\/es\/pedido\//);
  await page.getByRole('button', { name: 'Simular el pago' }).click();
  await expect(body(page)).toContainText('¡Tu libro está listo!', { timeout: 120_000 });

  await page.goto('/es/mis-cuentos');
  await expect(page.locator('#orders li')).toHaveCount(2, { timeout: 30_000 });
  await expectNoHorizontalScroll(page);
  await page.goto('/es/cuenta');
  await page.locator('#children button', { hasText: 'Borrar datos' }).click();
  await page.locator('#children button', { hasText: 'Sí, borrar' }).click();
  await expect(page.locator('#children')).toContainText('Borramos los datos de Martina');
  await page.locator('summary', { hasText: 'Borrar mi cuenta' }).click();
  await page.locator('label', { hasText: 'Entiendo que no se puede deshacer' }).click();
  await page.locator('#main button', { hasText: /^Borrar mi cuenta$/ }).click();
  await expect(page).toHaveURL(/\/es\/?$/, { timeout: 30_000 });
});
