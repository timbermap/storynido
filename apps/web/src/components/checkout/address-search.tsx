'use client';

import { Loader2, MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import {
  parseAddressComponents,
  placesLibrary,
  type LatLng,
  type ParsedAddress,
  type PlacePredictionLike,
} from '@/lib/google-maps';
import { cn } from '@/lib/utils';

export interface PickedAddress extends ParsedAddress {
  placeId: string;
  location: LatLng | null;
}

/**
 * Buscador de la dirección con las sugerencias de Google, limitadas al país del envío. Cada
 * sugerencia muestra la ciudad y la provincia, para no confundir dos calles con el mismo nombre.
 * Una sesión (token) por dirección elegida: así Google cobra solo el detalle del lugar.
 */
export function AddressSearch({
  country,
  language,
  onPick,
  onUnavailable,
}: {
  country: string;
  language: string;
  onPick: (address: PickedAddress) => void;
  /** Google no cargó (clave, cuota o red): se sigue con la carga manual. */
  onUnavailable: () => void;
}) {
  const t = useTranslations('Checkout.address.search');
  const listId = useId();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PlacePredictionLike[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const session = useRef<object | null>(null);
  // Con menos de 3 letras no se busca ni se muestra nada.
  const visible = query.trim().length >= 3 ? options : [];
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const input = query.trim();
    if (input.length < 3) return;
    const run = { cancelled: false };
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const places = await placesLibrary(language);
          session.current ??= new places.AutocompleteSessionToken();
          const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: session.current,
            includedRegionCodes: [country.toLowerCase()],
            language,
          });
          if (run.cancelled) return;
          setOptions(
            suggestions
              .map((suggestion) => suggestion.placePrediction)
              .filter((prediction): prediction is PlacePredictionLike => prediction !== null)
              .slice(0, 5),
          );
          setActive(-1);
          setOpen(true);
        } catch {
          if (!run.cancelled) onUnavailable();
        }
      })();
    }, 250);
    return () => {
      run.cancelled = true;
      clearTimeout(timer);
    };
  }, [query, country, language, onUnavailable]);

  async function choose(prediction: PlacePredictionLike) {
    setOpen(false);
    setBusy(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'location'] });
      const location = place.location
        ? { lat: place.location.lat(), lng: place.location.lng() }
        : null;
      picked.current = true;
      setQuery(
        [prediction.mainText?.text, prediction.secondaryText?.text].filter(Boolean).join(', '),
      );
      onPick({
        ...parseAddressComponents(place.addressComponents ?? []),
        placeId: prediction.placeId,
        location,
      });
    } catch {
      onUnavailable();
    } finally {
      // La sesión termina al pedir el detalle: la próxima búsqueda es otra sesión.
      session.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="relative grid gap-1.5 text-sm sm:col-span-2">
      <label htmlFor="address-search" className="font-semibold">
        {t('label')}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="address-search"
          role="combobox"
          aria-expanded={open && visible.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${String(active)}` : undefined}
          autoComplete="off"
          placeholder={t('placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onFocus={() => {
            if (visible.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Deja terminar el clic en una sugerencia.
            setTimeout(() => {
              setOpen(false);
            }, 150);
          }}
          onKeyDown={(event) => {
            if (!open || visible.length === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current) => (current + 1) % visible.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => (current <= 0 ? visible.length - 1 : current - 1));
            } else if (event.key === 'Enter' && active >= 0) {
              event.preventDefault();
              const option = visible[active];
              if (option) void choose(option);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="h-11 w-full rounded-xl border bg-card pr-10 pl-9"
        />
        {busy && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      {open && visible.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border bg-card shadow-lg"
        >
          {visible.map((option, index) => (
            <li
              key={option.placeId}
              id={`${listId}-${String(index)}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                void choose(option);
              }}
              className={cn(
                'flex cursor-pointer items-start gap-2 px-3 py-2',
                index === active && 'bg-muted',
              )}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block font-semibold">{option.mainText?.text}</span>
                <span className="block text-muted-foreground">{option.secondaryText?.text}</span>
              </span>
            </li>
          ))}
          <li className="px-3 py-1 text-right text-[11px] text-muted-foreground">
            {t('poweredBy')}
          </li>
        </ul>
      )}
      <span className="text-xs text-muted-foreground">{t('hint')}</span>
    </div>
  );
}
