import type { BookFormat } from '@storynido/shared';

interface Item {
  format: BookFormat | 'card';
  quantity: number;
}

/**
 * Con qué arranca «otra copia» de un pedido: solo impresa (el PDF ya lo tiene y se descarga
 * gratis). Un libro creado en digital tiene ilustraciones de pantalla y no se imprime. Si el
 * formato que compró se sigue imprimiendo en el país, arranca en ese; si no, en el más barato.
 */
export function reorderStart(
  items: readonly Item[],
  printOptions: readonly { format: BookFormat; amountMinor: number }[],
): { kind: 'digital_only' } | { kind: 'no_print' } | { kind: 'print'; format: BookFormat } {
  const book = items.filter(
    (item): item is { format: BookFormat; quantity: number } => item.format !== 'card',
  );
  if (!book.some((item) => item.format !== 'digital')) return { kind: 'digital_only' };
  const prints = printOptions.filter((option) => option.format !== 'digital');
  const bought = prints.find((option) => book.some((item) => item.format === option.format));
  const cheapest = [...prints].sort((a, b) => a.amountMinor - b.amountMinor)[0];
  const format = bought?.format ?? cheapest?.format;
  return format ? { kind: 'print', format } : { kind: 'no_print' };
}
