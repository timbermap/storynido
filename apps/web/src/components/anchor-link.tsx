'use client';

import type { ComponentProps } from 'react';

/**
 * Ancla dentro de la página que baja con scroll sin crear una entrada en el historial. Con un
 * `<a href="#x">` nativo, al volver atrás desde otra página Next mostraba la página equivocada
 * bajo la URL con hash. El `href` queda para quien no tiene JavaScript.
 */
export function AnchorLink({
  target,
  onClick,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & { target: string }) {
  return (
    <a
      {...props}
      href={`#${target}`}
      onClick={(event) => {
        onClick?.(event);
        const element = document.getElementById(target);
        if (event.defaultPrevented || !element) return;
        event.preventDefault();
        // Sin `behavior`: respeta el scroll suave de la hoja de estilos y "reducir movimiento".
        element.scrollIntoView();
      }}
    />
  );
}
