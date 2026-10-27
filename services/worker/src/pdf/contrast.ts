/** Contraste WCAG 2.x entre dos colores sRGB (#rrggbb). */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((start) => {
      const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Color resultante de un fondo con opacidad `alpha` sobre otro (el peor caso: negro). */
export function blend(top: string, alpha: number, bottom = '#000000'): string {
  const channels = [1, 3, 5].map((start) =>
    Math.round(
      parseInt(top.slice(start, start + 2), 16) * alpha +
        parseInt(bottom.slice(start, start + 2), 16) * (1 - alpha),
    ),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
