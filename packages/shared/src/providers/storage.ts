export const STORAGE_BUCKETS = ['photos', 'assets', 'pdfs'] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

export interface StorageObjectRef {
  bucket: StorageBucket;
  path: string;
}

export interface SignedUrl {
  url: string;
  /** Headers que el cliente debe enviar tal cual (por ejemplo Content-Type en una subida). */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StorageService {
  readonly id: string;
  upload(ref: StorageObjectRef, bytes: Uint8Array, contentType: string): Promise<void>;
  download(ref: StorageObjectRef): Promise<Uint8Array>;
  exists(ref: StorageObjectRef): Promise<boolean>;
  delete(ref: StorageObjectRef): Promise<void>;
  /** URL de subida directa desde el navegador, de corta duración. */
  signedUploadUrl(
    ref: StorageObjectRef,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUrl>;
  /** URL de descarga de corta duración. */
  signedDownloadUrl(
    ref: StorageObjectRef,
    expiresInSeconds: number,
    downloadName?: string,
  ): Promise<SignedUrl>;
}

/** Rechaza rutas peligrosas (absolutas, con `..` o vacías). */
export function assertSafeObjectPath(path: string): void {
  if (
    path.length === 0 ||
    path.length > 1024 ||
    path.startsWith('/') ||
    path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Ruta de objeto inválida: "${path}"`);
  }
}
