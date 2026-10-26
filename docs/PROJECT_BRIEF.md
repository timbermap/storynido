# StoryNido — Contexto general del proyecto (PROJECT_BRIEF)

> Este documento es el contexto común de todas las fases. Cada prompt de fase asume que lo leíste primero.

## Rol y objetivo

Sos un equipo senior de ingeniería full stack, arquitectura cloud, seguridad y producto. Construís de punta a punta, listo para producción, una plataforma web profesional y escalable llamada **"StoryNido"** (el nombre debe ser configurable), que vende cuentos infantiles personalizados generados con IA, en formato digital (PDF) e impreso bajo demanda.

El padre o la madre crea una cuenta, carga los datos del chico (nombre, edad, gustos, foto), elige una historia o temática, ve una vista previa gratis, paga, y el sistema genera automáticamente la historia, las ilustraciones con el chico como protagonista y el libro final. Si es impreso, el pedido se envía automáticamente a la API de impresión, que imprime en el país del cliente y despacha. Todo sin intervención humana.

## Marca y dominios

- Marca: **StoryNido** (configurable con `BRAND_NAME` / `NEXT_PUBLIC_BRAND_NAME`).
- Dominios registrados (vencen el 26/10/2027 los `.online`/`.store` y el 26/10/2028 el `.com`):
  - `storynido.com`: dominio principal del sitio público.
  - `admin.storynido.com`: panel super admin.
  - `api.storynido.com`: API pública (Cloud Run con dominio propio o detrás del balanceador).
  - `staging.storynido.com` y `admin.staging.storynido.com`: ambiente de staging.
  - `storynido.online` y `storynido.store`: redirección 301 a `storynido.com` (protección de marca, sin contenido propio).
- Emails transaccionales desde un subdominio de envío (por ejemplo `mail.storynido.com`) con SPF, DKIM y DMARC; remitente visible `hola@storynido.com`.
- El dominio también es configurable (`BRAND_DOMAIN` / `NEXT_PUBLIC_BRAND_DOMAIN`); nunca se hardcodea en el código.

## Reglas de trabajo (aplican a todas las fases)

- Trabajá de forma autónoma. Cuando falte una decisión menor, elegí la opción más estándar y documentala en `docs/DECISIONS.md`.
- No dejes funciones a medio hacer ni código de relleno tipo TODO en producción.
- TypeScript estricto en todo. Validación de todas las entradas con Zod, en cliente y servidor.
- Ninguna clave en el código ni en el repositorio: todo por Secret Manager (y `.env.local` ignorado por git en desarrollo).
- Todo debe funcionar en local con Firebase Emulator Suite y proveedores simulados (sin gastar en IA ni imprenta).
- Al terminar cada fase: compila, pasa lint + typecheck + tests, está documentada, y mostrás un **resumen de lo hecho, cómo probarlo y qué sigue**. Hacé commit al final de la fase con un mensaje claro.
- **Antes de empezar una fase**, corré `pnpm lint && pnpm typecheck && pnpm test`. Si algo de una fase anterior está roto o incompleto, arreglalo primero y avisame.
- **Versiones y modelos:** no asumas versiones de memoria. Verificá en la documentación oficial vigente la última versión estable de cada librería y los IDs de modelos disponibles en Vertex AI, y fijalos (sin rangos `^` en dependencias críticas).
- **Nada de valores hardcodeados de negocio:** dominio, nombre de marca, precios, países, límites y prompts salen de configuración (variables de entorno o Firestore), nunca del código.
- **Si una tarea necesita una cuenta o credencial que todavía no existe** (GCP, Stripe, Gelato, Resend, Apple), implementala completa contra el mock, dejá las instrucciones de conexión en `docs/SETUP.md` y seguí. No te bloquees.
- Mantené un `docs/PROGRESS.md` con el estado de cada fase (hecha / en curso / pendiente), lo que quedó fuera de alcance y los riesgos detectados.

## Stack obligatorio (todo en Google Cloud)

- **Monorepo** con pnpm workspaces y Turborepo: `apps/web`, `apps/admin`, `services/api`, `services/worker`, `packages/shared` (tipos, esquemas Zod, utilidades), `infra/`.
- **Frontend público:** Next.js (App Router, última estable), React Server Components, Tailwind CSS, shadcn/ui, Framer Motion para animaciones sutiles. Hospedado en Firebase App Hosting con dominio propio y SSL automático.
- **Panel super admin:** app Next.js separada en `apps/admin`, subdominio `admin.storynido.com`, mismo stack de UI.
- **Autenticación:** Firebase Authentication con Google, Apple y enlace mágico por mail (sin contraseñas). Login persistente. Roles por custom claims: `customer`, `admin`, `superadmin`.
- **Base de datos:** Firestore (modo nativo), reglas estrictas, índices definidos en código.
- **Archivos:** Cloud Storage con buckets separados: fotos originales (privado, borrado automático a los 30 días por ciclo de vida), assets generados, PDFs finales (solo URLs firmadas).
- **Backend API:** Cloud Run con Node.js y Fastify (o Hono), Zod, OpenAPI autogenerado.
- **Asíncrono:** Cloud Tasks y Pub/Sub para encolar; Cloud Workflows para orquestar el pipeline con reintentos y manejo de errores por paso. Worker en Cloud Run.
- **IA:** Vertex AI. Gemini (último modelo) para escribir y revisar historias; Imagen (último modelo) para ilustraciones. Capa `AIProvider` para cambiar de proveedor (ej. Claude para texto, Flux para imágenes) desde el panel admin sin tocar código.
- **Fotos:** Cloud Vision API (detectar cara, validar calidad, rechazar inválidas) + Sharp (recortar, normalizar, mejorar).
- **PDF:** en el worker, Playwright renderizando plantillas HTML a PDF en alta resolución (300 dpi, sangrado para imprenta).
- **Pagos:** Stripe Checkout y Stripe Billing, multimoneda (MXN, USD, EUR, COP, CLP, BRL), Apple Pay y Google Pay, webhooks verificados por firma. Abstracción `PaymentProvider` para sumar Mercado Pago.
- **Impresión:** API de Gelato (imprime en el país del cliente). Abstracción `PrintProvider` para sumar Lulu u otros. Webhooks de Gelato para estado y tracking.
- **Emails:** Resend (o SendGrid) con plantillas React Email en todos los idiomas.
- **Secretos:** Secret Manager.
- **IaC:** Terraform en `infra/`.
- **CI/CD:** GitHub Actions con Workload Identity Federation (sin claves JSON). Ambientes staging y production.
- **Observabilidad:** Cloud Logging estructurado, Cloud Monitoring con dashboards, alertas por mail, Error Reporting, OpenTelemetry.
- **Analítica:** GA4 y Meta Pixel / API de Conversiones, con consentimiento de cookies.

## Internacionalización y países

- Idiomas: español (neutro con ajustes por país), inglés y portugués de Brasil. `next-intl`. Rutas localizadas (`/es-mx`, `/en-us`, `/es-es`, `/pt-br`, etc.).
- Lanzamiento: fase 1 México y EE. UU.; fase 2 España; fase 3 Colombia, Chile, Perú, Brasil; fase 4 resto de Latinoamérica y Europa.
- Cada país se activa/desactiva desde el admin: formatos (digital, impreso o ambos), moneda, precio, impuestos, costo y tiempo de envío, idioma por defecto.
- Detección de país por IP, con cambio manual.

## Estados del pedido

`draft, preview_ready, pending_payment, paid, generating, qa_failed, ready, sent_to_print, in_production, shipped, delivered, refunded, cancelled`

## Calidad no negociable

- Diseño extremadamente profesional, cálido, orientado a la conversión, mobile first.
- Lighthouse > 90 en todas las categorías. Accesibilidad WCAG 2.2 AA.
- Las fotos de menores son datos sensibles (ver fase de seguridad): cifrado, acceso solo por cuentas de servicio, URLs firmadas cortas, borrado a 30 días y a pedido.
- Todo serverless con autoescalado, preparado para miles de pedidos por día sin cambiar la arquitectura.
- Tests: Vitest (unit), integración de API y pipeline con proveedores simulados, Playwright E2E.

## Fases

01 Monorepo base · 02 Terraform · 03 Auth y datos · 04 API y proveedores · 05 Sitio público · 06 Creador y fotos · 07 Motor IA y vista previa · 08 Pipeline · 09 Generación y QA · 10 PDF · 11 Stripe · 12 Gelato · 13 Emails · 14 Admin configuración · 15 Admin operaciones · 16 Observabilidad y seguridad · 17 E2E y rendimiento · 18 Documentación y salida
