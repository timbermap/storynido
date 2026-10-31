import { expect, test } from '@playwright/test';

import { expectAccessible, expectNoHorizontalScroll } from './helpers';

/** Rutas por idioma (i18n/routing.ts) y la línea a la que lleva el botón principal. */
const PAGES = {
  es: {
    home: '/es',
    families: '/es/familias',
    events: '/es/eventos',
    professionals: '/es/profesionales',
    stories: '/es/historias',
    story: '/es/historias/aventura-espacial',
  },
  en: {
    home: '/en',
    families: '/en/families',
    events: '/en/events',
    professionals: '/en/professionals',
    stories: '/en/stories',
    story: '/en/stories/aventura-espacial',
  },
  pt: {
    home: '/pt',
    families: '/pt/familias',
    events: '/pt/eventos',
    professionals: '/pt/profissionais',
    stories: '/pt/historias',
    story: '/pt/historias/aventura-espacial',
  },
} as const;

for (const [locale, pages] of Object.entries(PAGES)) {
  test.describe(`páginas públicas (${locale})`, () => {
    for (const [name, path] of Object.entries(pages)) {
      test(`${name}: carga, se lee sin scroll horizontal y pasa axe (WCAG 2.2 AA)`, async ({
        page,
      }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator('h1').first()).toBeVisible();
        expect(await page.locator('html').getAttribute('lang')).toMatch(new RegExp(`^${locale}`));
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
      });
    }

    test('la home es la puerta de entrada: tres públicos, cada uno con su landing y su creador', async ({
      page,
    }) => {
      await page.goto(pages.home);
      for (const [target, line] of [
        [pages.families, null],
        [pages.events, 'events'],
        [pages.professionals, 'professionals'],
      ] as const) {
        await page.goto(pages.home);
        // La tarjeta lleva a la landing del público (no directo al creador).
        await page
          .locator(`#audience ~ ul a[href="${target}"], ul a[href="${target}"]`)
          .first()
          .click();
        await expect(page).toHaveURL(new RegExp(`${target}$`));
        // Y la landing termina en su propio "Crear".
        const create = page
          .locator(
            line
              ? `a[href*="line=${line}"]:visible`
              : // Sin sesión, el botón de Familias lleva al login (y de ahí a Mis cuentos).
                'main a[href$="/ingresar"]:visible, main a[href$="/login"]:visible, main a[href$="/entrar"]:visible',
          )
          .last();
        await expect(create).toBeVisible();
      }
    });

    test('cada público llega a su creador (Familias, Eventos y Profesionales)', async ({
      page,
    }) => {
      for (const [path, line] of [
        [pages.events, 'events'],
        [pages.professionals, 'professionals'],
      ] as const) {
        await page.goto(path);
        const cta = page.locator(`a[href*="line=${line}"]:visible`).first();
        await expect(cta).toBeVisible();
      }
      await page.goto(pages.families);
      await expect(
        page
          .locator(
            'main a[href$="/ingresar"]:visible, main a[href$="/login"]:visible, main a[href$="/entrar"]:visible',
          )
          .first(),
      ).toBeVisible();
    });
  });
}

test('catálogo: "¿Qué le encanta?" desde Familias, temática y búsqueda sin tildes', async ({
  page,
}) => {
  await page.goto('/es/familias');
  await page.getByRole('link', { name: 'Los héroes y el deporte' }).click();
  await expect(page).toHaveURL(/tema=heroes/);
  const grid = page.locator('main');
  await expect(grid).toContainText('gol de campeón');
  await expect(grid).not.toContainText('La gran aventura espacial');

  await page.goto('/es/historias');
  await page.getByRole('searchbox', { name: 'Buscar una historia' }).fill('FUTBOL');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(/q=FUTBOL/);
  await expect(grid).toContainText('gol de campeón');
  await expect(grid).not.toContainText('La gran aventura espacial');
  await expectAccessible(page);
});

test('las historias de Eventos y Profesionales vuelven a su landing y crean en su línea', async ({
  page,
}) => {
  for (const [landing, line, back, create] of [
    ['/es/eventos', 'events', 'Volver a celebraciones', 'Inicia sesión para diseñar el kit'],
    ['/es/profesionales', 'professionals', 'Volver a profesionales', 'Inicia sesión para crear'],
  ] as const) {
    await page.goto(landing);
    await page.locator(`a[href*="line=${line}"][href*="/historias/"]`).first().click();
    // Sin sesión, el botón lleva al login (y de ahí a Mis cuentos), no al formulario.
    await expect(page.getByRole('link', { name: create })).toHaveAttribute(
      'href',
      /\/(ingresar|login|entrar)$/,
    );
    await page.getByRole('link', { name: back }).click();
    await expect(page).toHaveURL(new RegExp(`${landing}$`));
  }
});

test('el menú abre cada landing desde arriba (sin saltos de scroll)', async ({ page }, info) => {
  // En el celular el menú va en el panel desplegable.
  test.skip(info.project.name === 'movil');
  for (const name of ['Para familias', 'Para celebraciones', 'Para profesionales']) {
    await page.goto('/es');
    await page.locator('header').getByRole('link', { name }).click();
    await page.waitForURL((url) => url.pathname !== '/es');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(10);
  }
});

test('ficha profesional: objetivos propios en vez de enseñanzas generales; envío a calcular', async ({
  page,
}) => {
  await page.goto('/es/historias/mi-visita-al-dentista?line=professionals');
  await expect(page.getByRole('heading', { name: 'Qué trabaja este cuento' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Conocer el consultorio antes de ir');
  await expect(page.getByRole('heading', { name: 'Combínala con una enseñanza' })).toHaveCount(0);
  await expect(page.locator('main')).toContainText(
    'El costo de envío del libro impreso se calcula',
  );
  await expect(page.getByLabel('Enviar a')).toHaveCount(0);
  await expectAccessible(page);
});

test('preguntas frecuentes: la home destaca 4 y la página propia tiene todas y el contacto', async ({
  page,
}) => {
  await page.goto('/es');
  await expect(page.locator('body')).not.toContainText('hola@storynido.com');
  await expect(page.locator('#faq details')).toHaveCount(4);
  await page.getByRole('link', { name: /Ver todas las preguntas/ }).click();
  await expect(page).toHaveURL(/\/es\/preguntas-frecuentes$/);
  await expect(page.locator('h1')).toContainText('Preguntas frecuentes');
  expect(await page.locator('details').count()).toBeGreaterThan(10);
  const form = page.locator('#contact');
  await form.getByLabel('Tu nombre').fill('Laura');
  await form.getByLabel('Tu email').fill('laura@example.com');
  await form.getByLabel('¿Sobre qué es?').selectOption('order');
  await form.getByLabel('Tu mensaje').fill('¿Puedo cambiar la dirección de envío de mi pedido?');
  await expectAccessible(page);
  // Solo con la API local (mails simulados). Contra staging o cualquier ambiente real el
  // formulario manda un mail de verdad a soporte: ahí se verifica que exista, no se envía.
  if (process.env.E2E_START !== '1') {
    await expect(form.getByRole('button', { name: 'Enviar mensaje' })).toBeEnabled();
    return;
  }
  await form.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(form.getByRole('status')).toContainText('¡Mensaje enviado!');
});

test('el logo vuelve a la home: arriba de todo y sin hash', async ({ page }) => {
  await page.goto('/es');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  // Se baja por la página (sin hash) y se espera a que termine antes de volver con el logo.
  await page.evaluate(() => {
    window.scrollTo({ top: 1500, behavior: 'smooth' });
  });
  await expect
    .poll(async () => {
      const before = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(250);
      return before > 100 && before === (await page.evaluate(() => window.scrollY));
    })
    .toBe(true);
  await page.locator('header a').first().click();
  await expect(page).not.toHaveURL(/#/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
});

test('Empezar mi cuento: sin sesión lleva al login', async ({ page }) => {
  await page.goto('/es');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await expect(page.getByRole('link', { name: 'Empezar mi cuento' }).first()).toHaveAttribute(
    'href',
    /\/ingresar$/,
  );
});

test('¿Para quién es?: los links siguen andando al volver atrás desde una landing', async ({
  page,
}) => {
  await page.goto('/es');
  await page.getByRole('button', { name: 'Solo las necesarias' }).click();
  await page.locator('a[data-track-persona="families"]').click();
  await expect(page).toHaveURL(/\/es\/familias$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.locator('a[data-track-persona]')).toHaveCount(3);
  await page.locator('a[data-track-persona="events"]').click();
  await expect(page).toHaveURL(/\/es\/eventos$/);
});

test('idioma: visitar una página en otro idioma no lo fija; el aviso sugiere el del país', async ({
  page,
  context,
  baseURL,
}) => {
  // Desde Argentina (país detectado) con un link en inglés.
  await context.addCookies([{ name: 'sn_country_choice', value: 'AR', url: String(baseURL) }]);
  await page.goto('/en/stories');
  await page.getByRole('button', { name: 'Necessary only' }).click();
  const banner = page.getByRole('region', { name: 'Este sitio también está en español.' });
  await expect(banner).toBeVisible();
  // Haber visto la página en inglés no cambia el idioma de entrada.
  expect((await context.cookies()).some((cookie) => cookie.name === 'sn_lang')).toBe(false);

  await banner.getByRole('button', { name: 'Ver en español' }).click();
  await expect(page).toHaveURL(/\/es\/historias/);
  // Elegido a mano: la raíz respeta esa elección.
  await page.goto('/');
  await expect(page).toHaveURL(/\/es$/);
});
