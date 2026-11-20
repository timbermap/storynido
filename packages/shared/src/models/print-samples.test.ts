import { describe, expect, it } from 'vitest';

import { TAX_ID_REQUIRED_COUNTRIES, addressProblems } from './commerce';
import { SAMPLE_PRINT_ADDRESSES } from './print-samples';

describe('SAMPLE_PRINT_ADDRESSES', () => {
  it('lleva documento válido donde el checkout lo exige (Lulu rechaza la cotización sin él)', () => {
    for (const country of TAX_ID_REQUIRED_COUNTRIES) {
      const sample = SAMPLE_PRINT_ADDRESSES[country];
      if (!sample) continue;
      expect(addressProblems({ ...sample, country })).not.toContain('taxId');
    }
  });
});
