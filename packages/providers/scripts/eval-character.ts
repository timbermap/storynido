/**
 * Evaluación de consistencia del personaje (fase 07): genera el mismo chico en varias
 * escenas con distintos modelos y estilos de Vertex AI, y arma un reporte HTML comparativo.
 *
 *   pnpm eval:character --photo retrato.jpg                  # solo estima el costo
 *   pnpm eval:character --photo retrato.jpg --yes            # genera (cuesta dinero)
 *
 * Opciones: --models a,b · --styles acuarela,cartoon-3d · --scenes 3 · --budget 2 (USD, tope)
 * Credenciales: token de gcloud con la configuración "storynido" (nunca la de Timbermap).
 * La foto debe ser de un chico con consentimiento del adulto, o un retrato sintético.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { describeCharacterSheet, type ImageData } from '@storynido/shared';
import sharp from 'sharp';

import {
  VERTEX_PRICES,
  VertexClient,
  VertexImageProvider,
  VertexTextProvider,
} from '../src/gcp/vertex';

const STYLES: Record<string, string> = {
  acuarela: 'soft watercolor children book illustration, gentle textures, pastel palette',
  'cartoon-3d': '3D animated movie style, soft lighting, rounded shapes, vibrant colors',
  'cuento-clasico': 'classic storybook illustration, ink lines and gouache, warm vintage tones',
  'lapices-de-colores': 'colored pencil drawing, hand-drawn texture, cheerful and simple',
};

const SCENES = [
  'Book cover: the child as the hero of a space adventure, waving from a cardboard rocket among pastel planets.',
  'The child kneels in a garden, gently holding a speckled dinosaur egg, looking surprised and happy.',
  'The child laughs while running on a beach at sunset with a small dog.',
  'The child reads a book in bed with a flashlight, a cat curled at their feet.',
  'The child, wearing a raincoat, jumps into a puddle in a cozy town street.',
];

/** Tokens de salida típicos de una imagen 1K. */
const IMAGE_TOKENS = 1120;
/** Entrada típica: foto + portada de referencia + texto (cada imagen ~1.100 tokens). */
const INPUT_TOKENS = 2600;

const { values } = parseArgs({
  options: {
    photo: { type: 'string' },
    models: { type: 'string', default: 'gemini-3.1-flash-image,gemini-3-pro-image' },
    styles: { type: 'string', default: 'acuarela,cartoon-3d' },
    scenes: { type: 'string', default: '3' },
    budget: { type: 'string', default: '2' },
    project: { type: 'string', default: 'storynido-staging' },
    out: { type: 'string', default: 'eval-reports' },
    yes: { type: 'boolean', default: false },
  },
});

if (!values.photo) {
  console.error('Falta --photo <retrato.jpg> (foto con consentimiento o retrato sintético).');
  process.exit(1);
}
if (values.project.startsWith('timbermap')) {
  console.error('Este script nunca corre contra proyectos de Timbermap.');
  process.exit(1);
}

const models = values.models.split(',').filter(Boolean);
const styles = values.styles.split(',').filter(Boolean);
const scenes = SCENES.slice(0, Math.min(Number(values.scenes), SCENES.length));
const budgetUsd = Number(values.budget);

for (const style of styles) {
  if (!STYLES[style]) throw new Error(`Estilo desconocido: ${style}`);
}

const estimate = models.reduce((total, model) => {
  const price = VERTEX_PRICES[model] ?? { input: 2, output: 120 };
  const perImage = IMAGE_TOKENS * price.output + INPUT_TOKENS * price.input;
  return total + (styles.length * scenes.length * perImage) / 1_000_000;
}, 0);
const images = models.length * styles.length * scenes.length;

console.log(
  `Plan: ${String(images)} imágenes (${models.join(', ')} × ${styles.join(', ')} × ${String(scenes.length)} escenas)`,
);
console.log(
  `Costo estimado: USD ${estimate.toFixed(2)} (+ ~USD 0,01 de texto) · tope: USD ${budgetUsd.toFixed(2)}`,
);
if (!values.yes) {
  console.log('Sin --yes no se genera nada.');
  process.exit(0);
}
if (estimate > budgetUsd) {
  console.error(
    'La estimación supera el tope: reducí modelos, estilos o escenas, o subí --budget.',
  );
  process.exit(1);
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
  env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'storynido' },
})
  .toString()
  .trim();

const photoBytes = await sharp(readFileSync(values.photo))
  .rotate()
  .resize(1024, 1024, { fit: 'cover' })
  .jpeg({ quality: 90 })
  .toBuffer();
const photo: ImageData = { bytes: new Uint8Array(photoBytes), mimeType: 'image/jpeg' };

const outDir = path.resolve(values.out, new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'photo.jpg'), photoBytes);

let spentMicros = 0;
const client = (imageModel: string) =>
  new VertexClient({
    projectId: values.project,
    models: () => ({ text: 'gemini-3.5-flash', image: imageModel }),
    getAccessToken: () => Promise.resolve(token),
  });

const { sheet, usage } = await new VertexTextProvider(client(models[0] ?? '')).describeCharacter(
  photo,
);
spentMicros += usage.costUsdMicros;
const description = describeCharacterSheet(sheet);
console.log(`Ficha del personaje: ${description}`);

interface Cell {
  file: string | null;
  error: string | null;
  costUsd: number;
}
const results: Record<string, Record<string, Cell[]>> = {};

for (const model of models) {
  const provider = new VertexImageProvider(client(model));
  results[model] = {};
  for (const style of styles) {
    const cells: Cell[] = [];
    let cover: ImageData | null = null;
    for (const [index, scene] of scenes.entries()) {
      if (spentMicros / 1_000_000 >= budgetUsd) {
        cells.push({ file: null, error: 'tope de presupuesto alcanzado', costUsd: 0 });
        continue;
      }
      try {
        const image = await provider.generateIllustration({
          prompt: `Children's picture book illustration: ${scene}`,
          stylePrompt: STYLES[style] ?? '',
          character: { description, photo },
          references: cover ? [cover] : [],
          aspectRatio: '3:4',
          seed: 7,
        });
        spentMicros += image.usage.costUsdMicros;
        const file = `${model}__${style}__${String(index)}.png`;
        await sharp(image.bytes).png().toFile(path.join(outDir, file));
        cover ??= { bytes: image.bytes, mimeType: image.mimeType };
        cells.push({ file, error: null, costUsd: image.usage.costUsdMicros / 1_000_000 });
        console.log(`✓ ${model} · ${style} · escena ${String(index + 1)}`);
      } catch (error) {
        cells.push({ file: null, error: (error as Error).message.slice(0, 200), costUsd: 0 });
        console.log(
          `✗ ${model} · ${style} · escena ${String(index + 1)}: ${(error as Error).message}`,
        );
      }
    }
    results[model][style] = cells;
  }
}

const escape = (text: string) => text.replace(/[<>&"]/g, (c) => `&#${String(c.charCodeAt(0))};`);
const sections = Object.entries(results)
  .map(([model, byStyle]) => {
    const rows = Object.entries(byStyle)
      .map(([style, cells]) => {
        const cost = cells.reduce((total, cell) => total + cell.costUsd, 0);
        const figures = cells
          .map((cell, index) =>
            cell.file
              ? `<figure><img src="${cell.file}" alt="${escape(`${model} ${style} escena ${String(index + 1)}`)}"><figcaption>Escena ${String(index + 1)} · USD ${cell.costUsd.toFixed(3)}</figcaption></figure>`
              : `<figure class="error"><p>${escape(cell.error ?? '')}</p></figure>`,
          )
          .join('');
        return `<h3>${escape(style)} <small>USD ${cost.toFixed(3)}</small></h3><div class="row">${figures}</div>`;
      })
      .join('');
    return `<section><h2>${escape(model)}</h2>${rows}</section>`;
  })
  .join('');

writeFileSync(
  path.join(outDir, 'index.html'),
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Evaluación de consistencia</title>
<style>
body{font-family:system-ui,sans-serif;background:#faf0e5;color:#342a40;margin:0;padding:24px}
h1{font-family:Georgia,serif}.meta{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.meta img{width:140px;border-radius:12px}.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
figure{margin:0;background:#fff;border-radius:12px;padding:8px}figure img{width:100%;border-radius:8px}
figcaption{font-size:13px;color:#69616c;margin-top:4px}.error{color:#a33;font-size:13px}small{color:#69616c;font-weight:400}
</style></head><body>
<h1>Evaluación de consistencia del personaje</h1>
<div class="meta"><img src="photo.jpg" alt="Foto de referencia"><div>
<p><strong>Ficha:</strong> ${escape(description)}</p>
<p><strong>Costo total estimado:</strong> USD ${(spentMicros / 1_000_000).toFixed(3)}</p>
<p>Criterios para puntuar (1 a 5): parecido con la foto · mismo personaje en todas las escenas · calidad del estilo · manos y caras sin deformaciones · ausencia de texto.</p>
</div></div>${sections}</body></html>`,
);
console.log(`Reporte: ${path.join(outDir, 'index.html')}`);
console.log(`Costo total estimado: USD ${(spentMicros / 1_000_000).toFixed(3)}`);
