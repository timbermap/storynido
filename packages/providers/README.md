# @storynido/providers

Implementaciones de los proveedores externos (IA, pagos, imprenta, mails, storage) y el registro que elige cuál usar en tiempo de ejecución. Solo para Node (api y worker).

- Las **interfaces** están en `@storynido/shared` (`src/providers`).
- **Mocks** (`src/mock`) y **storage local** (`src/local`): deterministas, sin costo, para desarrollo y tests.
- **Registro** (`src/registry.ts`): lee la configuración de las variables de entorno (`AI_TEXT_PROVIDER`, `PAYMENT_PROVIDER`, etc.) y permite que `aiConfig` (Firestore, editable en el admin) cambie la IA sin redeploy.
- **Tests de contrato** (`@storynido/providers/testing`): cada implementación, simulada o real, tiene que pasar la misma suite.

Las implementaciones reales se suman en sus fases: Vertex AI (07), Cloud Storage (06), pagos (11), Gelato (12) y Resend (13).

- **Gumroad** (`src/gumroad/payment.ts`, DECISIONS 255): `PAYMENT_PROVIDER=gumroad` con `GUMROAD_PRODUCT_URL`, `GUMROAD_ACCESS_TOKEN` y `GUMROAD_PING_SECRET`. URL del producto con `wanted`, `price` y `order_id`; pings firmados (`X-Gumroad-Signature`) en `POST /v1/webhooks/payments/gumroad`; solo USD.
- **PayPal** (`src/paypal/payment.ts`, DECISIONS 276): `PAYMENT_PROVIDER=paypal` con `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` y `PAYPAL_WEBHOOK_ID` (`PAYPAL_ENV`: sandbox fuera de producción). Orders v2 con `intent: CAPTURE`, vuelve solo a la página del pedido; el webhook `CHECKOUT.ORDER.APPROVED` captura y `PAYMENT.CAPTURE.COMPLETED` confirma, verificados con `verify-webhook-signature`, en `POST /v1/webhooks/payments/paypal`; solo USD; IVA incluido.
- **Dodo Payments** (`src/dodo/payment.ts`, DECISIONS 244): `PAYMENT_PROVIDER=dodo` con `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PRODUCT_ID` y `DODO_ENV` (`test_mode` o `live_mode`). Un solo ítem con el total del servidor, solo USD; webhooks con Standard Webhooks en `POST /v1/webhooks/payments/dodo`.
