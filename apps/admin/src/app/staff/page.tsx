'use client';

import { ROLES, type Role } from '@storynido/shared';
import { useCallback, useState, type SubmitEvent } from 'react';

import { useAdminAuth } from '@/components/auth/admin-auth';
import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

/** Usuarios del panel: alta, baja y cambio de rol (solo el superadmin). */
export default function StaffPage() {
  const { role } = useAdminAuth();
  const load = useCallback(() => api('adminStaff'), []);
  const { data, error, reload } = useApi(load);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('admin');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const superadmin = role === 'superadmin';

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !window.confirm(
        `¿Cambiar el rol de ${email} a ${newRole}? Su sesión se cierra para tomar el nuevo rol.`,
      )
    )
      return;
    try {
      const result = await api('adminSetStaffRole', {
        body: { email: email.trim(), role: newRole },
      });
      setMessage({ text: `${result.email ?? email}: ${result.role}.`, error: false });
      setEmail('');
      await reload();
    } catch (caught) {
      setMessage({ text: errorMessage(caught), error: true });
    }
  }

  return (
    <>
      <PageHeader
        title="Usuarios del panel"
        text="Admin opera; superadmin además cambia IA, modelos y usuarios."
      />
      {error && <Notice tone="error">{error}</Notice>}
      {data && (
        <Card className="mb-4">
          <ul className="grid gap-1 text-sm">
            {data.staff.map((user) => (
              <li key={user.uid} className="flex justify-between">
                <span>{user.email ?? user.uid}</span>
                <span className="text-muted-foreground">{user.role}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {superadmin ? (
        <Card>
          <form onSubmit={(event) => void save(event)} className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">
              Email (la cuenta tiene que existir)
              <input
                type="email"
                required
                className="h-9 w-72 rounded-md border bg-background px-2"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Rol
              <select
                className="h-9 rounded-md border bg-background px-2"
                value={newRole}
                onChange={(event) => {
                  setNewRole(event.target.value as Role);
                }}
              >
                {ROLES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Guardar</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            «customer» quita el acceso al panel. No puedes cambiar tu propio rol y siempre queda un
            superadmin.
          </p>
        </Card>
      ) : (
        <Notice>Solo el superadmin gestiona los usuarios del panel.</Notice>
      )}
      {message && (
        <div className="mt-4">
          <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice>
        </div>
      )}
    </>
  );
}
