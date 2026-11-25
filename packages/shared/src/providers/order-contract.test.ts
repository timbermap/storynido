import { describe, expect, it } from 'vitest';

import {
  buildOrderContract,
  checkFormContract,
  checkPlanContract,
  checkTextContract,
  familyRolesIn,
  hardViolations,
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
