'use client';

import { TotpMultiFactorGenerator, multiFactor, type TotpSecret } from 'firebase/auth';
import { KeyRound } from 'lucide-react';
import QRCode from 'qrcode';
import { useState, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';

import { useAdminAuth } from './admin-auth';
import { CodeInput } from './code-input';

/**
 * Alta del segundo factor (TOTP: Google Authenticator, 1Password, Authy…). Después de
 * registrarlo se vuelve a iniciar sesión, ya con el código, para que la sesión quede verificada.
 */
export function MfaEnroll() {
  const { user, signOut } = useAdminAuth();
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const session = await multiFactor(user).getSession();
      const generated = await TotpMultiFactorGenerator.generateSecret(session);
      const uri = generated.generateQrCodeUrl(user.email ?? user.uid, `${brand.name} Admin`);
      setQr(await QRCode.toDataURL(uri, { margin: 1, width: 220 }));
      setUri(uri);
      setSecret(generated);
    } catch (caught) {
      const code = typeof caught === 'object' && caught && 'code' in caught ? caught.code : '';
      setError(
        code === 'auth/requires-recent-login'
          ? 'Por seguridad, vuelve a iniciar sesión y repite este paso.'
          : 'No pudimos generar el código. ¿Está activada la verificación en dos pasos en el proyecto?',
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !secret) return;
    setBusy(true);
    setError(null);
    try {
      await multiFactor(user).enroll(
        TotpMultiFactorGenerator.assertionForEnrollment(secret, code),
        'App autenticadora',
      );
      // La sesión actual no tiene el segundo factor: se entra de nuevo, ya con el código.
      await signOut();
    } catch {
      setError('El código no coincide. Revisa la hora del teléfono y prueba con el siguiente.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <header className="space-y-2 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-primary">
          <KeyRound className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold">Configura la verificación en dos pasos</h1>
        <p className="text-sm text-muted-foreground">
          El panel la exige. Usa una app autenticadora en tu teléfono.
        </p>
      </header>
      {!secret ? (
        <Button onClick={() => void start()} disabled={busy}>
          Empezar
        </Button>
      ) : (
        <form onSubmit={(event) => void confirm(event)} className="grid gap-4">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- QR generado en el navegador
            <img src={qr} alt="Código QR para la app autenticadora" className="mx-auto size-56" />
          )}
          <p className="text-center text-sm text-muted-foreground">
            Escanea el código con tu app autenticadora (Google Authenticator, 1Password, Authy).
          </p>
          {uri && (
            // En el teléfono no se puede escanear la propia pantalla: el enlace abre la app.
            <Button asChild variant="outline">
              <a href={uri}>Abrir en la app autenticadora (desde el teléfono)</a>
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            ¿No puedes escanearlo ni abrirla? En la app elige “Ingresar una clave de configuración”,
            pon cualquier nombre (por ejemplo, StoryNido) y esta clave, con el tipo “Basada en el
            tiempo”:
            <code className="mt-1 block font-mono text-sm break-all text-foreground">
              {secret.secretKey}
            </code>
          </p>
          <CodeInput value={code} onChange={setCode} />
          <Button type="submit" disabled={busy || code.length !== 6}>
            Confirmar
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button variant="ghost" onClick={() => void signOut()}>
        Salir
      </Button>
    </main>
  );
}
