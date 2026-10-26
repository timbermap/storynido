# @storynido/providers

Implementaciones de los proveedores externos (IA, pagos, imprenta, mails, storage) y el registro que elige cuál usar en tiempo de ejecución. Solo para Node (api y worker).

- Las **interfaces** están en `@storynido/shared` (`src/providers`).
- **Mocks** (`src/mock`) y **storage local** (`src/local`): deterministas, sin costo, para desarrollo y tests.
- **Registro** (`src/registry.ts`): lee la configuración de las variables de entorno (`AI_TEXT_PROVIDER`, `PAYMENT_PROVIDER`, etc.) y permite que `aiConfig` (Firestore, editable en el admin) cambie la IA sin redeploy.
- **Tests de contrato** (`@storynido/providers/testing`): cada implementación, simulada o real, tiene que pasar la misma suite.

Las implementaciones reales se suman en sus fases: Vertex AI (07), Cloud Storage (06), Stripe (11), Gelato (12) y Resend (13).
