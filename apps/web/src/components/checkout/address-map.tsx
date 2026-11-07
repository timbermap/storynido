'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import {
  MAPS_MAP_ID,
  mapLibraries,
  type LatLng,
  type MapLike,
  type MarkerLike,
} from '@/lib/google-maps';

const read = (position: MarkerLike['position']): LatLng | null => {
  if (!position) return null;
  return typeof position.lat === 'function'
    ? { lat: position.lat(), lng: (position.lng as () => number)() }
    : (position as LatLng);
};

/**
 * Mapa chico con el pin de la dirección elegida. El pin se arrastra para marcar la puerta exacta;
 * mover el pin no cambia el texto de la dirección (la imprenta recibe el texto).
 */
export function AddressMap({
  location,
  language,
  onMove,
  onUnavailable,
}: {
  location: LatLng;
  language: string;
  onMove: (position: LatLng) => void;
  onUnavailable: () => void;
}) {
  const t = useTranslations('Checkout.address.map');
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<MapLike | null>(null);
  const marker = useRef<MarkerLike | null>(null);
  const [ready, setReady] = useState(false);
  const moveRef = useRef(onMove);
  useEffect(() => {
    moveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      try {
        const { maps, marker: markers } = await mapLibraries(language);
        if (run.cancelled || !element.current) return;
        map.current = new maps.Map(element.current, {
          center: location,
          zoom: 17,
          mapId: MAPS_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          clickableIcons: false,
        });
        marker.current = new markers.AdvancedMarkerElement({
          map: map.current,
          position: location,
          gmpDraggable: true,
          title: t('pin'),
        });
        marker.current.addListener('dragend', () => {
          const position = read(marker.current?.position ?? null);
          if (position) moveRef.current(position);
        });
        setReady(true);
      } catch {
        if (!run.cancelled) onUnavailable();
      }
    })();
    return () => {
      run.cancelled = true;
    };
    // El mapa se crea una vez; los cambios de ubicación se aplican abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    if (!ready || !marker.current || !map.current) return;
    marker.current.position = location;
    map.current.setCenter(location);
  }, [ready, location]);

  return (
    <div className="grid gap-1.5">
      <div
        ref={element}
        role="region"
        aria-label={t('label')}
        className="h-44 w-full overflow-hidden rounded-xl border bg-muted"
      />
      <span className="text-xs text-muted-foreground">{t('hint')}</span>
    </div>
  );
}
