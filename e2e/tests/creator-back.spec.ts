import { expect, test, type Page } from '@playwright/test';

import { FIRESTORE, PROJECT, signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

const heading = (page: Page, text: string) =>
  expect(page.locator('h1').first()).toContainText(text, { timeout: 30_000 });

const docUrl = (path: string) =>
  `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;

/** Copia un borrador como recién creado y vacío (sin protagonista, en el primer paso). */
async function emptyCopy(bookId: string): Promise<string> {
  const response = await fetch(docUrl(`books/${bookId}`), {
    headers: { authorization: 'Bearer owner' },
  });
  const { fields } = (await response.json()) as { fields: Record<string, unknown> };
  const id = `vacio-${String(Date.now())}`;
  const patch = await fetch(docUrl(`books/${id}`), {
    method: 'PATCH',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({
      fields: {
        ...fields,
        childId: { nullValue: null },
        dedication: { nullValue: null },
        photoIds: { arrayValue: {} },
        wizardStep: { integerValue: '0' },
        wizardStepKey: { stringValue: 'child' },
      },
    }),
  });
  if (!patch.ok) throw new Error(`emptyCopy: ${String(patch.status)}`);
  return id;
}

test('creador: «Atrás», atrás del navegador por pasos y salir sin diálogo si está vacío', async ({
  page,
}) => {
  test.slow();
  await page.goto('/es/crear?line=families');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('atras'));
  await heading(page, 'Cuéntanos sobre el protagonista');
  // Primer paso: sin «Atrás».
  await expect(page.getByRole('button', { name: 'Atrás' })).toHaveCount(0);
  await page.locator('#child-name').fill('Lu');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await heading(page, 'Sube de 1 a 3 fotos');
  await expect(page).toHaveURL(/\/es\/crear\/[^/?]+$/);
  const bookId = new URL(page.url()).pathname.split('/').at(-1) ?? '';

  // «Atrás» a la vista en el pie, vuelve al paso anterior.
  await page.getByRole('button', { name: 'Atrás' }).click();
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await heading(page, 'Sube de 1 a 3 fotos');

  // El atrás del navegador vuelve un paso sin salir del creador.
  await page.goBack();
  await heading(page, 'Cuéntanos sobre el protagonista');
  await expect(page).toHaveURL(new RegExp(`/es/crear/${bookId}$`));
  // En el primer paso, con algo escrito, abre el diálogo de salida.
  await page.goBack();
  const dialog = page.getByRole('dialog', { name: '¿Salir del creador?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Seguir creando' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/es/crear/${bookId}$`));

  // Un borrador vacío: la X sale directo, sin diálogo.
  const empty = await emptyCopy(bookId);
  await page.goto(`/es/crear/${empty}`);
  await heading(page, 'Cuéntanos sobre el protagonista');
  await page.getByRole('button', { name: 'Guardar y salir' }).click();
  await expect(page).toHaveURL(/\/es\/mis-cuentos/, { timeout: 30_000 });
  await expect(dialog).toHaveCount(0);
});
