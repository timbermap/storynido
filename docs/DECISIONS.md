# Decisiones técnicas

Formato: cada decisión tiene fecha, contexto, decisión, alternativas consideradas y motivo. Las más nuevas van al final.

---

## 001 · Estructura del monorepo y nombres de paquetes

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** pnpm workspaces + Turborepo. Paquetes con el scope `@storynido/*`: `apps/web`, `apps/admin`, `services/api`, `services/worker`, `packages/shared`. La configuración común (tsconfig, ESLint, Prettier) vive en la raíz y no en paquetes `config-*` separados.
- **Motivo:** con solo cinco paquetes, la configuración en la raíz es más simple de mantener. Se puede extraer a paquetes si crece.

## 002 · `@storynido/shared` como paquete "just-in-time"

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** el paquete compartido expone su código TypeScript directamente (`exports` → `src/*.ts`), sin build propio. Next.js lo transpila con `transpilePackages` y los servicios lo empaquetan con tsdown (`deps.alwaysBundle`).
- **Alternativas:** compilarlo a `dist/` con tsc (requiere watch en dev y orden de build).
- **Motivo:** cambios instantáneos en desarrollo y sin pasos de build intermedios.
- **Subpaths:** `@storynido/shared` (seguro para navegador) y `@storynido/shared/server` (solo Node: logging, entorno).

## 003 · TypeScript 6.0 (no 7.0)

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** TypeScript 6.0.3.
- **Motivo:** TypeScript 7.0 (compilador nativo) ya es estable, pero `typescript-eslint` 8.72 solo soporta `<6.1`. Revisar cuando typescript-eslint soporte TS 7.
- **Configuración estricta:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`. No se activó `exactOptionalPropertyTypes` porque genera fricción con tipos de Next.js y Firebase sin un beneficio claro.

## 004 · ESLint 9 (no 10)

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** ESLint 9.39 con flat config, `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, `eslint-config-next` para las apps y `eslint-config-prettier`. Lint con `--max-warnings=0`.
- **Motivo:** `eslint-config-next` depende de `eslint-plugin-react`, `eslint-plugin-import` y `eslint-plugin-jsx-a11y`, que todavía no declaran soporte para ESLint 10. Migrar cuando lo hagan.

## 005 · Node.js 24 LTS

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** Node 24 (LTS activo) en `.nvmrc`, imágenes Docker y CI. `engines.node >=24`.
- **Motivo:** las versiones impares (25) no son LTS y Vitest 5 no las declara soportadas. Cloud Run y Firebase App Hosting soportan Node 24.

## 006 · Fastify para api y worker

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** Fastify 5 en ambos servicios.
- **Alternativas:** Hono.
- **Motivo:** ecosistema maduro para lo que viene (OpenAPI vía `@fastify/swagger`, rate limit, helmet, integración con Zod) y logger pino integrado.

## 007 · Health check en `/health`, no `/healthz`

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** el endpoint de salud es `GET /health`.
- **Motivo:** Cloud Run reserva las rutas que terminan en `z` (como `/healthz`) y no llegan al contenedor.

## 008 · Logs JSON compatibles con Cloud Logging

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** pino con `severity` (mapeado desde el nivel) y `message`, más el campo `service`. Sin pretty-print para que local y producción sean idénticos.

## 009 · Imágenes Docker con `pnpm deploy --legacy`

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** build multi-stage: se instala el monorepo, se compila el servicio con tsdown, y `pnpm deploy --prod --legacy` arma un `node_modules` solo con dependencias de producción. La imagen final corre como usuario `node`.
- **Motivo:** pnpm 10+ exige `inject-workspace-packages` para el deploy normal, lo que rompería la recarga en caliente de `@storynido/shared` en desarrollo. `@storynido/shared` es devDependency de los servicios porque se empaqueta dentro del bundle.
- **Nota:** Docker no estaba instalado en la máquina de desarrollo; las imágenes se validan en CI (job `docker`).

## 010 · Monedas: se agrega PEN

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** monedas soportadas: MXN, USD, EUR, COP, CLP, **PEN**, BRL.
- **Motivo:** Perú está en la fase 3 de lanzamiento y el prompt original no incluía su moneda. Montos siempre en enteros en la unidad mínima; CLP tiene 0 decimales (como en Stripe).

## 011 · Locales iniciales

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** `es-mx`, `en-us`, `es-us`, `es-es`, `es-co`, `es-cl`, `es-pe`, `pt-br`. Locale por defecto: `es-mx`.
- **Motivo:** el lanzamiento en EE. UU. apunta a público hispano y anglo, por eso se agrega `es-us`. La activación real de cada país se configura en Firestore (fase 03 y admin).

## 012 · shadcn/ui configurado a mano

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** `components.json` (estilo new-york, Tailwind v4, lucide) y el componente `Button` escritos manualmente; los demás componentes se agregan con `pnpm dlx shadcn@latest add <componente>` dentro de cada app.
- **Motivo:** evitar los prompts interactivos del CLI. Tokens de color con una paleta cálida provisoria; el sistema de diseño final se define en la fase 05.

## 013 · Versiones fijadas

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** todas las dependencias con versión exacta (sin `^`). Versiones verificadas en npm el 2026-10-26. Actualizaciones controladas con Renovate/Dependabot (a configurar en la fase 16).

## 014 · Nombre definitivo: StoryNido

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** la marca pasa de "MiCuento" (provisorio) a **StoryNido**. Se registraron `storynido.com`, `storynido.online` y `storynido.store`. El repo, el scope de paquetes (`@storynido/*`) y los valores por defecto se renombraron. Se agregó el dominio a la configuración de marca (`BRAND_DOMAIN`).
- **Dominios:** `.com` es el principal; `.online` y `.store` redirigen con 301 al `.com` (se configura en la fase 02 / fase 05).

## 015 · Un solo `.env.local` en la raíz y secretos en Secret Manager

- **Fecha:** 2026-10-26 · **Fase:** 01
- **Decisión:** en desarrollo, todas las claves de todas las plataformas viven en un único `.env.local` en la raíz (permisos 600, ignorado por git). Las apps Next.js lo cargan con `loadEnvConfig` de `@next/env` y los servicios con `tsx --env-file-if-exists`. `.env.example` documenta cada variable y marca los secretos. En staging y producción no hay archivos: Secret Manager → variables de entorno. gitleaks corre en CI sobre todo el historial.
- **Alternativas:** un `.env.local` por app (claves duplicadas en varios archivos, fácil que queden desincronizadas); gestores externos como Doppler o 1Password CLI (otra cuenta y otra dependencia).
- **Motivo:** un solo lugar para las claves en local, y en la nube el estándar de Google Cloud que ya usa el proyecto.

## 016 · Un proyecto de Google Cloud por ambiente

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** `staging` y `production` en proyectos separados (sugeridos: `storynido-staging`, `storynido-prod`), cada uno con su state de Terraform en un bucket propio (`<proyecto>-tfstate`, versionado). Un módulo `environment` compone todos los módulos; `envs/<ambiente>` solo define provider, backend y valores.
- **Alternativas:** un solo proyecto con recursos sufijados; workspaces de Terraform.
- **Motivo:** aislamiento real de datos (fotos de menores), IAM y cuotas; un error en staging no puede tocar producción. Presupuestos separados.

## 017 · Región us-central1 y Firestore nam5

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** Cloud Run, Tasks, Workflows, Artifact Registry y buckets en `us-central1`; Firestore en `nam5` (multirregión de EE. UU.).
- **Motivo:** el lanzamiento es México y EE. UU.; `us-central1` tiene la mayor disponibilidad de modelos de Vertex AI, soporta mapeo de dominios en Cloud Run y es de las regiones más baratas. La ubicación de Firestore no se puede cambiar después.

## 018 · Cuentas de servicio y permisos

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** cinco cuentas: `sn-api`, `sn-worker`, `sn-workflows`, `sn-invoker` y `sn-deployer`. Los permisos sobre buckets, secretos, servicios y el registro se dan a nivel de recurso, no de proyecto. `sn-invoker` es la identidad OIDC de Cloud Tasks, Pub/Sub y Scheduler para llamar al worker, que es privado. Cada secreto declara qué cuentas lo pueden leer.
- **Motivo:** mínimo privilegio. Por ejemplo, el worker no puede leer la clave de Stripe y la API no puede escribir PDFs.

## 019 · Privacidad de las fotos en Storage

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** el bucket de fotos originales tiene borrado automático a 30 días, versionado apagado y **soft delete desactivado** (`retention_duration_seconds = 0`). Cifrado en reposo con claves administradas por Google; CMEK se evalúa en la fase 16.
- **Motivo:** el soft delete de Cloud Storage (7 días por defecto) conservaría las fotos después de un borrado a pedido del cliente.

## 020 · Deploys sin claves JSON y con environments de GitHub

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** Workload Identity Federation con condición sobre el repo `timbermap/storynido` y su `repository_owner_id` (157223336). El deployer de cada proyecto solo acepta tokens de jobs que corren en el environment de GitHub del mismo nombre (`attribute.environment`). Staging se despliega cuando el CI de `main` termina en verde (`workflow_run`); production, al publicar un tag `v*` o manualmente.
- **Motivo:** las reglas de aprobación obligatoria de los environments no están disponibles en repos privados de cuentas gratuitas de GitHub; publicar el tag es el paso manual de aprobación. Si se pasa a GitHub Pro/Team, agregar _required reviewers_ al environment `production`.
- **Nota:** los deploys están apagados (`DEPLOY_ENABLED`) hasta que exista la infraestructura, para no fallar en cada push.

## 021 · Terraform no maneja la imagen de Cloud Run

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** Terraform crea los servicios con una imagen pública de ejemplo e ignora `image` (`lifecycle.ignore_changes`); GitHub Actions despliega las imágenes con `gcloud run deploy --image`. Toda otra configuración (escalado, variables, cuentas de servicio) sigue en Terraform.
- **Motivo:** separar infraestructura de releases sin que `terraform apply` revierta el último deploy.

## 022 · Secretos no montados todavía en Cloud Run

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** los secretos se declaran sin valor y no se montan aún como variables de entorno en los servicios.
- **Motivo:** Cloud Run falla al desplegar si referencia un secreto sin versiones. Cada fase que use un secreto lo monta en Terraform cuando su valor ya esté cargado.

## 023 · Firebase App Hosting conectado fuera de Terraform

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** Terraform crea el proyecto Firebase y las apps web (`web`, `admin`) y habilita las APIs de App Hosting y Developer Connect. Los backends de App Hosting se crean con `firebase apphosting:backends:create`, porque conectar GitHub requiere autorizar la app de Firebase en el navegador. La configuración de runtime está versionada en `apps/*/apphosting.yaml` (production) y `apphosting.staging.yaml`.

## 024 · Proyectos separados de Timbermap y configuración aislada de gcloud

- **Fecha:** 2026-10-26 · **Fase:** 02
- **Decisión:** StoryNido vive en proyectos propios (`storynido-staging`, después `storynido-prod`) dentro de la organización timbermap.com, nunca en `timbermap-prod` (producción en vivo de Timbermap). Se usa una configuración de gcloud `storynido` que **no** se activa globalmente: los comandos se corren con `CLOUDSDK_ACTIVE_CONFIG_NAME=storynido` para no cambiar la configuración por defecto que usa Timbermap. Las credenciales ADC no se modifican: los providers de Terraform fijan `billing_project` en el proyecto de StoryNido.
- **Facturación:** cuenta Forestech Uruguay SRL (01F57C-…). Si StoryNido pasa a ser otra empresa, mover los proyectos a una cuenta propia (no requiere cambios de Terraform salvo `billing_account`).

## 025 · Roles: sin claim = customer; admin y superadmin solo por script de servidor

- **Fecha:** 2026-10-26 · **Fase:** 03
- **Decisión:** el rol es el custom claim `role`. Un usuario sin claim es `customer` (`roleFromClaims` en `@storynido/shared` y `request.auth.token.get('role', 'customer')` en las reglas), así que todo usuario nuevo es customer sin pasos extra. `admin` y `superadmin` se asignan con `firebase/src/set-role.ts` (Admin SDK), que además deja el cambio en `auditLog` y se niega a operar sobre proyectos `timbermap*`. Un rol desconocido se trata como customer.
- **Alternativas:** Cloud Function `beforeCreate` (requiere Identity Platform y Functions, más infraestructura) o un endpoint que asigne `customer` en el primer login (una llamada extra sin beneficio de seguridad).
- **Motivo:** más simple y sin ventanas en las que un usuario no tenga rol. El panel admin (fase 15) usará la misma lógica vía API.

## 026 · Escrituras sensibles solo desde el servidor, incluso para admins

- **Fecha:** 2026-10-26 · **Fase:** 03
- **Decisión:** el cliente solo escribe su perfil (`users`), los perfiles de sus chicos (`children`) y los campos editables de sus borradores (`books`). Pedidos, fotos, consentimientos, precios, catálogo, configuración y auditoría tienen `allow write: if false`: los escribe el servidor con el Admin SDK. Los admins leen todo, pero escriben a través de la API.
- **Motivo:** así ningún cliente modificado puede cambiar precios, estados o costos, y toda acción de un admin queda auditada en un solo lugar (fase 14). Las reglas validan tipos, tamaños y campos permitidos, y que un libro solo use perfiles de chicos propios.

## 027 · Emuladores con proyecto `demo-storynido` y paquete `firebase/`

- **Fecha:** 2026-10-26 · **Fase:** 03
- **Decisión:** reglas, índices, tests de reglas, seed y scripts viven en el paquete `@storynido/firebase` (carpeta `firebase/`); `firebase.json` en la raíz. Los emuladores usan el proyecto `demo-storynido`: los proyectos `demo-*` no pueden conectarse a Google Cloud. Firestore usa el puerto 8180 porque la API usa el 8080. `firebase-tools` es dependencia fijada del repo (no se usa la global).
- **Tests:** 32 tests de reglas (Firestore y Storage) + test de integración del login por enlace mágico con Auth y Firestore reales del emulador. Se verificó que debilitar una regla hace fallar los tests.

## 028 · Login en el cliente con el SDK web y perfil creado por el usuario

- **Fecha:** 2026-10-26 · **Fase:** 03
- **Decisión:** `apps/web` usa el SDK web de Firebase (popup para Google y Apple, enlace mágico por mail) con persistencia local del navegador. Al primer login el propio usuario crea `users/{uid}` con los campos que permiten las reglas. Por ahora la UI de login está solo en español; la internacionalización llega en la fase 05.
- **Pendiente para staging/producción:** habilitar los proveedores en Firebase (ver `docs/SETUP.md`). Apple requiere una cuenta del Apple Developer Program (USD 99/año).

## 029 · Reglas e índices de Firestore desplegados por CI

- **Fecha:** 2026-10-26 · **Fase:** 03
- **Decisión:** el workflow de deploy publica `firestore.rules` y `firestore.indexes.json` con `firebase deploy --only firestore`, autenticado por Workload Identity Federation. El deployer suma los roles `firebaserules.admin`, `datastore.indexAdmin`, `firebase.viewer` y `serviceusage.serviceUsageConsumer`. Las reglas de Storage no se despliegan: no se usa el bucket por defecto de Firebase, y los buckets reales son privados por IAM.
