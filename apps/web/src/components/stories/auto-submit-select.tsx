'use client';

import type { ComponentProps } from 'react';

/**
 * Select que envía su formulario al cambiar (filtro de edad del catálogo). Sin JavaScript se
 * envía con el botón de buscar del mismo formulario.
 */
export function AutoSubmitSelect(props: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      onChange={(event) => {
        event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
