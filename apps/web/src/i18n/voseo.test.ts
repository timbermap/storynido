import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { mergeMessages, usesVoseo } from './voseo';

interface Messages {
  [key: string]: string | Messages;
}

const MESSAGES = path.resolve(__dirname, '../../messages');
const read = (name: string) =>
  JSON.parse(readFileSync(path.join(MESSAGES, name), 'utf8')) as Messages;

function leaves(node: Messages, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value, `${prefix}${key}.`),
  );
}

const placeholders = (text: string) => [...text.matchAll(/[{<][\w/]+/g)].map((m) => m[0]).sort();

describe('voseo para Argentina y Uruguay', () => {
  const es = new Map(leaves(read('es.json')));
  const voseo = leaves(read('es-voseo.json'));

  it('solo aplica al español de AR y UY', () => {
    expect(usesVoseo('es', 'AR')).toBe(true);
    expect(usesVoseo('es', 'UY')).toBe(true);
    expect(usesVoseo('es', 'MX')).toBe(false);
    expect(usesVoseo('pt', 'AR')).toBe(false);
    expect(usesVoseo('es', null)).toBe(false);
  });

  it('cada texto con voseo existe en es.json y conserva sus variables y etiquetas', () => {
    expect(voseo.length).toBeGreaterThan(100);
    for (const [key, text] of voseo) {
      const base = es.get(key);
      expect(base, key).toBeDefined();
      expect(placeholders(text), key).toEqual(placeholders(base ?? ''));
    }
  });

  it('pisa solo las claves del archivo de voseo', () => {
    const merged = mergeMessages(
      { Home: { a: 'Elige', b: 'Hola' }, Nav: { c: 'x' } },
      { Home: { a: 'Elegí' } },
    );
    expect(merged).toEqual({ Home: { a: 'Elegí', b: 'Hola' }, Nav: { c: 'x' } });
  });
});
