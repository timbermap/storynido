import { OAuth2Client } from 'google-auth-library';

/** Verifica quién llama a las rutas /jobs (trabajos programados, sin sesión de Firebase). */
export interface JobCallerVerifier {
  verify(idToken: string): Promise<boolean>;
}

/**
 * Cloud Scheduler llama con un token OIDC de Google firmado para la cuenta de servicio
 * invocadora: se acepta solo ese correo y esa audiencia (la API es pública).
 */
export class GoogleJobCallerVerifier implements JobCallerVerifier {
  private readonly client = new OAuth2Client();

  constructor(
    private readonly audience: string,
    private readonly email: string,
  ) {}

  async verify(idToken: string): Promise<boolean> {
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audience });
      const payload = ticket.getPayload();
      return payload?.email === this.email && payload.email_verified === true;
    } catch {
      return false;
    }
  }
}
