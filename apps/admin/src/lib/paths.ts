/** Lectura y escritura por ruta con puntos ("shipping.costMinor") sobre objetos planos. */
export function getPath(data: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      data,
    );
}

export function setPath(
  data: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [key, ...rest] = path.split('.');
  if (!key) return data;
  if (rest.length === 0) return { ...data, [key]: value };
  const inner = data[key];
  return {
    ...data,
    [key]: setPath(
      inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : {},
      rest.join('.'),
      value,
    ),
  };
}
