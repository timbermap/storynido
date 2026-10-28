import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, securityHeaders } from './security-headers';

describe('cabeceras de seguridad', () => {
  it('CSP: solo la API, Firebase y reCAPTCHA; sin objetos ni iframes de terceros que nos embeban', () => {
    const csp = contentSecurityPolicy({
      apiUrl: 'https://api.storynido.com/v1',
      dev: false,
      analytics: false,
    });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://api.storynido.com');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('googletagmanager');
    expect(csp).not.toContain('localhost');
  });

  it('la analítica solo se permite donde se usa; en desarrollo, los emuladores', () => {
    expect(
      contentSecurityPolicy({ apiUrl: 'https://a.test', dev: false, analytics: true }),
    ).toContain('https://www.googletagmanager.com');
    const dev = contentSecurityPolicy({
      apiUrl: 'http://localhost:8080',
      dev: true,
      analytics: false,
    });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain('http://127.0.0.1:*');
  });

  it('HSTS, anti-iframe, nosniff y permisos del navegador cerrados', () => {
    const headers = Object.fromEntries(
      securityHeaders({ apiUrl: 'https://a.test', dev: false, analytics: false }).map((header) => [
        header.key,
        header.value,
      ]),
    );
    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });
});
