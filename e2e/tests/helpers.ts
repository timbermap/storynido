import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const PROJECT = 'demo-storynido';
export const AUTH = 'http://127.0.0.1:9099';
export const FIRESTORE = 'http://127.0.0.1:8180';
export const ADMIN_URL = 'http://localhost:3001';

/** Email único por prueba (los emuladores se comparten entre corridas). */
export const uniqueEmail = (prefix: string) =>
  `${prefix}-${String(Date.now())}-${String(Math.floor(Math.random() * 1e4))}@storynido.test`;

/** WCAG 2.2 AA con axe: cero violaciones. */
export async function expectAccessible(page: Page) {
  // Tras navegar, el <title> puede llegar un instante después del contenido (metadata en streaming).
  await expect(page).toHaveTitle(/.+/);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? '-'}): ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, 'violaciones de accesibilidad').toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'scroll horizontal').toBeLessThanOrEqual(0);
}

/** Último enlace mágico enviado a ese email (el emulador de Auth no manda mails). */
export async function magicLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`);
    const { oobCodes } = (await response.json()) as {
      oobCodes: { email: string; oobLink: string }[];
    };
    const link = oobCodes.filter((code) => code.email === email).at(-1)?.oobLink;
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No llegó el enlace mágico de ${email}`);
}

/**
 * Crear pide cuenta (DECISIONS 106): en la puerta del creador se pide el enlace mágico. Tras el
 * enlace se cae en la home con sesión; el test vuelve a la página donde estaba, ya con la sesión iniciada.
 */
export async function signInAtGate(page: Page, email: string) {
  const back = page.url();
  await expect(page.locator('h1').first()).toContainText('Inicia sesión', { timeout: 30_000 });
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: 'Enviarme un enlace' }).click();
  await expect(page.locator('body')).toContainText('Revisa tu correo');
  await page.goto(await magicLink(email));
  // Tras entrar siempre se cae en la home con sesión (DECISIONS 220): se vuelve a la página donde se estaba.
  await expect(page).toHaveURL(/\/(es|en|pt)$/, { timeout: 30_000 });
  await page.goto(back);
}

/** Cuenta con contraseña y rol (solo emuladores): para entrar al admin. */
export async function staffAccount(email: string, role: 'admin' | 'superadmin') {
  const password = 'e2e-secret-123';
  const signUp = (await (
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
  ).json()) as { localId: string };
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: 'POST',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({
      localId: signUp.localId,
      customAttributes: JSON.stringify({ role }),
    }),
  });
  return { uid: signUp.localId, password };
}

type Value = string | number | boolean | null | Date | Value[] | { [key: string]: Value };

/** Valor de Firestore en el formato de su API REST. */
function encode(value: Value): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  switch (typeof value) {
    case 'string':
      return { stringValue: value };
    case 'boolean':
      return { booleanValue: value };
    case 'number':
      return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    default:
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(value).map(([key, inner]) => [key, encode(inner)]),
          ),
        },
      };
  }
}

/** Escribe un documento en el emulador de Firestore sin pasar por las reglas (datos de prueba). */
export async function seedDoc(path: string, data: Record<string, Value>) {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, encode(value)]),
        ),
      }),
    },
  );
  if (!response.ok) throw new Error(`seedDoc ${path}: ${String(response.status)}`);
}

/** Lee un campo de un documento del emulador. */
export async function readField(path: string, field: string): Promise<unknown> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: { authorization: 'Bearer owner' } },
  );
  const doc = (await response.json()) as { fields?: Record<string, Record<string, unknown>> };
  const value = doc.fields?.[field];
  return value ? Object.values(value)[0] : undefined;
}

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
export function testPhoto(): string {
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

/**
 * Agrega una foto desde la baldosa «Agregar foto» (perfil y «Agregar a otro chico»): la primera vez
 * pide el consentimiento en un diálogo y «Aceptar y elegir foto» abre el selector.
 */
export async function addPhotoFromTile(page: Page, { consent }: { consent: boolean }) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Agregar foto' }).click();
  if (consent) {
    const dialog = page.getByRole('dialog', { name: 'Antes de subir su foto' });
    await expect(dialog).toContainText('Soy el padre, la madre o el tutor legal');
    await dialog.getByRole('button', { name: 'Aceptar y elegir foto' }).click();
  }
  await (await chooser).setFiles(testPhoto());
}
