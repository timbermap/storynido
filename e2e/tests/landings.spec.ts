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
        page.locator('a[href*="/cre"]:visible, a[href*="/criar"]:visible').first(),
      ).toBeVisible();
    });
  });
}
