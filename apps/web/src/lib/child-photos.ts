import { PHOTO_CONSENT_VERSION, PHOTO_RULES, type Locale } from '@storynido/shared';

import { api } from '@/lib/api';

/**
 * Sube una foto solo para el personaje (sin cuento): consentimiento, URL firmada, subida y
 * validación. La usan «Agregar a otro chico» y el perfil del personaje.
 */
export async function uploadChildPhoto(childId: string, photo: File, locale: Locale) {
  const { consentId } = await api('createConsent', {
    body: { type: 'photo_upload', textVersion: PHOTO_CONSENT_VERSION, locale },
  });
  const { photoId, upload } = await api('createPhoto', {
    body: {
      childId,
      consentId,
      contentType: photo.type as (typeof PHOTO_RULES.allowedTypes)[number],
      sizeBytes: photo.size,
    },
  });
  const put = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: photo });
  if (!put.ok) throw new Error('upload');
  return api('processPhoto', { params: { photoId } });
}

/** Solo los archivos que se pueden subir (tipo y tamaño). */
export function acceptedPhotos(list: FileList | null): File[] {
  return Array.from(list ?? []).filter(
    (item) =>
      (PHOTO_RULES.allowedTypes as readonly string[]).includes(item.type) &&
      item.size <= PHOTO_RULES.maxBytes,
  );
}
