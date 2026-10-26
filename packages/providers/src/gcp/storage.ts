import { Storage } from '@google-cloud/storage';
import {
  assertSafeObjectPath,
  type SignedUrl,
  type StorageBucket,
  type StorageObjectRef,
  type StorageService,
} from '@storynido/shared';

/**
 * Cloud Storage. Las URLs firmadas (v4) se firman con la cuenta de servicio del
 * servicio (signBlob), que tiene permiso de "token creator" sobre sí misma.
 */
export class GcsStorageService implements StorageService {
  readonly id = 'gcs';
  private readonly storage = new Storage();

  constructor(private readonly buckets: Record<StorageBucket, string>) {}

  private file(ref: StorageObjectRef) {
    assertSafeObjectPath(ref.path);
    return this.storage.bucket(this.buckets[ref.bucket]).file(ref.path);
  }

  async upload(ref: StorageObjectRef, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.file(ref).save(Buffer.from(bytes), { contentType, resumable: false });
  }

  async download(ref: StorageObjectRef): Promise<Uint8Array> {
    const [data] = await this.file(ref).download();
    return new Uint8Array(data);
  }

  async exists(ref: StorageObjectRef): Promise<boolean> {
    const [exists] = await this.file(ref).exists();
    return exists;
  }

  async delete(ref: StorageObjectRef): Promise<void> {
    await this.file(ref).delete({ ignoreNotFound: true });
  }

  async signedUploadUrl(
    ref: StorageObjectRef,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUrl> {
    const expires = Date.now() + expiresInSeconds * 1000;
    const [url] = await this.file(ref).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType,
    });
    return { url, headers: { 'content-type': contentType }, expiresAt: new Date(expires) };
  }

  async signedDownloadUrl(
    ref: StorageObjectRef,
    expiresInSeconds: number,
    downloadName?: string,
  ): Promise<SignedUrl> {
    const expires = Date.now() + expiresInSeconds * 1000;
    const [url] = await this.file(ref).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires,
      ...(downloadName ? { responseDisposition: `attachment; filename="${downloadName}"` } : {}),
    });
    return { url, headers: {}, expiresAt: new Date(expires) };
  }
}
