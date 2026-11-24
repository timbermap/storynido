'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Botón principal de la ficha + barra fija en el celular. La barra aparece solo cuando el botón
 * de arriba salió de la pantalla, así el llamado a crear queda siempre a un toque (y no se
 * duplica mientras se ve el original). En pantallas anchas la barra no existe.
 */
export function StickyCta({ cta, bar }: { cta: ReactNode; bar: ReactNode }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    const node = anchor.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      // Fuera de pantalla por arriba (ya se pasó): barra. Por abajo (todavía no llegó): no.
      setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={anchor}>{cta}</div>
      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
          {bar}
        </div>
      )}
    </>
  );
}
