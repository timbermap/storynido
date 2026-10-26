import { z } from 'zod';

export const ROLES = ['customer', 'admin', 'superadmin'] as const;

export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;

/**
 * Rol de un usuario a partir de los custom claims de su token de Firebase.
 * Sin claim (o con un valor desconocido) el usuario es `customer`.
 */
export function roleFromClaims(claims: Readonly<Record<string, unknown>> | undefined): Role {
  const parsed = roleSchema.safeParse(claims?.role);
  return parsed.success ? parsed.data : 'customer';
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'superadmin';
}
