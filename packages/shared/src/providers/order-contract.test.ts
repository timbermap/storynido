import { describe, expect, it } from 'vitest';

import {
  buildOrderContract,
  checkFormContract,
  checkPlanContract,
  checkTextContract,
  familyRolesIn,
  hardViolations,
  hardWeight,
  IMAGE_CONTRACT_CLAUSES,
  imageContractNote,
  practiceMissingPages,
} from './order-contract';

const pages = (...texts: string[]) => texts.map((text) => ({ text }));

/** El libro de Angélica (25 nov): Profesionales, 3 años, nadie cargó familia. */
const angelica = buildOrderContract({
  channel: 'professionals',
  language: 'es',
  age: 3,
  storyAges: { min: 4, max: 7 },
  tags: [],
  requestedText: ['Escribe un cuento para practicar un sonido.', 'Un sonido se esconde en casa.'],
});

describe('familyRolesIn', () => {
  it('reconoce los familiares en los tres idiomas, sin tildes', () => {
    expect(familyRolesIn('Papá me mira')).toEqual(['father']);
    expect(familyRolesIn('Grandma and my sister')).toEqual(['grandparent', 'sibling']);
    expect(familyRolesIn('A mãe e o avô')).toEqual(['mother', 'grandparent']);
    expect(familyRolesIn('La familia acompaña')).toEqual([]);
  });
});

describe('contrato del pedido', () => {
  it('Profesionales: un familiar no pedido es una cláusula dura', () => {
    const clause = angelica.clauses.find((item) => item.id === 'closed_cast');
    expect(clause?.severity).toBe('hard');
    expect(angelica.allowedFamily).toEqual([]);
  });

  it('la plantilla fuera de la edad se registra como blanda', () => {
    const found = checkFormContract(angelica, { age: 3, storyAges: { min: 4, max: 7 } });
    expect(found).toHaveLength(1);
    expect(found[0]?.clause).toBe('age_range');
    expect(found[0]?.severity).toBe('soft');
  });

  it('el plan pierde al papá que nadie pidió, gratis', () => {
    const result = checkPlanContract(angelica, {
      companion: { name: 'Papá', look: 'a tall man with a beard' },
      cast: [
        { role: 'the speech therapist', name: null, gender: 'female', look: 'short hair' },
        { role: 'grandmother', name: 'Abuela Rosa', gender: 'female', look: 'grey hair' },
      ],
    });
    expect(result.violations.map((item) => item.clause)).toEqual(['closed_cast']);
    expect(result.plan.companion).toBeNull();
    expect(result.plan.cast?.map((member) => member.role)).toEqual(['the speech therapist']);
  });

  it('el texto con «Papá me abraza fuerte» falla elenco y contacto', () => {
    const found = checkTextContract(
      angelica,
      pages('Angélica escucha.', 'Papá me abraza fuerte.', 'Fiu, fiu.'),
      null,
    );
    expect(found.map((item) => item.clause).sort()).toEqual(['closed_cast', 'no_touch']);
    expect(found.find((item) => item.clause === 'no_touch')?.pages).toEqual([2]);
  });

  it('con la mamá en los recuerdos, un abrazo breve con ella está permitido', () => {
    const contract = buildOrderContract({
      channel: 'families',
      language: 'es',
      age: 5,
      requestedText: ['Mamá le canta cada noche'],
    });
    expect(contract.allowedFamily).toEqual(['mother']);
    expect(checkTextContract(contract, pages('Mamá la abraza de costado.'), null)).toEqual([]);
    // Cariño con la familia del pedido (DECISIONS 342): abrazo, upa y beso en la frente.
    expect(
      checkTextContract(
        contract,
        pages('Mamá la abraza fuerte.', 'Mamá la alza a upa y le da un beso en la frente.'),
        null,
      ),
    ).toEqual([]);
    // Pero no un abrazo con alguien de afuera de la familia.
    expect(
      checkTextContract(contract, pages('La maestra la abraza.'), null).map((item) => item.clause),
    ).toEqual(['no_touch']);
  });

  it('en familias, un familiar no pedido se registra pero no se repara', () => {
    const contract = buildOrderContract({
      channel: 'families',
      language: 'es',
      age: 5,
      requestedText: [],
    });
    const found = checkTextContract(contract, pages('El abuelo cuenta un chiste.'), null);
    expect(found.map((item) => item.clause)).toEqual(['closed_cast']);
    expect(hardViolations(found)).toEqual([]);
  });

  it('el estribillo tiene que estar idéntico en al menos 3 páginas', () => {
    const plan = { refrain: 'Oigo, oigo, ¿quién será?', structure: 'refrain' as const };
    const paraphrased = pages(
      'Oigo, oigo, ¿quién será?',
      'Escucho, escucho, ¿quién será?',
      'Presto oído.',
      'Oigo oigo quién será',
      'Un pájaro.',
      'Fin.',
    );
    const found = checkTextContract(angelica, paraphrased, plan);
    expect(found.map((item) => item.clause)).toEqual(['exact_refrain']);
    const exact = pages(
      'Oigo, oigo, ¿quién será?',
      'Oigo, oigo, ¿quién será?',
      'Un ruido.',
      '¡Oigo, oigo! ¿Quién será?',
      'Un pájaro.',
      'Fin.',
    );
    expect(checkTextContract(angelica, exact, plan)).toEqual([]);
  });

  it('la mascota y el amigo del formulario tienen que aparecer', () => {
    const contract = buildOrderContract({
      channel: 'families',
      language: 'es',
      age: 6,
      petName: 'Tino',
      bestFriendName: 'Mía',
      requestedText: [],
    });
    const found = checkTextContract(contract, pages('Tino ladra en el parque.'), null);
    expect(found.map((item) => item.clause)).toEqual(['requested_names']);
    expect(found[0]?.repair).toContain('«Mía»');
    expect(checkTextContract(contract, pages('Tino y Mia juegan.'), null)).toEqual([]);
  });

  it('los gustos que no aparecen se registran como blandos', () => {
    const contract = buildOrderContract({
      channel: 'families',
      language: 'es',
      age: 6,
      likes: ['dinosaurios'],
      requestedText: [],
    });
    const found = checkTextContract(contract, pages('Un día de playa.'), null);
    expect(found.map((item) => [item.clause, item.severity])).toEqual([['likes_present', 'soft']]);
    expect(checkTextContract(contract, pages('Un dinosaurio en la playa.'), null)).toEqual([]);
  });

  it('el Diario promete un encabezado en cada entrada', () => {
    const contract = buildOrderContract({
      channel: 'families',
      language: 'es',
      age: 10,
      tags: ['diario'],
      requestedText: [],
    });
    expect(contract.clauses.some((item) => item.id === 'template_promise')).toBe(true);
    const found = checkTextContract(
      contract,
      pages('Semana 1, lunes: el comienzo. Hoy empecé.', 'Hoy no pasó nada.'),
      null,
    );
    expect(found.map((item) => item.clause)).toEqual(['template_promise']);
    expect(found[0]?.pages).toEqual([2]);
  });
});

describe('sonido para practicar (Profesionales)', () => {
  const contract = buildOrderContract({
    channel: 'professionals',
    language: 'es',
    age: 4,
    practice: 'la s',
    requestedText: [],
  });

  it('el sonido elegido es una promesa de la plantilla', () => {
    expect(contract.promises.map((promise) => promise.id)).toEqual(['practice_sound']);
  });

  it('falla si el sonido casi no aparece (el silbido de Angélica nunca se escribió)', () => {
    const found = checkTextContract(
      contract,
      pages('Un ruido en el patio.', 'Miro debajo de la mesa.', 'Nada por acá.', 'Un pájaro.'),
      null,
    );
    expect(found.map((item) => item.clause)).toEqual(['template_promise']);
  });

  it('pasa con palabras que lo tienen en la mitad de las páginas', () => {
    const ok = pages(
      'Sss, sss, suena la serpiente.',
      'Sofía busca el sonido.',
      'Un ruido en el patio.',
      'Nada por acá.',
    );
    expect(checkTextContract(contract, ok, null)).toEqual([]);
    expect(practiceMissingPages(ok, 'la s')).toEqual([3, 4]);
  });
});

describe('imageContractNote', () => {
  it('lista solo a quienes el pedido permite, con las cláusulas de imagen', () => {
    const note = imageContractNote({
      companion: { name: 'Tino', look: 'a small brown dog' },
      cast: [{ role: 'the speech therapist', name: null }],
    });
    expect(note).toContain('the protagonist; Tino (a small brown dog); the speech therapist.');
    for (const clause of IMAGE_CONTRACT_CLAUSES) expect(note).toContain(`${clause}:`);
  });

  it('en Celebraciones los invitados de la fiesta están permitidos', () => {
    expect(imageContractNote({ partyGuests: true })).toContain('party guests');
    expect(imageContractNote({})).not.toContain('party guests');
  });

  it('la ropa puede cambiar si el texto de la página lo dice', () => {
    expect(imageContractNote({})).toContain('or the page text names other clothes');
  });
});

describe('cuánto falla un texto (DECISIONS 352)', () => {
  it('cuenta cada página de cada cláusula dura, así un arreglo parcial también se acepta', () => {
    const touch = (pages: number[]) => ({
      clause: 'no_touch' as const,
      stage: 'text' as const,
      severity: 'hard' as const,
      pages,
      repair: '',
    });
    const soft = { ...touch([1]), severity: 'soft' as const };
    expect(hardWeight([touch([2, 10])])).toBe(2);
    expect(hardWeight([touch([2])])).toBe(1);
    expect(hardWeight([touch([])])).toBe(1);
    expect(hardWeight([soft])).toBe(0);
    expect(hardWeight([touch([2])]) < hardWeight([touch([2, 10])])).toBe(true);
  });
});
