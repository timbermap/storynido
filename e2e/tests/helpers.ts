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
