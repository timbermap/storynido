/**
 * Golden set de pedidos (DECISIONS 333): pedidos fijos con chicos inventados (nunca fotos), que
 * cubren las tres líneas, las franjas de edad, los estilos y cada fallo real que ya tuvimos. Cada
 * caso escribe el texto como la muestra (plan saneado, cuento, revisión y reparación del contrato),
 * dibuja la lámina, la tapa y 3 páginas, y pasa cada dibujo por la revisión de página con el
 * contrato. Cada página se dibuja con su armado (zona calma o papel fundido), se controla que nada
 * importante quede bajo el texto y se arma como la ve el cliente; la mesa de jueces (judge-panel.ts,
 * 26 nov 2026: comprador con ventas y marketing, continuidad, el chico que escucha y el profesional)
 * mira el libro y dice si lo compraría. El informe dice, cláusula por cláusula, qué casos cumplen el
 * pedido. Para juzgar una corrida ya hecha sin volver a dibujar: judge-round.ts.
 *
 *   pnpm eval:pedidos                         # solo estima el costo
 *   pnpm eval:pedidos --yes                   # corre (gasta IA, tope US$8)
 *   pnpm eval:pedidos --yes --compare eval-reports/pedidos-…/resultados.json
 *
 * Con --compare, una cláusula que antes pasaba y ahora falla es una regresión: el script termina
 * con error y no se pasa a producción. Opciones: --only caso,caso · --pages 3 · --no-images.
 * Credenciales: token de gcloud con la configuración "storynido" (nunca la de Timbermap).
 *
 * Regla de la mesa: cada fallo nuevo que se escapa suma un caso acá, una cláusula y un test.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  CHARACTER_REFERENCE_SCENE,
  CONTRACT_CLAUSES,
  DEFAULT_EDITORIAL_CONFIG,
  EMPTY_BIRTHDAY,
  artDirection,
  bookLayout,
  countWords,
  pageLayout,
  sceneNoteFor,
  storyTypography,
  textZoneOf,
  buildIllustrationPrompt,
  buildOrderContract,
  buildStoryPrompt,
  castNote,
  NO_TEXT_OBJECTS_HINT,
  companionNote,
  checkFormContract,
  checkPlanContract,
  checkTextContract,
  coverScene,
  coverSetting,
  describeCharacter,
  describeTraits,
  editorialPlan,
  hardViolations,
  imageContractNote,
  spanishVoiceFor,
  visualBibleCheck,
  withChildName,
  type ContractClauseId,
  type ImageData,
  type Memories,
  panelLines,
  panelSummary,
  runPanel,
  type Panel,
  type PageLayout,
} from '@storynido/shared';
import sharp from 'sharp';

import {
  SEED_DRAFT_STORIES,
  SEED_NEW_STORIES,
  SEED_PRO_STORIES,
  SEED_STORIES,
  SEED_STYLES,
} from '../../../firebase/seed-data/catalog';
import { VertexClient, VertexImageProvider, VertexTextProvider } from '../src/gcp/vertex';
import { composePage } from '../src/compose-page';
import { CASES, orderSummary } from './pedidos-cases';

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    pages: { type: 'string', default: '3' },
    budget: { type: 'string', default: '8' },
    images: { type: 'boolean', default: true },
    'no-images': { type: 'boolean', default: false },
    compare: { type: 'string' },
    project: { type: 'string', default: 'storynido-staging' },
    out: { type: 'string', default: 'eval-reports' },
    yes: { type: 'boolean', default: false },
    /** Vueltas por pedido: con 2, un fallo cuenta como real solo si se repite (el dibujo varía). */
    runs: { type: 'string', default: '1' },
    /** Como el worker: el dibujo que falla el contrato se redibuja una vez con la reparación. */
    redraw: { type: 'boolean', default: true },
    'no-redraw': { type: 'boolean', default: false },
  },
});

if (values.project.startsWith('timbermap')) {
  console.error('Este script nunca corre contra proyectos de Timbermap.');
  process.exit(1);
}

const ids = values.only?.split(',');
const cases = ids ? CASES.filter((item) => ids.includes(item.id)) : CASES;
const stories = [...SEED_STORIES, ...SEED_NEW_STORIES, ...SEED_PRO_STORIES, ...SEED_DRAFT_STORIES];
const unknown = cases.filter(
  (item) =>
    !stories.some((story) => story.slug === item.story) ||
    !SEED_STYLES.some((style) => style.slug === item.style),
);
if (unknown.length > 0) {
  console.error(`Historia o estilo desconocidos: ${unknown.map((item) => item.id).join(', ')}`);
  process.exit(1);
}

const withImages = values.images && !values['no-images'];
const pagesToDraw = Number(values.pages);
const runs = Math.max(1, Math.floor(Number(values.runs)) || 1);
const withRedraw = values.redraw && !values['no-redraw'];
// Imagen: ~1.300 tokens de salida más la entrada (calibrado con la v2 del 25 nov: US$3,65 reales
// contra 4,07 estimados); texto y revisiones, unos centavos.
const perImage = 0.075;
// El redibujo se estima para un tercio de los dibujos (en la v2 falló uno de cada tres).
const perCase =
  0.06 +
  (withImages
    ? (2 + pagesToDraw) * perImage +
      (1 + pagesToDraw) * 0.006 +
      (withRedraw ? (1 + pagesToDraw) * 0.35 * (perImage + 0.006) : 0) +
      // Control de la zona del texto en cada página y el juez comprador (tapa y páginas armadas).
      pagesToDraw * 0.003 +
      0.02
    : 0);
const estimate = cases.length * runs * perCase;
const budget = Number(values.budget);
console.log(
  `Plan: ${String(cases.length)} pedidos × ${String(runs)} vuelta(s)${withRedraw ? ' con redibujo' : ''} · ${withImages ? `lámina, tapa y ${String(pagesToDraw)} páginas` : 'solo texto'} · estimado USD ${estimate.toFixed(2)} · tope USD ${budget.toFixed(2)}`,
);
if (!values.yes) {
  console.log('Sin --yes no se genera nada.');
  process.exit(0);
}
if (estimate > budget) {
  console.error('La estimación supera el tope: bajá los casos o las páginas.');
  process.exit(1);
}

let cachedToken = { value: '', at: 0 };
const freshToken = () => {
  // gcloud puede devolver un token en caché que vence a los pocos minutos (ronda 3 del 25 nov: 12 de 16
  // vueltas cayeron en 401). Se vuelve a pedir cada 2 minutos: gcloud lo renueva si ya venció.
  if (!cachedToken.value || Date.now() - cachedToken.at > 2 * 60_000) {
    cachedToken = {
      value: execFileSync('gcloud', ['auth', 'print-access-token'], {
        env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'storynido' },
      })
        .toString()
        .trim(),
      at: Date.now(),
    };
  }
  return cachedToken.value;
};
const client = new VertexClient({
  projectId: values.project,
  models: () => ({ text: 'gemini-3.5-flash', image: 'gemini-3.1-flash-image' }),
  getAccessToken: () => Promise.resolve(freshToken()),
});
const text = new VertexTextProvider(client);
const image = new VertexImageProvider(client);

let spent = 0;
const spend = (usage: { costUsdMicros: number }) => {
  spent += usage.costUsdMicros;
  if (spent / 1_000_000 > budget) throw new Error('tope de presupuesto alcanzado');
};

type Verdict = 'pass' | 'fail' | 'repaired' | 'soft';
interface Row {
  id: string;
  /** Vuelta (1 si la corrida tiene una sola). */
  run?: number;
  /** Dibujos revisados y los que salieron limpios a la primera (sin redibujo). */
  images?: { reviewed: number; cleanFirst: number; cleanFinal: number };
  covers: string;
  title: string;
  pages: string[];
  /** Cláusula → resultado final (las que no aplican no están). */
  clauses: Partial<Record<ContractClauseId, Verdict>>;
  notes: string[];
  /** Escenas del plan (ropa y lo que se ve), para poder leer un fallo después. */
  scenes?: unknown[];
  /** Mesa de jueces: comprador (con ventas y marketing), continuidad, el chico y el profesional. */
  panel?: Panel;
  costUsd: number;
  error?: string;
}

const outDir = path.resolve(
  values.out,
  `pedidos-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
mkdirSync(outDir, { recursive: true });
const rows: Row[] = [];
const save = () => {
  writeFileSync(path.join(outDir, 'resultados.json'), JSON.stringify(rows, null, 2));
};

for (const [round, testCase] of Array.from({ length: runs }, (_, index) => index + 1).flatMap(
  (run) => cases.map((item) => [run, item] as const),
)) {
  const story = stories.find((item) => item.slug === testCase.story);
  const style = SEED_STYLES.find((item) => item.slug === testCase.style);
  if (!story || !style) continue;
  const before = spent;
  const tag = runs > 1 ? `${testCase.id}-v${String(round)}` : testCase.id;
  const row: Row = {
    id: testCase.id,
    run: round,
    images: { reviewed: 0, cleanFirst: 0, cleanFinal: 0 },
    covers: testCase.covers,
    title: '',
    pages: [],
    clauses: {},
    notes: [],
    costUsd: 0,
  };
  rows.push(row);
  const mark = (clause: ContractClauseId, verdict: Verdict) => {
    const now = row.clauses[clause];
    // El peor resultado manda: fail > soft > repaired > pass.
    const rank: Record<Verdict, number> = { pass: 0, repaired: 1, soft: 2, fail: 3 };
    if (!now || rank[verdict] > rank[now]) row.clauses[clause] = verdict;
  };
  try {
    const plan = editorialPlan(
      { length: 'mini', textDensity: 'balanced', readingLevel: 'developing', contentType: 'story' },
      DEFAULT_EDITORIAL_CONFIG,
      story.pageCount,
      testCase.age,
    );
    const memories: Memories | null = testCase.memories
      ? { moment: null, companion: null, nickname: null, favorite: null, ...testCase.memories }
      : null;
    const event = testCase.event ? { ...EMPTY_BIRTHDAY, ...testCase.event } : null;
    const request = {
      language: 'es' as const,
      childName: testCase.name,
      age: testCase.age,
      pronouns: testCase.he ? ('he' as const) : ('she' as const),
      likes: testCase.likes,
      petName: testCase.petName ?? null,
      bestFriendName: testCase.bestFriendName ?? null,
      dedication: null,
      storyTitle: withChildName(story.title.es, testCase.name),
      lessons: [],
      pageCount: Math.min(Math.max(plan.narrativePages, 4), 10),
      wordsPerPage: plan.words,
      mustInclude: [],
      spanishVoice: spanishVoiceFor(testCase.country),
      protagonistLook: describeTraits(testCase.traits, []),
    };
    const promptInput = {
      ...request,
      template: story.textPromptTemplate,
      storyAges: { min: story.ageMin, max: story.ageMax },
      premise: story.summary.es || null,
      bedtime: story.tags.includes('dormir'),
      memories,
      event,
      goal: testCase.goal ?? null,
      practice: testCase.practice ?? null,
      professional: testCase.channel === 'professionals',
      levelGuidance: plan.levelGuidance,
    };
    const contract = buildOrderContract({
      channel: testCase.channel,
      language: 'es',
      age: testCase.age,
      petName: request.petName,
      bestFriendName: request.bestFriendName,
      likes: request.likes,
      practice: testCase.practice ?? null,
      storyAges: { min: story.ageMin, max: story.ageMax },
      tags: story.tags,
      requestedText: [
        ...(memories ? Object.values(memories) : []),
        story.textPromptTemplate,
        story.summary.es,
        event ? JSON.stringify(event) : null,
        testCase.goal,
      ],
    });
    for (const violation of checkFormContract(contract, {
      age: testCase.age,
      storyAges: { min: story.ageMin, max: story.ageMax },
    })) {
      mark(violation.clause, violation.severity === 'soft' ? 'soft' : 'fail');
    }

    // Texto como la muestra: plan saneado, cuento, revisión y una reparación del contrato.
    const { usage: planUsage, ...planned } = await text.planStory({
      ...request,
      prompt: buildStoryPrompt(promptInput),
    });
    spend(planUsage);
    const sanitized = checkPlanContract(contract, planned);
    if (sanitized.violations.length > 0) {
      row.notes.push(`plan: ${sanitized.violations.map((item) => item.repair).join(' ')}`);
    }
    const storyPlan = { ...planned, ...sanitized.plan };
    const prompt = buildStoryPrompt({ ...promptInput, plan: storyPlan });
    const draft = await text.generateStory({ ...request, prompt });
    spend(draft.usage);
    const reviewed = await text.reviewStory(draft, { ...request, prompt });
    spend(reviewed.usage);
    let pages = reviewed.pages.map((page) => ({ ...page }));
    const first = checkTextContract(contract, pages, storyPlan);
    const hard = hardViolations(first);
    if (hard.length > 0) {
      const repair = await text.reviewStory(
        { title: draft.title, pages, usage: draft.usage },
        { ...request, prompt },
        { issues: hard.map((item) => item.repair) },
      );
      spend(repair.usage);
      const after = hardViolations(checkTextContract(contract, repair.pages, storyPlan));
      if (after.length < hard.length) pages = repair.pages.map((page) => ({ ...page }));
    }
    const final = checkTextContract(contract, pages, storyPlan);
    const finalClauses = new Set(final.map((item) => item.clause));
    for (const violation of first) {
      if (violation.severity === 'soft') mark(violation.clause, 'soft');
      else mark(violation.clause, finalClauses.has(violation.clause) ? 'fail' : 'repaired');
    }
    for (const violation of final) {
      if (violation.severity === 'hard') {
        mark(violation.clause, 'fail');
        row.notes.push(`texto: ${violation.repair}`);
      }
    }
    mark('closed_cast', 'pass');
    mark('no_touch', 'pass');
    if (contract.requiredNames.length > 0) mark('requested_names', 'pass');
    if (storyPlan.structure === 'refrain' && storyPlan.refrain) mark('exact_refrain', 'pass');
    if (contract.promises.length > 0) mark('template_promise', 'pass');
    row.title = draft.title;
    row.pages = pages.map((page) => page.text);
    row.scenes = storyPlan.scenes;
    console.log(`✓ ${testCase.id} · texto: ${draft.title}`);

    if (withImages) {
      const direction = artDirection({
        age: testCase.age,
        channel: testCase.channel,
        palette: story.palette,
        style: style.slug,
      });
      const description = `${describeCharacter(
        testCase.name,
        testCase.age,
        testCase.sheet,
        testCase.traits,
        [],
      )}${storyPlan.companion ? `\n${companionNote(storyPlan.companion)}` : ''}`;
      const draw = async (label: string, scene: string, references: ImageData[], seed: number) => {
        // Un dibujo que se cuelga o que la moderación bloquea no tumba el caso: un reintento, como el
        // worker, que en el segundo intento saca los objetos con letras (Diario, 25 nov:
        // PROHIBITED_CONTENT).
        const once = (hint = '') =>
          image.generateIllustration({
            prompt: buildIllustrationPrompt({
              template: story.imagePromptTemplate,
              scene: `${scene}${hint}`,
              character: description,
              style: style.promptModifier,
              direction,
            }),
            stylePrompt: style.promptModifier,
            character: { description, photo: null },
            references,
            traitReferences: [],
            aspectRatio: '3:4',
            resolution: '1K',
            seed,
          });
        const generated = await once().catch((error: unknown) => {
          console.log(`  ${testCase.id} · ${label}: reintento (${(error as Error).message})`);
          return once(` ${NO_TEXT_OBJECTS_HINT}`);
        });
        spend(generated.usage);
        await sharp(generated.bytes)
          .webp({ quality: 82 })
          .toFile(path.join(outDir, `${tag}-${label}.webp`));
        return { bytes: generated.bytes, mimeType: generated.mimeType };
      };
      const lamina = await draw('lamina', CHARACTER_REFERENCE_SCENE, [], 0);
      // Armado de cada página igual que la muestra y el worker: zona calma o papel fundido según la
      // edad y lo que mide el texto (Benicio, 25 nov: el examen dibujaba sin armado y no lo vio).
      const typography =
        plan.ageBand && plan.textBand ? storyTypography(plan.ageBand, plan.textBand, 'es') : null;
      const layoutFor = (index: number, sceneIndex: number): PageLayout =>
        pageLayout({
          layout: bookLayout(testCase.age, 'story'),
          words: countWords(pages[index]?.text ?? ''),
          text: pages[index]?.text ?? '',
          typography,
          pageIndex: sceneIndex,
          contentType: 'story',
        });
      const note = imageContractNote({
        companion: storyPlan.companion,
        cast: storyPlan.cast,
        partyGuests: testCase.channel === 'events',
      });
      const review = async (
        label: string,
        img: ImageData,
        index: number,
        pageText: string | null,
      ) => {
        const scene =
          index === 0
            ? null
            : (storyPlan.scenes.find((item) => item.pageIndex === index - 1) ?? null);
        let verdict;
        try {
          // Igual que el worker: la ropa de la lámina salvo que el texto la cambie, y la biblia.
          verdict = await text.reviewPage({
            pageIndex: index,
            text: pageText,
            image: img,
            reference: lamina,
            character: description,
            mustKeep: [
              `outfit: ${testCase.sheet.clothing} (unless the page text says the character changes clothes)`,
            ],
            scene,
            visualBible: index === 0 ? '' : visualBibleCheck(storyPlan, scene),
            contract: note,
          });
        } catch (error) {
          // El worker redibuja la página más pudorosa si el filtro bloquea la revisión; acá queda
          // anotada sin revisar y el caso sigue.
          row.notes.push(`${label}: sin revisar (${(error as Error).message.slice(0, 120)})`);
          return null;
        }
        spend(verdict.usage);
        const broken = new Set<ContractClauseId>(verdict.contractClauses ?? []);
        if (verdict.textInImage) broken.add('no_text_in_image');
        return { broken, issues: verdict.criticalIssues, fix: verdict.repairInstructions ?? [] };
      };
      /**
       * Dibuja, revisa y, si falla el contrato, redibuja una vez con las instrucciones de la
       * revisión (como el worker). Lo que el redibujo arregla queda ↻; lo que sigue, ✗.
       */
      const drawChecked = async (
        label: string,
        file: string,
        scene: string,
        seed: number,
        index: number,
        pageText: string | null,
      ) => {
        let finalImage = await draw(file, scene, [lamina], seed);
        const first = await review(label, finalImage, index, pageText);
        if (!first) return finalImage;
        const images = row.images ?? { reviewed: 0, cleanFirst: 0, cleanFinal: 0 };
        row.images = images;
        images.reviewed += 1;
        if (first.broken.size === 0) {
          images.cleanFirst += 1;
          images.cleanFinal += 1;
          return finalImage;
        }
        let final = first;
        if (withRedraw) {
          const fix = first.fix.length > 0 ? first.fix : first.issues;
          const redrawn = await draw(
            `${file}-redibujo`,
            `${scene} Repair: ${fix.join('; ')}.`,
            [lamina],
            seed + 100,
          );
          const again = await review(`${label} (redibujo)`, redrawn, index, pageText);
          if (again) {
            final = again;
            finalImage = redrawn;
          }
        }
        if (final.broken.size === 0) images.cleanFinal += 1;
        for (const clause of first.broken) {
          mark(clause, final.broken.has(clause) ? 'fail' : 'repaired');
          row.notes.push(`${label}: ${clause} (${first.issues.join('; ').slice(0, 400)})`);
        }
        for (const clause of final.broken) {
          mark(clause, 'fail');
          if (final !== first) {
            row.notes.push(
              `${label} tras redibujo: ${clause} (${final.issues.join('; ').slice(0, 400)})`,
            );
          }
        }
        return finalImage;
      };
      /**
       * Lo que el worker controla en la moderación: nada importante bajo el texto (en el papel
       * fundido, nadie en la zona). Si falla, un redibujo como el worker; si sigue, ✗ text_layout.
       */
      const zoneChecked = async (
        label: string,
        file: string,
        scene: string,
        seed: number,
        img: ImageData,
        zone: ReturnType<typeof textZoneOf>,
      ): Promise<ImageData> => {
        if (!('textZone' in zone)) return img;
        const check = async (candidate: ImageData) => {
          const verdict = await image.moderateImage(candidate, zone);
          if (verdict.usage) spend(verdict.usage);
          return verdict.categories.some((item) => /text_zone/i.test(item));
        };
        if (!(await check(img))) return img;
        const where = `${zone.textZone.side} ${String(zone.textZone.pct)}%`;
        const redrawn = await draw(
          `${file}-zona`,
          `${scene} Repair: keep the ${where} of the image completely empty plain background; move every person, animal, hand and key object out of it.`,
          [lamina],
          seed + 200,
        );
        if (await check(redrawn)) {
          mark('text_layout', 'fail');
          row.notes.push(`${label}: text_layout (algo importante sigue en la zona ${where})`);
          return redrawn;
        }
        mark('text_layout', 'repaired');
        row.notes.push(
          `${label}: text_layout (había algo en la zona ${where}; el redibujo lo sacó)`,
        );
        return redrawn;
      };
      const cover = await drawChecked(
        'tapa',
        'tapa',
        coverScene(draft.pages[0]?.illustrationPrompt, draft.title, coverSetting(storyPlan)),
        1,
        0,
        null,
      );
      const composed: ImageData[] = [];
      const drawnPages: ImageData[] = [];
      for (const page of draft.pages.slice(0, pagesToDraw)) {
        const scene = storyPlan.scenes.find((item) => item.pageIndex === page.index);
        const bible = visualBibleCheck(storyPlan, scene);
        const pageText = pages[page.index]?.text ?? '';
        const layout = layoutFor(page.index, scene?.pageIndex ?? page.index + 1);
        const label = `página ${String(page.index + 1)}`;
        const file = `pagina-${String(page.index + 1)}`;
        const sceneText = `${page.illustrationPrompt}${bible ? ` ${bible}` : ''}${castNote(storyPlan.cast)}${sceneNoteFor(layout, pageText)}`;
        const drawn = await drawChecked(
          label,
          file,
          sceneText,
          page.index + 2,
          page.index + 1,
          pageText || null,
        );
        const img = await zoneChecked(
          label,
          file,
          sceneText,
          page.index + 2,
          drawn,
          textZoneOf(layout, pageText),
        );
        // La página como la ve el cliente: dibujo, papel fundido y texto con la misma geometría.
        const bytes = await composePage(img.bytes, layout, pageText, typography);
        await sharp(bytes).toFile(path.join(outDir, `${tag}-${file}-armada.webp`));
        composed.push({ bytes, mimeType: 'image/webp' });
        drawnPages.push(img);
      }
      // Mesa de jueces: el que paga, la continuidad, el chico que escucha y, en Pro, el profesional.
      row.panel = await runPanel(
        text,
        {
          channel: testCase.channel,
          priceUsd: testCase.channel === 'events' ? 11 : 15,
          order: orderSummary(testCase, story.title.es, style.name.es),
          goal: testCase.goal ?? null,
          title: draft.title,
          texts: pages.map((page) => page.text),
          age: testCase.age,
          language: 'es',
          refrain: storyPlan.structure === 'refrain' ? (storyPlan.refrain ?? null) : null,
          style: `${style.name.es}: ${style.promptModifier.slice(0, 200)}`,
          cover,
          composed,
          drawn: drawnPages,
          reference: lamina,
          companion: storyPlan.companion?.name ?? null,
        },
        spend,
      );
      for (const problem of row.panel.errors) row.notes.push(`mesa: ${problem}`);
      for (const clause of [
        'closed_cast',
        'no_touch',
        'same_outfit',
        'chosen_style',
        'no_text_in_image',
        'text_layout',
      ] as const) {
        mark(clause, 'pass');
      }
      console.log(`✓ ${tag} · imágenes revisadas`);
    }
  } catch (error) {
    row.error = (error as Error).message.slice(0, 200);
    console.log(`✗ ${tag}: ${row.error}`);
  }
  row.costUsd = (spent - before) / 1_000_000;
  save();
}
save();

// Regresiones contra la corrida anterior: lo que pasaba (o se reparaba solo) y ahora falla.
const previous: Row[] = values.compare
  ? (JSON.parse(readFileSync(path.resolve(values.compare), 'utf8')) as Row[])
  : [];
const regressions: string[] = [];
// Con varias vueltas, una regresión es un fallo que se repite en todas y que antes pasaba en
// alguna: un solo dibujo que sale mal puede ser azar.
for (const id of new Set(rows.map((row) => row.id))) {
  const now = rows.filter((row) => row.id === id);
  const old = previous.filter((item) => item.id === id);
  if (old.length === 0) continue;
  for (const clause of CONTRACT_CLAUSES) {
    const passedBefore = old.some(
      (item) => item.clauses[clause] === 'pass' || item.clauses[clause] === 'repaired',
    );
    if (passedBefore && now.every((row) => row.clauses[clause] === 'fail')) {
      regressions.push(`${id} · ${clause}`);
    }
  }
}

const symbol: Record<Verdict, string> = { pass: '✓', repaired: '↻', soft: '·', fail: '✗' };
const used = CONTRACT_CLAUSES.filter((clause) => rows.some((row) => row.clauses[clause]));
const md = [
  `# Golden set de pedidos · ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Costo real: USD ${(spent / 1_000_000).toFixed(2)} · ${withImages ? `lámina, tapa y ${String(pagesToDraw)} páginas` : 'solo texto'} · ${String(runs)} vuelta(s)${withRedraw ? ' con redibujo' : ''}`,
  '',
  ...(withImages
    ? [
        (() => {
          const total = rows.reduce((sum, row) => sum + (row.images?.reviewed ?? 0), 0);
          const first = rows.reduce((sum, row) => sum + (row.images?.cleanFirst ?? 0), 0);
          const final = rows.reduce((sum, row) => sum + (row.images?.cleanFinal ?? 0), 0);
          const pct = (value: number) =>
            total ? `${String(Math.round((100 * value) / total))}%` : '-';
          const clean = rows.filter(
            (row) =>
              !row.error && Object.values(row.clauses).every((verdict) => verdict !== 'fail'),
          ).length;
          return `Dibujos limpios a la primera: ${String(first)}/${String(total)} (${pct(first)}) · después del redibujo: ${String(final)}/${String(total)} (${pct(final)}) · pedidos sin fallos duros al final: ${String(clean)}/${String(rows.length)}`;
        })(),
        '',
        (() => {
          const judged = rows.flatMap((row) => (row.panel ? [row.panel] : []));
          return judged.length > 0 ? panelSummary(judged) : 'Mesa de jueces: sin respuestas';
        })(),
        '',
      ]
    : []),
  '✓ cumple · ↻ falló y se reparó solo · · blanda (se mide) · ✗ no cumple',
  '',
  `| Pedido | ${used.join(' | ')} | Costo |`,
  `| --- | ${used.map(() => '---').join(' | ')} | --- |`,
  ...rows.map(
    (row) =>
      `| ${row.id}${runs > 1 ? ` v${String(row.run ?? 1)}` : ''}${row.error ? ' (error)' : ''} | ${used
        .map((clause) => {
          const verdict = row.clauses[clause];
          return verdict ? symbol[verdict] : '';
        })
        .join(' | ')} | ${row.costUsd.toFixed(2)} |`,
  ),
  '',
  regressions.length > 0
    ? `## Regresiones (no pasar a producción)\n\n${regressions.map((item) => `- ${item}`).join('\n')}`
    : values.compare
      ? '## Sin regresiones contra la corrida anterior'
      : '',
  '',
  ...(rows.some((row) => row.panel)
    ? [
        '## Qué dice la mesa de jueces',
        ...rows.flatMap((row) =>
          row.panel
            ? [
                ...panelLines(`${row.id}${runs > 1 ? ` v${String(row.run ?? 1)}` : ''}`, row.panel),
                '',
              ]
            : [],
        ),
      ]
    : []),
  '## Qué cubre y qué falló',
  ...rows.map(
    (row) =>
      `- **${row.id}${runs > 1 ? ` v${String(row.run ?? 1)}` : ''}** (${row.covers}): ${row.error ?? (row.notes.join(' · ') || 'todo cumple')}`,
  ),
].join('\n');
writeFileSync(path.join(outDir, 'resumen.md'), md);
console.log(md);
console.log(`Reporte: ${outDir}`);
if (regressions.length > 0) process.exit(1);
