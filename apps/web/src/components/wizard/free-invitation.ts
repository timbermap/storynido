/**
 * La invitación gratis para WhatsApp (DECISIONS 356): la misma imagen 4:5 de 1080×1350 que trae el
 * kit, armada en el navegador con la portada aprobada. Abajo lleva una franja de StoryNido con la
 * fecha, la hora y el lugar adentro, así no se puede recortar la marca sin perder los datos de la
 * fiesta. Al pagar, la invitación del kit sale limpia (la arma el worker, sin franja).
 */

export const FREE_INVITATION_SIZE = { width: 1080, height: 1350 } as const;

const INK = '#342a40';
const LAVENDER = '#79518c';
const PAPER = '#fffaf3';
/** Coral tinta de Celebraciones (docs/BRAND.md). */
const BAND = '#a33f33';
const BAND_LABEL = '#f6d9cf';
const BAND_SOFT = '#fde9e2';

export interface FreeInvitationText {
  heading: string;
  invite: string;
  /** Renglones de la franja: etiqueta en mayúsculas y valor («CUÁNDO sábado 13 de diciembre»). */
  details: readonly { label: string; value: string }[];
  /** «Invitación gratis · hacé la tuya en storynido.com». */
  brand: string;
}

export interface FreeInvitationFonts {
  display: string;
  body: string;
}

const ART_HEIGHT = 760;

/** Parte un texto en renglones que entran en `maxWidth` (sin cortar palabras salvo que no quede otra). */
export function wrapLines(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Dibuja la invitación gratis. `art` ya cargada (con `crossOrigin` para poder exportar el canvas). */
export function drawFreeInvitation(
  ctx: CanvasRenderingContext2D,
  art: CanvasImageSource & { width: number; height: number },
  text: FreeInvitationText,
  fonts: FreeInvitationFonts,
): void {
  const { width, height } = FREE_INVITATION_SIZE;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  // Dibujo arriba, a sangre: «object-fit: cover» centrado un poco abajo (la cara suele estar ahí).
  const scale = Math.max(width / art.width, ART_HEIGHT / art.height);
  const drawW = art.width * scale;
  const drawH = art.height * scale;
  const dx = (width - drawW) / 2;
  const dy = (ART_HEIGHT - drawH) * 0.75;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, ART_HEIGHT);
  ctx.clip();
  ctx.drawImage(art, dx, dy, drawW, drawH);
  ctx.restore();

  // Franja de abajo: primero se mide, para saber cuánto alto le queda al título.
  const padX = 56;
  const maxText = width - padX * 2;
  const detailSize = 31;
  const lineHeight = Math.round(detailSize * 1.4);
  ctx.font = `400 ${String(detailSize)}px ${fonts.body}`;
  const detailLines = text.details.flatMap(({ label, value }) => {
    const labelText = `${label.toUpperCase()}  `;
    ctx.font = `700 22px ${fonts.body}`;
    const labelWidth = ctx.measureText(labelText).width;
    ctx.font = `400 ${String(detailSize)}px ${fonts.body}`;
    const rows = wrapLines((s) => ctx.measureText(s).width, value, maxText - labelWidth).slice(
      0,
      2,
    );
    return rows.map((row, index) => ({ label: index === 0 ? labelText : '', row }));
  });
  const brandSize = 24;
  const bandHeight = 30 + detailLines.length * lineHeight + 16 + 2 + 14 + brandSize + 26;
  const bandTop = height - bandHeight;

  // Título y frase, centrados entre el dibujo y la franja.
  const headingSize = 76;
  ctx.font = `700 ${String(headingSize)}px ${fonts.display}`;
  const headingLines = wrapLines((s) => ctx.measureText(s).width, text.heading, maxText).slice(
    0,
    2,
  );
  const inviteSize = 36;
  ctx.font = `700 ${String(inviteSize)}px ${fonts.body}`;
  const inviteLines = wrapLines((s) => ctx.measureText(s).width, text.invite, maxText).slice(0, 2);
  const headingLH = Math.round(headingSize * 1.08);
  const inviteLH = Math.round(inviteSize * 1.3);
  const blockH = headingLines.length * headingLH + 14 + inviteLines.length * inviteLH;
  let y = ART_HEIGHT + (bandTop - ART_HEIGHT - blockH) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `700 ${String(headingSize)}px ${fonts.display}`;
  for (const line of headingLines) {
    ctx.fillText(line, width / 2, y);
    y += headingLH;
  }
  y += 14;
  ctx.fillStyle = LAVENDER;
  ctx.font = `700 ${String(inviteSize)}px ${fonts.body}`;
  for (const line of inviteLines) {
    ctx.fillText(line, width / 2, y);
    y += inviteLH;
  }

  // La franja con los datos y la marca.
  ctx.fillStyle = BAND;
  ctx.fillRect(0, bandTop, width, bandHeight);
  y = bandTop + 30;
  for (const { label, row } of detailLines) {
    ctx.font = `700 22px ${fonts.body}`;
    const labelWidth = label ? ctx.measureText(label).width : 0;
    ctx.font = `400 ${String(detailSize)}px ${fonts.body}`;
    const rowWidth = ctx.measureText(row).width;
    const start = (width - labelWidth - rowWidth) / 2;
    ctx.textAlign = 'left';
    if (label) {
      ctx.fillStyle = BAND_LABEL;
      ctx.font = `700 22px ${fonts.body}`;
      ctx.fillText(label, start, y + (detailSize - 22) * 0.8);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `400 ${String(detailSize)}px ${fonts.body}`;
    ctx.fillText(row, start + labelWidth, y);
    y += lineHeight;
  }
  y += 16;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(padX, y, width - padX * 2, 2);
  y += 2 + 14;
  ctx.textAlign = 'center';
  ctx.fillStyle = BAND_SOFT;
  ctx.font = `600 ${String(brandSize)}px ${fonts.body}`;
  const brand = `✦ StoryNido · ${text.brand}`;
  ctx.fillText(brand, width / 2, y, maxText);
}
