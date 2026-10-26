import { describe, expect, it } from 'vitest';

import { isAdminRole, roleFromClaims } from './roles';

describe('roles', () => {
  it('sin claim el usuario es customer', () => {
    expect(roleFromClaims(undefined)).toBe('customer');
    expect(roleFromClaims({})).toBe('customer');
  });

  it('lee roles válidos e ignora valores desconocidos', () => {
    expect(roleFromClaims({ role: 'admin' })).toBe('admin');
    expect(roleFromClaims({ role: 'superadmin' })).toBe('superadmin');
    expect(roleFromClaims({ role: 'root' })).toBe('customer');
  });

  it('admin y superadmin son roles de administración', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('superadmin')).toBe(true);
    expect(isAdminRole('customer')).toBe(false);
  });
});
