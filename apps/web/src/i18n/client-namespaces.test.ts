import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLIENT_NAMESPACES } from './client-namespaces';

const SRC = path.resolve(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [full] : [];
  });
}

describe('mensajes del navegador', () => {
  it('cada namespace que usa un componente de cliente viaja al navegador', () => {
    const missing = new Set<string>();
    for (const file of files(SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!/^['"]use client['"]/m.test(source)) continue;
      for (const match of source.matchAll(/useTranslations\(\s*['"]([A-Za-z]+)/g)) {
        const namespace = match[1] ?? '';
        if (!(CLIENT_NAMESPACES as readonly string[]).includes(namespace)) {
          missing.add(`${namespace} (${path.relative(SRC, file)})`);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
