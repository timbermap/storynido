/**
 * Aplica la regla de precios de DECISIONS 241 a los productos de un proyecto (solo los márgenes,
 * la comisión de cobro y el margen neto mínimo; el costo de IA, el descuento Pro y si se vende
 * quedan como están). Sirve una vez por ambiente; después todo se edita en Admin → Precios.
 *
 *   pnpm --filter @storynido/firebase exec tsx src/pricing-rule.ts --project storynido-staging
 *   (agregar --dry-run para ver qué cambiaría sin escribir)
 */
import { BOOK_FORMATS, COLLECTIONS, DEFAULT_PRODUCT_PRICING } from '@storynido/shared';

import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from './admin';

const projectFlag = process.argv.indexOf('--project');
const project = projectFlag >= 0 ? process.argv[projectFlag + 1] : undefined;
const dryRun = process.argv.includes('--dry-run');
if (!project?.startsWith('storynido-')) {
  throw new Error('Indicá el proyecto: --project storynido-staging');
}

const db = getFirestore(initAdmin(project));
const now = new Date();
for (const format of BOOK_FORMATS) {
  const ref = db.collection(COLLECTIONS.productPricing).doc(format);
  const current = (await ref.get()).data() ?? {};
  const rule = DEFAULT_PRODUCT_PRICING[format];
  const update = {
    creationMargin: rule.creationMargin,
    printMargin: rule.printMargin,
    paymentFeePercent: rule.paymentFeePercent,
    minNetMarginUsdMinor: rule.minNetMarginUsdMinor,
    updatedAt: now,
    updatedBy: 'regla de precios (DECISIONS 241)',
  };
  console.log(
    `${format}: creación ${JSON.stringify(current.creationMargin)} → ${JSON.stringify(rule.creationMargin)}; impresión ${JSON.stringify(current.printMargin)} → ${JSON.stringify(rule.printMargin)}; comisión ${String(rule.paymentFeePercent)} %; mínimo neto ${String(rule.minNetMarginUsdMinor)}`,
  );
  if (!dryRun) await ref.set(update, { merge: true });
}
console.log(dryRun ? 'Sin cambios (--dry-run).' : `Listo en ${project}.`);
