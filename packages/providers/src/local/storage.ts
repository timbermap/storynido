import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  STORAGE_BUCKETS,
  assertSafeObjectPath,
  type SignedUrl,
  type StorageBucket,
  type StorageObjectRef,
  type StorageService,
} from '@storynido/shared';

import { hmacHex, safeEqualHex } from '../crypto';

export type SignedOperation = 'get' | 'put';

export interface SignedRequestParams {
  op: SignedOperation;
  bucket: string;
  path: string;
  exp: number;
  ct: string;
  sig: string;
}

export interface LocalStorageOptions {
  /** Carpeta donde se guardan los archivos (fuera del repo o ignorada por git). */
  rootDir: string;
  /** URL base de la API que sirve /dev/storage (solo desarrollo). */
  publicBaseUrl: string;
  secret: string;
  now?: () => number;
}

/**
 * Storage en el disco local que imita las URLs firmadas de Cloud Storage.
 * La API expone /dev/storage para subir y descargar con esas URLs (solo fuera de producción).
 */
export class LocalStorageService implements StorageService {
  readonly id = 'local';
  private readonly now: () => number;

  constructor(private readonly options: LocalStorageOptions) {
    this.now = options.now ?? Date.now;
  }

  private filePath(ref: StorageObjectRef): string {
    assertSafeObjectPath(ref.path);
    return path.join(this.options.rootDir, ref.bucket, ref.path);
  }

  async upload(ref: StorageObjectRef, bytes: Uint8Array, contentType: string): Promise<void> {
    const file = this.filePath(ref);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeFile(`${file}.meta.json`, JSON.stringify({ contentType }));
  }

  async download(ref: StorageObjectRef): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.filePath(ref)));
  }

  async contentType(ref: StorageObjectRef): Promise<string> {
    try {
      const meta = JSON.parse(await readFile(`${this.filePath(ref)}.meta.json`, 'utf8')) as {
        contentType?: string;
      };
      return meta.contentType ?? 'application/octet-stream';
    } catch {
      return 'application/octet-stream';
    }
  }

  async exists(ref: StorageObjectRef): Promise<boolean> {
    try {
      return (await stat(this.filePath(ref))).isFile();
    } catch {
      return false;
    }
  }

  async delete(ref: StorageObjectRef): Promise<void> {
    const file = this.filePath(ref);
    await rm(file, { force: true });
    await rm(`${file}.meta.json`, { force: true });
  }

  private sign(
    op: SignedOperation,
    ref: StorageObjectRef,
    expiresInSeconds: number,
    contentType: string,
  ): SignedUrl {
    assertSafeObjectPath(ref.path);
    const exp = Math.floor(this.now() / 1000) + expiresInSeconds;
    const sig = hmacHex(
      this.options.secret,
      [op, ref.bucket, ref.path, exp, contentType].join('|'),
    );
    const url = new URL(`/dev/storage/${ref.bucket}/${ref.path}`, this.options.publicBaseUrl);
    url.search = new URLSearchParams({ op, exp: String(exp), ct: contentType, sig }).toString();
    return {
      url: url.toString(),
      headers: op === 'put' ? { 'content-type': contentType } : {},
      expiresAt: new Date(exp * 1000),
    };
  }

  signedUploadUrl(
    ref: StorageObjectRef,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUrl> {
    return Promise.resolve(this.sign('put', ref, expiresInSeconds, contentType));
  }

  signedDownloadUrl(ref: StorageObjectRef, expiresInSeconds: number): Promise<SignedUrl> {
    return Promise.resolve(this.sign('get', ref, expiresInSeconds, ''));
  }

  /** Valida una request a /dev/storage: firma correcta, no vencida y bucket conocido. */
  verifySignedRequest(params: SignedRequestParams): StorageObjectRef | null {
    if (!(STORAGE_BUCKETS as readonly string[]).includes(params.bucket)) return null;
    if (!Number.isInteger(params.exp) || params.exp * 1000 < this.now()) return null;
    try {
      assertSafeObjectPath(params.path);
    } catch {
      return null;
    }
    const expected = hmacHex(
      this.options.secret,
      [params.op, params.bucket, params.path, params.exp, params.ct].join('|'),
    );
    if (!safeEqualHex(params.sig, expected)) return null;
    return { bucket: params.bucket as StorageBucket, path: params.path };
  }
}
