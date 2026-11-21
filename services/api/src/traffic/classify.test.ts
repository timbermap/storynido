import { describe, expect, it } from 'vitest';

import { buildReportForTest } from './report-test-helper';
import {
  campaignKey,
  classifyDevice,
  classifySource,
  cleanCountry,
  cleanPath,
  decodeKey,
  detailKey,
  encodeKey,
} from './classify';

describe('classifySource', () => {
  it('reconoce redes por utm_source y por dominio', () => {
    expect(classifySource('IG', null)).toBe('instagram');
    expect(classifySource(null, 'https://l.instagram.com/')).toBe('instagram');
    expect(classifySource(null, 'wa.me')).toBe('whatsapp');
    expect(classifySource(null, 'www.google.com.ar')).toBe('google');
    expect(classifySource('newsletter', null)).toBe('email');
  });
  it('usa el identificador de clic solo si no hay una pista mejor', () => {
    expect(classifySource(null, null, 'ttclid')).toBe('tiktok');
    expect(classifySource(null, null, 'epik')).toBe('pinterest');
    expect(classifySource(null, 'blog.ejemplo.com', 'fbclid')).toBe('facebook');
    expect(classifySource('whatsapp', null, 'fbclid')).toBe('whatsapp');
    expect(classifySource(null, 'l.instagram.com', 'fbclid')).toBe('instagram');
  });
  it('sin pista es directo, y un dominio desconocido queda como referente', () => {
    expect(classifySource(null, null)).toBe('direct');
    expect(classifySource(null, 'blog.ejemplo.com')).toBe('ref:blog.ejemplo.com');
    expect(classifySource('mi_alianza', null)).toBe('mi_alianza');
  });
});

describe('campaignKey y rutas', () => {
  it('arma la clave de campaña y la limpia', () => {
    expect(campaignKey('instagram', 'Social', 'Dia del Niño!')).toBe(
      'instagram/social/dia-del-ni-o',
    );
    expect(campaignKey('direct', null, null)).toBeNull();
  });
  it('quita el idioma y los parámetros de la ruta', () => {
    expect(cleanPath('/es/como-funciona?utm_source=x')).toBe('/como-funciona');
    expect(cleanPath('/en')).toBe('/');
    expect(cleanPath('/pt/eventos/')).toBe('/eventos');
  });
  it('arma la clave de pieza y palabra', () => {
    expect(detailKey('instagram', 'Reel Cumple 1')).toBe('instagram/reel-cumple-1');
    expect(detailKey('instagram', null)).toBeNull();
  });
  it('codifica claves de mapa sin puntos ni barras', () => {
    expect(decodeKey(encodeKey('ref:a.b/c'))).toBe('ref:a.b/c');
    expect(encodeKey('x/y.z')).not.toMatch(/[./]/);
  });
  it('país inválido pasa a ZZ', () => {
    expect(cleanCountry('ar')).toBe('AR');
    expect(cleanCountry('xyz')).toBe('ZZ');
  });
});

describe('classifyDevice', () => {
  it('distingue celular, tableta, computadora y robots', () => {
    expect(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari')).toBe('mobile');
    expect(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
    expect(classifyDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe('desktop');
    expect(classifyDevice('Googlebot/2.1')).toBeNull();
    expect(classifyDevice(undefined)).toBeNull();
  });
});

describe('buildReport', () => {
  it('suma los días y arma el embudo por fuente', () => {
    const report = buildReportForTest();
    expect(report.totals).toEqual({ views: 7, entries: 3, campaignEntries: 2 });
    expect(report.pages[0]).toMatchObject({ key: '/', views: 5, entries: 3 });
    expect(report.funnelBySource[0]).toMatchObject({
      key: 'instagram',
      entries: 2,
      create_started: 2,
      purchase: 1,
    });
    expect(report.contents[0]).toMatchObject({ key: 'instagram/reel-1', views: 2 });
    expect(report.terms[0]?.key).toBe('instagram/cumple');
    expect(report.funnelByCampaign[0]?.key).toBe('instagram/social/verano');
  });
});
