import { chromium } from '@playwright/test';
const pages = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
for (const path of pages) {
  const p = await ctx.newPage();
  const res = await p.goto('https://staging.storynido.com' + path, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await p.waitForTimeout(2500);
  const btn = p.getByRole('button', { name: /Solo las necesarias/ });
  if (await btn.count())
    await btn
      .first()
      .click()
      .catch(() => {});
  const info = await p.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('main *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > W + 1 && !el.closest('[class*="overflow"]');
      })
      .slice(0, 3)
      .map((el) => el.tagName + '.' + String(el.className).slice(0, 50));
    const small = [...document.querySelectorAll('main a, main button, main select, main input')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const inline = getComputedStyle(el).display === 'inline';
        return !inline && r.width > 1 && r.height > 1 && (r.height < 24 || r.width < 24);
      })
      .slice(0, 4)
      .map(
        (el) =>
          (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 25) +
          ' ' +
          Math.round(el.getBoundingClientRect().height),
      );
    return { overflow: document.documentElement.scrollWidth > W, wide, small };
  });
  console.log(res?.status(), path, JSON.stringify(info));
  await p.screenshot({
    path:
      '/tmp/claude-501/-Users-snojekba-Documents-13-AI-book/f2f8398d-c3b7-472a-8b0c-e5ce8be6a80a/scratchpad/mob/' +
      path.replace(/[\/?=&]/g, '_') +
      '.png',
  });
  await p.close();
}
await b.close();
