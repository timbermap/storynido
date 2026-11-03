import { expect, test } from '@playwright/test';

import { expectAccessible, magicLink, signInAtGate, uniqueEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'Alcanza con escritorio.');

test('crear pide cuenta y el borrador se puede borrar desde Mis cuentos', async ({ page }) => {
  await page.goto('/es/crear?line=events');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('borrador'));
  await expect(page.locator('h1').first()).toContainText(
    '¿Quién es el protagonista de la fiesta?',
    {
      timeout: 30_000,
    },
  );
  await page.locator('#child-name').fill('Tomi');
  await page.locator('#child-age').selectOption('6');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.locator('h1').first()).not.toContainText(
    '¿Quién es el protagonista de la fiesta?',
  );

  await page.goto('/es/mis-cuentos');
  const draft = page.locator('#drafts li', { hasText: 'El cuento de Tomi' });
  await expect(draft).toBeVisible({ timeout: 30_000 });
  await draft.getByRole('button', { name: 'Borrar El cuento de Tomi' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('body')).not.toContainText('El cuento de Tomi');
  // Recargando sigue borrado.
  await page.reload();
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('El cuento de Tomi');

  // El protagonista queda guardado: un cuento nuevo ofrece reutilizarlo (PR 6).
  await page.goto('/es/crear?line=events');
  await expect(page.getByRole('group', { name: '¿Para quién es este cuento?' })).toBeVisible({
    timeout: 30_000,
  });
  await page.locator('label', { hasText: 'Tomi' }).click();
  await expect(page.locator('#child-name')).toHaveValue('Tomi');
});

test('si Firestore no responde, el creador no queda cargando', async ({ page }) => {
  // Sin línea ni historia, un usuario nuevo elige qué crear en /nuevo.
  await page.goto('/es/crear');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await signInAtGate(page, uniqueEmail('sin-red'));
  await expect(page).toHaveURL(/\/es\/nuevo/, { timeout: 30_000 });
  await page.getByRole('link', { name: /Un cuento para un chico especial/ }).click();
  await expect(page.locator('h1').first()).toContainText('Cuéntanos sobre el protagonista', {
    timeout: 30_000,
  });
  // Sin Firestore (red cortada o bloqueada): o avisa con "Reintentar", o abre el creador en
  // memoria (el borrador se crea al guardar). Nunca se queda en el esqueleto de carga.
  await page.route('**/google.firestore.v1.Firestore/**', (route) => route.abort());
  await page.goto('/es/crear?line=families');
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'No pudimos preparar tu cuento' })
      .or(page.locator('h1', { hasText: 'Cuéntanos sobre el protagonista' })),
  ).toBeVisible({ timeout: 40_000 });
});

test('desde un tema de Celebraciones, el creador abre con la temática cargada', async ({
  page,
}) => {
  // Sin sesión el botón lleva al login (y a la home con sesión): se entra primero.
  await page.goto('/es/ingresar');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  const email = uniqueEmail('tema');
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: 'Enviarme un enlace' }).click();
  await expect(page.locator('body')).toContainText('Revisa tu correo');
  await page.goto(await magicLink(email));
  await expect(page).toHaveURL(/\/es$/, { timeout: 30_000 });

  await page.goto('/es/eventos');
  const start = page.getByRole('link', { name: /Diseñar el kit con este tema/ }).first();
  // El enlace pasa de "login" al creador cuando la web detecta la sesión.
  await expect(start).toHaveAttribute('href', /tema=/);
  const theme = new URL(String(await start.getAttribute('href')), 'http://x').searchParams.get(
    'tema',
  );
  expect(theme).toBeTruthy();
  await start.click();
  // La temática se elige en la etapa Aventura: se recorre el personaje hasta llegar a ella.
  await page.locator('#child-name').fill('Tomi', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.locator('label', { hasText: 'Sin foto' }).click();
  for (const label of ['Morena', 'Negro', 'Corto', 'Rizado', 'Verdes']) {
    await page.locator('label', { hasText: label }).first().click();
  }
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.locator('label', { hasText: String(theme) }).locator('input')).toBeChecked({
    timeout: 30_000,
  });
});

test('sin sesión, el botón de un tema de Celebraciones lleva al login', async ({ page }) => {
  await page.goto('/es/eventos');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await expect(
    page.getByRole('link', { name: /Diseñar el kit con este tema/ }).first(),
  ).toHaveAttribute('href', /\/ingresar$/);
});

test('con sesión, el navbar es el de la app: sin las páginas que venden y con Crear', async ({
  page,
}) => {
  await page.goto('/es/ingresar');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  // Sin sesión: el navbar de visitante, con los tres públicos.
  await expect(
    page.locator('header').getByRole('link', { name: 'Familias', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('header').getByRole('link', { name: 'Celebraciones', exact: true }),
  ).toBeVisible();
  const email = uniqueEmail('navbar');
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: 'Enviarme un enlace' }).click();
  await expect(page.locator('body')).toContainText('Revisa tu correo');
  await page.goto(await magicLink(email));
  await expect(page).toHaveURL(/\/es$/, { timeout: 30_000 });
  // Mis cuentos sigue en el navbar; en una cuenta nueva arranca con "¿Qué quieres crear?".
  await page.locator('header').first().getByRole('link', { name: 'Mis cuentos' }).click();
  await expect(page).toHaveURL(/\/es\/mis-cuentos$/);
  await expect(page.getByRole('heading', { name: '¿Qué quieres crear?' })).toBeVisible();
  const header = page.locator('header').first();
  await expect(header.getByRole('link', { name: 'Mis cuentos' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Crear' })).toBeVisible();
  // Las tres puertas: el catálogo de cada línea (no las landings que venden).
  await expect(header.getByRole('link', { name: 'Celebraciones', exact: true })).toHaveAttribute(
    'href',
    '/es/eventos/tematicas',
  );
  await expect(header.getByRole('link', { name: /Cómo funciona/ })).toHaveCount(0);
  // El logo lleva a la home con sesión y la landing de un público conserva el mismo navbar.
  await page.goto('/es/familias');
  await expect(
    page.locator('header').first().getByRole('link', { name: 'Celebraciones', exact: true }),
  ).toHaveAttribute('href', '/es/eventos/tematicas');
  await expect(page.locator('header a[href="/es"]').first()).toBeVisible();
  // "Crear" reúne las tres opciones.
  await page.locator('header').first().getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByRole('link', { name: /Un kit para una celebración/ })).toBeVisible();
});
