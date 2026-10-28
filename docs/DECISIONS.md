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

## 030 · Contrato de API compartido en lugar de generar código desde OpenAPI

- **Fecha:** 2026-10-26 · **Fase:** 04
- **Decisión:** las rutas se definen una sola vez en `@storynido/shared` (`apiRoutes`: método, path, acceso y esquemas Zod). La API registra cada ruta desde ese contrato (validación, serialización, OpenAPI y control de acceso) y los clientes usan `createApiClient`, que tipa cada llamada y valida la respuesta con Zod. El OpenAPI (`/docs`) se genera desde los mismos esquemas con `fastify-type-provider-zod`.
- **Alternativas:** generar un cliente desde OpenAPI (paso de build extra y tipos menos precisos).
- **Motivo:** una sola fuente de verdad, sin generación de código, y cualquier diferencia entre servidor y cliente se detecta en compilación o al validar.

## 031 · Proveedores: interfaces en shared, implementaciones en `@storynido/providers`

- **Fecha:** 2026-10-26 · **Fase:** 04
- **Decisión:**
  - Las interfaces viven en `@storynido/shared`; las implementaciones, en el paquete Node `@storynido/providers`.
  - La IA se divide en `AITextProvider` y `AIImageProvider`, porque el admin elige cada una por separado.
  - Un `ProviderRegistry` elige la implementación según las variables de entorno. Para la IA, además, usa `aiConfig` en Firestore, escuchado en vivo, así que se cambia sin redeploy.
  - El registro falla al arrancar si se pide un proveedor no disponible, rechaza una `aiConfig` inválida conservando la anterior, y en producción no permite proveedores simulados.
- **Mocks:**
  - Son deterministas y no cuestan nada.
  - Los webhooks simulados se firman con HMAC, igual que los reales.
  - La imprenta simulada emite la secuencia completa de estados.
  - El marcador `[[unsafe]]` fuerza un rechazo de moderación, para probar el control de calidad.
- **Contratos:** `@storynido/providers/testing` tiene una suite por tipo de proveedor. Los mocks ya la pasan; cada implementación real tendrá que pasar la misma.

## 032 · Storage local con URLs firmadas imitando Cloud Storage

- **Fecha:** 2026-10-26 · **Fase:** 04
- **Decisión:** en desarrollo, `LocalStorageService` guarda archivos en disco y emite URLs firmadas (HMAC, con vencimiento, operación y Content-Type) que sirve la API en `/dev/storage`. Esa ruta solo existe fuera de producción y no aparece en OpenAPI. Así el flujo de subida desde el navegador de la fase 06 se prueba en local igual que en la nube.
- **Nota:** en staging la API usa storage local (efímero) hasta que la fase 06 agregue Cloud Storage.

## 033 · Rate limiting en memoria por instancia

- **Fecha:** 2026-10-26 · **Fase:** 04
- **Decisión:** `@fastify/rate-limit` con contador en memoria, por usuario si hay sesión y por IP si no (detrás del balanceador de Cloud Run, con `trustProxy`). 120 requests por minuto por defecto (`RATE_LIMIT_PER_MINUTE`).
- **Límite conocido:** con varias instancias el límite efectivo se multiplica. Es suficiente como freno; si hace falta un límite global, se puede usar Memorystore (Redis) o Cloud Armor (fase 16).

## 034 · App Check listo pero apagado fuera de producción

- **Fecha:** 2026-10-26 · **Fase:** 04
- **Decisión:** las rutas sensibles declaran `{ appCheck: true }` y la API verifica el header `X-Firebase-AppCheck` con el Admin SDK. Se exige por defecto solo con `APP_ENV=production` (`APP_CHECK_ENFORCED` lo puede forzar). En local y staging queda apagado hasta configurar reCAPTCHA Enterprise / App Check en la web (fase 05-06).

## 035 · Emuladores de test separados de los de desarrollo

- **Fecha:** 2026-10-26 · **Fase:** 04
- **Decisión:** los tests que usan emuladores corren con `firebase.test.json` (otros puertos: Auth 19099, Firestore 18180, Storage 19199) y el proyecto `demo-storynido-test`, mediante `firebase/scripts/with-test-emulators.sh`. Turbo los corre en serie (`@storynido/api#test` depende de `@storynido/firebase#test`).
- **Motivo:** reutilizar los emuladores de desarrollo mezclaba los datos: el emulador de Auth en modo de un solo proyecto emite tokens del proyecto de desarrollo. Ahora `pnpm test` funciona con o sin `pnpm emulators` corriendo y nunca toca los datos locales.

## 036 · Rutas solo por idioma; el país es un ajuste aparte

- **Fecha:** 2026-10-26 · **Fase:** 05 · **Decidido por:** Sebastián
- **Decisión:** las URLs llevan solo el idioma (`/es`, `/en`, `/pt`) con slugs traducidos (`/es/historias`, `/en/stories`). El país de envío (moneda, precio, formatos, envío) se guarda aparte en la cookie `sn_country`. Al primer acceso se detecta por header de geolocalización de la CDN o balanceador (`X-Client-Country`), si no por la región de `Accept-Language`, y si no por el país principal del idioma. El visitante lo cambia con un selector. `es` es español neutro (con "tú"); `es-es` se agrega al lanzar España.
- **Alternativas:** idioma + país (`/es-mx`, propuesta del prompt original), con muchas URLs casi duplicadas; solo país (`/mx`), que no resuelve EE. UU. con dos idiomas.
- **Motivo:** el contenido es el mismo para todos los países de un idioma. Así se concentra el SEO en una URL por idioma y hay menos páginas que mantener.
- **Si el país no está disponible:** se muestran los precios del país principal del idioma, o del primero activo, con un aviso visible.
- **Modelo:** `Locale` = `es | en | pt` reemplaza al anterior `es-mx…` en Firestore, reglas, mails e IA.

## 037 · El sitio lee el catálogo y el contenido desde la API

- **Fecha:** 2026-10-26 · **Fase:** 05
- **Decisión:** la web obtiene historias, estilos, países, ofertas por país y textos (legales, FAQ) de endpoints públicos de la API (`/v1/catalog/*`, `/v1/content/:key`). La API cachea Firestore 60 s y Next cachea las respuestas 5 minutos; el modo del sitio, 15 s. Si la API no responde, las páginas muestran lo que pueden (sin precios) en lugar de fallar.
- **Motivo:** una sola puerta de entrada a los datos (la misma que usará el admin), sin credenciales de servidor en la web y con cache en dos niveles.

## 038 · Rendimiento: Firebase diferido, hero sin JavaScript y fuentes livianas

- **Fecha:** 2026-10-26 · **Fase:** 05
- **Decisión:**
  - Firebase Auth se inicializa cuando el navegador está libre (`requestIdleCallback`) y sin el manejador de ventanas emergentes. Ese manejador, que descarga ~70 KB de Google, se pasa recién en `signInWithPopup`.
  - Firestore solo se carga después de iniciar sesión.
  - El modo del sitio se lee en el servidor.
  - El libro del hero se renderiza en el servidor con animación CSS.
  - Solo viajan al navegador los textos que usan los componentes de cliente.
  - Fraunces sin los ejes opcionales.
- **Resultado (Lighthouse móvil, 4G simulado, build de producción):** 94-95 de rendimiento y 100 de accesibilidad, buenas prácticas y SEO en home, catálogo, detalle, blog y legales, en los tres idiomas.
- **Motion:** se quitó del sitio público. El efecto del hero se logra con CSS sin costo de carga. Se vuelve a evaluar para las interacciones del creador (fase 06).

## 039 · Configuración web de Firebase inyectada por App Hosting

- **Fecha:** 2026-10-26 · **Fase:** 05
- **Decisión:** en App Hosting la web usa `initializeApp()` sin opciones: App Hosting inyecta la configuración del proyecto. En local se usan los valores demo de los emuladores; `NEXT_PUBLIC_FIREBASE_*` queda como alternativa explícita. Así no hay claves de Firebase en el repo (aunque sean públicas, gitleaks las marcaría).

## 040 · Contenido de lanzamiento: textos base y portadas provisorias

- **Fecha:** 2026-10-26 · **Fase:** 05
- **Decisión:**
  - Los textos legales (términos, privacidad, cookies, reembolsos y envíos) y la FAQ son **textos base** en los tres idiomas, con datos de la empresa entre corchetes (`[Razón social]`, `[domicilio]`). **Tienen que revisarse con asesoría legal antes del lanzamiento** (ver checklist de la fase 18).
  - Las portadas de las 6 historias son ilustraciones SVG propias y provisorias, que se reemplazan por ilustraciones generadas con IA (fase 07).
  - La sección de testimonios no se muestra hasta tener reseñas reales (la fase 13 las pide automáticamente). No se publican testimonios inventados.

## 041 · Consentimiento de cookies propio con Google Consent Mode v2

- **Fecha:** 2026-10-26 · **Fase:** 05
- **Decisión:** banner y diálogo propios (sin servicios de terceros). Las cookies necesarias están siempre activas; analítica y marketing arrancan apagadas. La elección se guarda en `sn_consent` por 6 meses y se puede cambiar desde el pie de página. GA4 y Meta Pixel solo se cargan con consentimiento y si sus IDs están configurados, con Consent Mode v2 (todo denegado por defecto).

## 042 · robots.txt cerrado fuera de producción

- **Fecha:** 2026-10-26 · **Fase:** 05
- **Decisión:** `robots.txt` permite indexar solo con `NEXT_PUBLIC_SITE_ENV=production`. En staging y en local bloquea todo, para que Google no indexe sitios de prueba. El sitemap incluye cada página en los tres idiomas con sus alternativas `hreflang`. Los artículos del blog existen en un solo idioma y no tienen alternativas.

## 043 · Branding v2: lavanda editorial

- **Fecha:** 2026-10-26 · **Fase:** 05 · **Decidido por:** Sebastián
- **Decisión:** se adopta la guía de marca v2 ("magia editorial + confianza"), resumida en `docs/BRAND.md`. Incluye paleta crema + violeta `#79518C` + pasteles, lema "Historias que abrazan", hero "Tu hijo es el héroe de esta historia." y CTA "Crear una vista previa gratis", más tarjetas y pasos al estilo de la guía, en los tres idiomas.
- **Ajustes respecto de la guía y sus maquetas:**
  - Español neutro con "tú" (las maquetas usaban voseo).
  - Sin "envío a todo el mundo", sin "miles de familias" y sin testimonios de muestra.
  - El paso 2 es "Elige una aventura" en lugar de "La IA crea su historia".
  - Los tokens se integraron al tema de Tailwind en lugar de importar `storynido.css`, para no duplicar fuentes de verdad, no cargar las fuentes con `@import` y no pisar estilos globales.
- **Resultado:** Lighthouse móvil 93-96 de rendimiento y 100 en accesibilidad, buenas prácticas y SEO después del rediseño.

## 044 · Enseñanzas combinables con cualquier aventura

- **Fecha:** 2026-10-26 · **Fase:** 05 · **Decidido por:** Sebastián
- **Decisión:** se separan dos elecciones que se combinan:
  - **Aventura** (`stories`): escenario e ilustraciones.
  - **Enseñanza** (`lessons`): el mensaje que la IA integra en la trama sin sermonear, adaptado a la edad.
- **Lanzamiento:** 16 enseñanzas en 4 grupos:
  - Valores: compartir, amistad, respetar las diferencias, cuidar la naturaleza, decir la verdad.
  - Confianza: "puedes lograr lo que te propongas", valentía, está bien equivocarse, ser uno mismo.
  - Momentos de la vida: llega un hermanito, primer día de clases, dormir solo, dejar el pañal o el chupete, mudanza.
  - Emociones: manejar el enojo, calma cuando estoy nervioso.
- **Mensaje propio:** el adulto también puede escribir el suyo (`books.customLesson`, hasta 150 caracteres, moderado antes de usarse).
- **Catálogo:** "Llega un hermanito" y "Primer día de clases" dejan de ser historias y pasan a ser enseñanzas. Se suman las aventuras "Amigos de la selva" y "El secreto del fondo del mar" (7 en total).
- **Temas sensibles** (pérdida de una mascota o de un familiar, separaciones): campo `sensitive`, excluidos del catálogo hasta tener revisión humana del texto generado.
- **SEO:** cada enseñanza tiene su página (`/es/ensenanzas/llega-un-hermanito`, `/en/lessons/…`, `/pt/licoes/…`) con las aventuras que se le combinan, y está en el sitemap.
- **Motivo:** los padres buscan por situación ("cuento para cuando llega un hermanito"), no por escenario. Con 7 aventuras y 16 enseñanzas hay 112 combinaciones sin escribir una plantilla por cada una.

## 045 · El creador pide iniciar sesión desde el primer paso

- **Fecha:** 2026-10-26 · **Fase:** 06
- **Decisión:** para crear un cuento hay que iniciar sesión (Google, Apple o enlace mágico) antes del primer paso. El enlace mágico devuelve a la página donde estaba el usuario.
- **Motivo:**
  - El consentimiento para subir fotos de un menor tiene que quedar asociado a un adulto identificado.
  - El borrador se retoma desde cualquier dispositivo y desde Mi cuenta.
  - La vista previa con IA (fase 07) tiene costo y necesita límites por usuario.
- **Alternativa para el futuro:** sesión anónima de Firebase vinculada después, si las métricas muestran que el login frena conversiones.

## 046 · Flujo de fotos: URL firmada, validación en el servidor y borrado inmediato de las rechazadas

- **Fecha:** 2026-10-26 · **Fase:** 06
- **Flujo:**
  1. Consentimiento (`POST /v1/consents`, con versión del texto, IP y navegador).
  2. `POST /v1/photos` verifica borrador propio editable, protagonista cargado, consentimiento propio y vigente, y máximo 3 fotos. Crea `photos/{id}` (`pending_upload`) y devuelve una URL firmada de 10 minutos.
  3. El navegador sube directo al bucket.
  4. `POST /v1/photos/:id/process` normaliza con Sharp: orientación EXIF, máximo 2048 px y JPEG **sin metadatos** (se descarta el GPS).
  5. Se analiza la foto: caras, brillo, nitidez y contenido inapropiado.
  6. Se evalúa con `evaluatePhoto`: una sola cara clara, cara de al menos 3 % de la imagen, lado mínimo de 512 px, luz y nitidez.
  7. Si sirve, se genera un retrato cuadrado de 1024 px centrado en la cara.
- **Privacidad:**
  - Las fotos **rechazadas se borran en el momento**.
  - El borrado a pedido elimina original, retrato y metadatos sin papelera (DECISIÓN 019).
  - Las vistas previas usan URLs firmadas de 15 minutos.
- **Motivos de rechazo** con mensajes concretos en los tres idiomas: sin cara, varias personas, cara chica, oscura, quemada, movida, baja resolución, formato no soportado, contenido inapropiado.

## 047 · Cloud Storage real y Cloud Vision opcional

- **Fecha:** 2026-10-26 · **Fase:** 06
- **Decisión:** en la nube, `STORAGE_PROVIDER=gcs` (URLs firmadas v4 con la propia cuenta de servicio). El análisis de fotos es configurable con `PHOTO_ANALYZER`:
  - `mock`: mide tamaño, luz y nitidez de verdad y supone una cara centrada.
  - `vision`: Cloud Vision detecta caras y contenido inapropiado.
- **Por ambiente:** staging arranca en `mock` (sin costo) y production en `vision`.
- **Costo de Vision:** las primeras 1.000 imágenes por mes son gratis por función; después, alrededor de USD 1,50 cada 1.000 por función (detección de caras + SafeSearch).

## 048 · Prueba de punta a punta del creador en Chrome real

- **Fecha:** 2026-10-26 · **Fase:** 06
- **Decisión:** antes de cerrar la fase se recorrió el creador completo con Chrome (puppeteer-core) contra los emuladores y la API local: enlace mágico, protagonista, consentimiento, subida y validación de foto, aventura, enseñanza, estilo, revisión, reanudación al recargar y lista de borradores, sin errores en la consola.
- **Errores encontrados y corregidos:**
  - A los componentes de cliente del creador les faltaban sus textos traducidos.
  - El enlace mágico se procesaba dos veces en desarrollo.
- **Pendiente:** la suite E2E permanente se arma con Playwright en la fase 17.

## 049 · Ilustraciones del catálogo generadas con Gemini en Vertex AI

- **Fecha:** 2026-10-26 · **Fase:** 06
- **Decisión:** las portadas de las 7 historias y las muestras de los 4 estilos se generaron con `gemini-3.1-flash-image` (Vertex AI, proyecto `storynido-staging`). Como referencia de estilo se usó la acuarela del hero, para que todo el sitio tenga la misma mano.
- **Archivos:** `apps/web/public/samples/<historia>.webp` (600×800) y `apps/web/public/styles/<estilo>.webp` (800×600), referenciados desde `coverImage` y `sampleImage` en el seed. Las muestras de estilo muestran la misma escena (un chico leyendo bajo un árbol con un zorro) para comparar solo el estilo.
- **Personajes:** son niños inventados, no fotos ni retratos de niños reales. Ninguna imagen tiene texto.
- **Costo:** 11 imágenes, sin regeneraciones. Unos USD 0,75 a precio de lista; peor caso estimado USD 1,51 (tope aprobado: USD 2).
- **Pendiente:** cuando estén el admin y el bucket de assets, estas imágenes pasan a `generated-assets` y se editan desde ahí.

## 050 · Estrategia comercial: diagnóstico antes de construir y analítica fuera del creador

- **Fecha:** 2026-10-26 · **Fase:** estrategia comercial, Fase 0
- **Decisión:** la estrategia comercial (`PROMPT-MAESTRO-PARA-CLAUDE.md`) se implementa sobre la arquitectura existente, después de un diagnóstico (`docs/STORYNIDO-GAP-ANALYSIS.md`) y en el orden propuesto ahí.
- **Arreglo P0:** GA4 y Meta Pixel no envían ningún hit en el creador, la cuenta ni el acceso, aunque haya consentimiento:
  - Las vistas de página se mandan a mano y solo en rutas públicas, con origen y ruta, sin parámetros.
  - En las rutas privadas se activa `ga-disable-<ID>`.
  - Meta no sigue el historial automáticamente (`fbq.disablePushState`).
  - La lista de rutas privadas sale de `routing.pathnames` (`apps/web/src/lib/tracking.ts`), así que cubre los 3 idiomas.
- **Pendiente de decisión del dueño:** mapeo de las 3 colecciones, entidad cobradora y procesador de pagos, imprenta y SKU, y primer mercado.

## 051 · Motor de IA: Gemini en Vertex AI, con modelos cambiables en vivo

- **Fecha:** 2026-10-26 · **Fase:** 07
- **Texto:** `gemini-3.5-flash` escribe, revisa y extrae la ficha del personaje, con salida JSON por esquema. `gemini-3.1-flash-lite` modera textos e imágenes (barato y suficiente para clasificar).
- **Imagen:** `gemini-3.1-flash-image` por defecto. Para comparar está disponible `gemini-3-pro-image`. Imagen 4/5 no está habilitado para el proyecto, así que no se evalúa.
- **Modelo definitivo:** se elige con el reporte de `pnpm eval:character`, que todavía no se corrió (cuesta dinero).
- **Cambios en vivo:** `aiConfig` define proveedor, modelos, límites y presupuesto; la API escucha el documento y los aplica sin redeploy.
  - Los admins lo ven con `GET /v1/admin/ai-config`.
  - Solo el superadmin lo cambia con `PATCH /v1/admin/ai-config`, que valida que el proveedor exista en el ambiente y registra el antes y el después en `auditLog`.
- **Staging:** arranca en `mock` (gratis). Para probar con IA real se activa Vertex desde `aiConfig` con un presupuesto diario bajo.
- **Capa gratuita de la API de Gemini (AI Studio): descartada.** Google puede usar esos datos para mejorar sus productos, y acá se envían fotos de chicos. Vertex no entrena con los datos del cliente.
- **Alternativas:** Claude para texto y Flux para imágenes tienen la interfaz y el ID en el registro; la implementación queda pendiente hasta que haga falta.

## 052 · Consistencia del personaje

- **Fecha:** 2026-10-26 · **Fase:** 07
- **Decisión:** cada ilustración recibe 3 cosas:
  - el retrato procesado de la foto;
  - la ficha del personaje: rasgos visibles en inglés, sin inferir identidad ni etnia;
  - la portada ya generada, como referencia para las páginas.
- **Ficha:** se calcula una vez por foto y se guarda en el documento de la foto. Se borra junto con ella.

## 053 · Vista previa gratis ("Muestra de la historia")

- **Fecha:** 2026-10-26 · **Fase:** 07 + estrategia comercial (Fase 1)
- **Contenido:**
  - El cuento completo se escribe y se revisa (el texto es barato y permite editarlo).
  - Se ilustran la portada y las 2 primeras páginas.
  - Cada imagen se guarda limpia (para el libro comprado) y con marca de agua (la única que ve el cliente, servida por URL firmada de 30 minutos).
- **Marca de agua:** mosaico "StoryNido ✦" rasterizado de antemano y embebido (`packages/providers/src/watermark-tile.ts`), porque la imagen de Cloud Run no trae fuentes.
- **Moderación:**
  - El mensaje propio del adulto se modera antes de usarse.
  - El texto generado y cada imagen se moderan; si no pasan, se regenera 1 vez y, si vuelve a fallar, se informa con un mensaje claro.
  - Los textos que edita el adulto también se moderan.
- **Límites (en `aiConfig`):**
  - `maxRegenerationsPerBook = 1`, como pide la estrategia. La regeneración se reserva antes de gastar y se devuelve si falla.
  - `maxPreviewsPerUserPerDay = 5`, y el triple por IP. La IP se guarda solo como hash con el día.
  - App Check obligatorio en producción para generar, editar y regenerar.
- **Generación síncrona:** la API responde al terminar (alrededor de 1 minuto con modelos reales) y el cliente sigue el estado en vivo por Firestore. Si una instancia se reinicia a mitad de camino, el libro queda en `preview_generating` y se puede reintentar a los 10 minutos. El libro completo (fase 08) va por el worker.
- **Honestidad:** la muestra explica qué cambia en el libro final (cantidad de páginas y marca de agua). No promete una revisión antes de imprimir, porque todavía no existe.

## 054 · Presupuesto diario de IA y registro de costos

- **Fecha:** 2026-10-26 · **Fase:** 07
- **Decisión:**
  - Cada llamada de IA se registra en `aiUsage` con su costo estimado: tokens informados por Vertex por precio de lista (`VERTEX_PRICES`). Un modelo desconocido se cobra con el peor caso.
  - El gasto se acumula en `aiBudget/{día UTC}` y en `books.aiCostUsdMicros`.
  - Antes de cada llamada cara se verifica el tope `dailyBudgetUsd`; al alcanzarlo se corta con un mensaje claro y el borrador no se toca.
  - Al pasar `budgetAlertPercent` se escribe un único log de error por día (`alert: ai_budget_threshold`) para la alerta de Monitoring.
- **Retención:**
  - Las ilustraciones de vista previa (`generated-assets/previews/`) se borran a los 30 días, sin papelera.
  - Los contadores de cuota (`previewQuota`) vencen con el TTL de Firestore.
  - Las dos reglas están en Terraform, pendientes de aplicar en staging.

## 055 · Modelo de imagen: gemini-3.1-flash-image (resultado de la evaluación)

- **Fecha:** 2026-10-26 · **Fase:** 07
- **Evaluación:** `pnpm eval:character` con un retrato fotográfico sintético de una nena inventada (generado con IA; no es una persona real). 2 modelos × 2 estilos (acuarela, cartoon 3D) × 3 escenas, con la portada como referencia. Costo: USD 1,43, más USD 0,07 del retrato.
- **Resultado:**
  - **Consistencia del personaje:** buena en los 2 modelos. Rulos, pecas, tono de piel y ropa se mantienen en todas las escenas.
  - **`gemini-3-pro-image`:** con la portada como referencia, repitió la portada en lugar de dibujar las escenas pedidas. Además cuesta el doble (~USD 0,14 por imagen).
  - **`gemini-3.1-flash-image`:** sigue las escenas (~USD 0,07 por imagen), pero copió elementos del fondo de la portada, como planetas en la playa.
- **Decisión:** `gemini-3.1-flash-image` como modelo por defecto. El prompt ahora aclara que las referencias son solo para el aspecto del personaje y del estilo, y que la escena es nueva (sin copiar composición, fondo ni objetos).
- **Verificación (USD 0,41):** mejora parcial. Con la portada completa como referencia, el modelo igual arrastró elementos de su fondo en algunas escenas, como el cohete en la escena del huevo. Ver 057.
- **Estimación del script:** ahora incluye los tokens de entrada (foto y portada de referencia), que la primera estimación no contaba.

## 056 · Crear sin cuenta: sesión anónima que se convierte en cuenta

- **Fecha:** 2026-10-26 · **Estrategia comercial:** Fase 1 ("sin login obligatorio antes de comprobar valor")
- **Decisión:** `/crear` abre una sesión anónima de Firebase y crea el borrador sin pedir cuenta. Las reglas de Firestore no cambian: el dueño es el `uid` anónimo.
- **Cuándo se pide cuenta:** en la muestra, la tarjeta "Guarda tu cuento" invita a crearla. "Mi cuenta" y el inicio de sesión tratan la sesión anónima como sin cuenta.
- **Al iniciar sesión:**
  - **Google y Apple:** se vincula la sesión (mismo `uid`). Si esa cuenta ya existía, se entra con ella y la API traspasa los datos.
  - **Enlace por mail:** se entra con el enlace y la API traspasa los datos. No se intenta vincular, porque si el mail ya tenía cuenta el intento fallido consume el código del enlace.
- **Traspaso (`POST /v1/me/merge-anonymous`):**
  - Exige el ID token de la sesión anónima: un token que no sea anónimo se rechaza, para que nadie pueda llevarse datos de otra cuenta.
  - Mueve `books`, `children`, `photos` y `consents`; los consentimientos guardan `transferredFromUid`.
  - Deja el registro en `auditLog` y borra el usuario anónimo.
- **Abuso:** las cuotas de vista previa por IP (3 veces la cuota por usuario) y App Check en producción frenan la creación masiva de sesiones anónimas.
- **Pendiente:**
  - Habilitar el proveedor anónimo en Firebase Auth de staging y producción. Sin él, `/crear` vuelve a pedir inicio de sesión.
  - La vinculación por Google y Apple no tiene E2E: el emulador no permite popups en modo headless.

## 057 · Lámina del personaje como referencia

- **Fecha:** 2026-10-26 · **Fase:** 07
- **Problema:** con la portada completa como referencia, el modelo copia partes de su fondo en las páginas, aun con instrucciones explícitas de no hacerlo (verificación de la decisión 055).
- **Decisión:** cada muestra genera primero una **lámina del personaje** (el chico solo, de cuerpo entero, sobre fondo crema liso y en el estilo elegido; `CHARACTER_REFERENCE_SCENE`). Esa lámina es la referencia de la portada, de las páginas y de las regeneraciones. Se guarda en `preview.characterImagePath`, solo para uso interno; el cliente no la ve.
- **Costo:** 1 imagen más por muestra, unos USD 0,07, para un total de ~USD 0,28 en imágenes por muestra con flash.
- **Evaluación:** `pnpm eval:character --reference sheet` (por defecto) reproduce el mismo método; `--reference cover` compara con el anterior.
- **Verificación (USD 0,55, 8 imágenes con flash):**
  - Ya no se copia el fondo entre escenas, en los 2 estilos.
  - La consistencia mejora: la lámina fija también la ropa.
  - 1 imagen de 8 tuvo texto colado (un cartel en el cohete).
- **Control de calidad:** la moderación de imágenes ahora también rechaza texto legible y caras o manos deformes. Si una imagen no pasa, se regenera sola 1 vez.
- **Gasto total de la evaluación:** ~USD 2,46 (retrato, 2 corridas de comparación y 1 de verificación).

## 058 · Modo sin foto y recuerdos guiados

- **Fecha:** 2026-10-27 · **Estrategia comercial:** Fase 1 (D1 "Recuerdos auténticos" y D6 "Privacidad y control")
- **Modo sin foto:**
  - En el paso del personaje se elige "Con su foto" o "Sin foto".
  - Sin foto se eligen piel (6 tonos), color de pelo (5), largo (4), tipo (4), color de ojos (5) y anteojos. Cada opción lleva el nombre escrito, además de la muestra de color.
  - La ficha del personaje se arma con esos rasgos (`avatarToSheet`): no se sube ninguna foto ni se llama a la IA para describirla.
  - La lámina del personaje y la muestra funcionan igual que con foto.
  - Si cambian los rasgos, la muestra queda desactualizada (`avatarKey`).
- **Recuerdos guiados:** paso nuevo después de la aventura, con 4 preguntas opcionales:
  - un momento especial;
  - quién lo acompaña;
  - cómo le dicen en casa;
  - lo que más disfruta.
- **Reglas de los recuerdos:**
  - 150 caracteres como máximo, validados en las reglas de Firestore.
  - Aviso de no incluir apellidos, direcciones ni escuela.
  - Se moderan antes de generar.
  - En el prompt van en un bloque fijo que pide integrarlos con naturalidad, omitir los que no encajen y no agregar datos personales. Así funcionan con cualquier plantilla.
- **Dónde se guardan:** en el libro (`characterMode`, `avatar`, `memories`), no en el perfil del chico: son de cada cuento y no exigen cambiar las reglas de `children`. Los borradores anteriores, que no tienen estos campos, se tratan como "con foto" y "sin recuerdos".
- **Pasos del creador:** quedan 7 (protagonista, personaje, aventura, recuerdos, enseñanza, estilo, revisión). La estrategia sugiere 5; se compactan cuando se definan las 3 colecciones.

## 059 · Tres líneas comerciales sobre la misma app

- **Fecha:** 2026-10-27 · **Fuente:** `docs/estrategia/LINEAS-COMERCIALES.md`
- **Decisión:** Familias, Eventos y Profesionales comparten la app, los servicios y la marca. Se implementan extendiendo lo existente, en fases nuevas (07b, 07c, 12b y 12c) y en ajustes a las fases 08–17.
- **Landings y acceso por público (07c):**
  - **Familias:** la home actual (`/`), sin cuenta.
  - **Eventos:** `/eventos`, sin cuenta; el creador entra en modo evento.
  - **Profesionales:** `/profesionales`, con cuenta desde el inicio, porque las compras se acumulan para el descuento.
  - La home suma un selector "¿Para quién es?" y el encabezado muestra las 3 líneas.
- **Relación con la estrategia anterior:**
  - Las colecciones propuestas (Aventuras, Nuestros recuerdos, Grandes momentos) pasan a ser las colecciones de Familias.
  - Eventos con copias idénticas reemplaza al punto "producción multilibro" que la estrategia anterior dejaba fuera.
  - La entidad cobradora, la imprenta y el primer mercado siguen pendientes de decisión.
- **Cuenta Pro:** es un atributo (`accountType`), no un rol, para no tocar los custom claims ni los permisos del admin.
- **Valores por defecto para lo anterior:** canal `families`, extensión clásica (o el `pageCount` de la historia), densidad equilibrada y nivel "en desarrollo".

## 060 · Web de staging en Firebase App Hosting (desde el código local)

- **Fecha:** 2026-10-27
- **Backend:** `web` en `storynido-staging` (us-central1), asociado a la web app de Firebase y con entorno `staging`, que aplica `apps/web/apphosting.staging.yaml` (sin indexación y apuntando a la API de staging). URL: https://web--storynido-staging.us-central1.hosted.app.
- **Despliegue:** `firebase deploy --only apphosting --project storynido-staging`, sin conectar GitHub.
  - El CLI sube el repo entero (respetando `.gitignore`: los `.env*` locales no se suben) y `firebase.json → apphosting.rootDir = apps/web` indica la app.
  - App Hosting construye con pnpm y Turborepo.
  - Conectar GitHub para desplegar en cada push queda como mejora: requiere instalar la app de Firebase en el repo.
- **Datos:** `pnpm --filter @storynido/firebase seed:cloud --project storynido-staging` carga solo el catálogo y la configuración, sin usuarios, y solo crea lo que falta.
  - Exige un proyecto `storynido-*`.
  - Usa las credenciales locales con `GOOGLE_CLOUD_QUOTA_PROJECT=storynido-staging`, para no consumir cuota de otro proyecto.
  - En staging deja la IA en Vertex con tope de USD 2 por día, 3 muestras por usuario por día y 1 regeneración.
- **Auth:** dominios autorizados: `web--storynido-staging.us-central1.hosted.app` y `staging.storynido.com`.
- **CORS:** la API no tenía `CORS_ORIGINS` en la nube, así que rechazaba al navegador. Se agrega desde `var.cors_origins` (los mismos orígenes que los buckets). Pendiente de `terraform apply`.
- **Dominio `staging.storynido.com`:** pendiente. Requiere registrarlo en App Hosting y cargar registros DNS en el registrador (autorización del dueño).

## 061 · Opciones editoriales: extensión, cantidad de texto, nivel de lectura y tipo de contenido

- **Fecha:** 2026-10-27 · **Fase:** 07b (Fase A de las líneas comerciales)
- **Modelo:** `packages/shared/src/models/editorial.ts`. Configuración en `editorialConfig/global`, editable desde el admin en la fase 14, con valores de fábrica si falta:

| Extensión     | Páginas interiores | Narrativas | Formatos                                              |
| ------------- | ------------------ | ---------- | ----------------------------------------------------- |
| Mini          | 12                 | 10         | Solo digital, hasta validar con la imprenta (fase 12) |
| Corto         | 16                 | 14         | Solo digital, hasta validar con la imprenta           |
| Clásico       | 24                 | 22         | Digital, tapa blanda, tapa dura                       |
| Gran aventura | 32                 | 30         | Digital, tapa blanda, tapa dura                       |

Las 2 páginas fijas son la dedicatoria y el cierre. En el formato mixto, ~25 % de las páginas son de actividades.

- **Densidad de texto** (palabras por página narrativa): muy visual 5–20, equilibrado 25–60 (por defecto) y más lectura 70–120.
- **Nivel de lectura:** inicial, en desarrollo y avanzado, cada uno con indicaciones para la IA.
- **Independencia:** extensión, densidad y nivel no dependen entre sí. Un mismo cuento de 24 páginas se genera con 5–20 o con 70–120 palabras por página (probado).
- **Una sola fuente de páginas:**
  - Se extiende el `pageCount` existente: si el libro tiene extensión, manda la configuración editorial.
  - Los libros anteriores (`length: null`) conservan el `pageCount` de su historia.
  - Los demás campos tienen valores por defecto (equilibrado, en desarrollo, cuento).
- **Generación:**
  - `buildStoryPrompt` agrega el rango de palabras y la guía del nivel, por encima de lo que diga la plantilla.
  - Si alguna página queda fuera del rango (con margen: −40 % / +30 %), se reescribe 1 vez.
  - La muestra queda desactualizada si cambian las opciones (`preview.editorialKey`).
- **Creador:** no hay pasos nuevos. "Tu libro" está en el paso de la aventura:
  - tipo de contenido y extensión, como tarjetas que indican "Solo digital" o "Digital o impreso";
  - densidad y nivel en "Ajustar la lectura" (plegado), sugeridos según la edad la primera vez (`suggestedReading`).
  - Si la historia no admite una opción, se ajusta sola.
- **Colorear:** estilo `para-colorear` (contornos limpios, sin sombras, generado así y no convertido desde una acuarela). Es el único que se ofrece para libros para colorear.
- **Actividades:** 5 plantillas aprobadas en `activityTemplates` (laberinto, unir, diferencias, completar la frase y dibujar el final), con sus niveles. Se generan y maquetan en las fases 09 y 10; hoy la muestra de un libro de actividades muestra la historia que les da contexto.
- **Página de historia:** muestra el rango de páginas según las extensiones que admite (por ejemplo, "De 12 a 32 páginas") en lugar de un número fijo.
- **Pendiente:**
  - Un error intermitente de React (#441, `useEffectEvent` llamado durante el render) apareció 1 vez en 7 corridas del E2E y no se pudo reproducir.
  - Las historias que ya existen en staging no se actualizan con el seed (solo crea lo que falta), así que allá ofrecen los tipos por defecto: cuento y cuento con actividades.

## 062 · Tres líneas comerciales: landings, acceso por público y colecciones

- **Fecha:** 2026-10-27 · **Fase:** 07c (Fase B de las líneas comerciales)
- **Rutas** (traducidas, misma app y misma marca):
  - **Familias:** la home (`/es`); `/familias` redirige a ella con 308, para tener una sola URL en buscadores.
  - **Eventos:** `/es/eventos` · `/en/events` · `/pt/eventos`.
  - **Profesionales:** `/es/profesionales` · `/en/professionals` · `/pt/profissionais`.
- **Acceso por público:**
  - **Familias y Eventos** crean sin cuenta (sesión anónima, DECISIONS 056).
  - **Profesionales** pide cuenta antes de crear: `/crear?line=professionals` muestra "Crea tu cuenta profesional" y no abre una sesión anónima.
  - La línea llega por `?line=` o queda recordada en `sessionStorage`, sin cookies ni datos personales.
- **Navegación:**
  - El encabezado muestra Familias, Eventos, Profesionales, Historias y Blog ("Cómo funciona" y "Preguntas" siguen como secciones de la home).
  - El pie tiene las 3 líneas.
  - La home suma "¿Para quién es?" después del hero.
- **Landings:**
  - Hero con ilustración propia en acuarela (`public/brand/landing-*.webp`, generadas con Gemini por USD 0,14), cómo funciona, kit o beneficios, colecciones, preguntas frecuentes y llamado final.
  - Sin cifras ni testimonios inventados. Lo que todavía no existe se dice: las piezas del kit y la compra por cantidad llegan "muy pronto", y los descuentos Pro "se activan con los pagos".
  - Profesionales aclara que no es un sistema clínico.
- **Modelo:**
  - `books.channel` (`families` / `events` / `professionals`) se fija al crear y las reglas no permiten cambiarlo. Lo anterior es `families`.
  - Las historias tienen `channels[]`, `collectionIds[]` y `personalization`: una historia puede estar en varias líneas sin duplicarse.
  - Colección nueva `collections`, editable desde el admin en la fase 14. Tiene 8 colecciones: Familias (Aventuras, Nuestros recuerdos, Grandes momentos), Eventos (Cumpleaños) y Profesionales (las 4 de la estrategia, con sus temas).
- **Creador según la línea:**
  - Eventos arranca como Mini con texto muy visual y no tiene paso de enseñanzas. Los pasos ocultos se saltean sin cambiar los índices guardados.
  - El paso de la aventura muestra solo las historias de la línea.
- **Catálogo:** `/historias` es la tienda de Familias y filtra por colección cuando hay más de una con historias.
- **Analítica:** el page view lleva `content_group` con la línea, sin datos personales.
- **Historias nuevas:** 7, una por colección nueva, en los 3 idiomas. Están **inactivas** hasta generar su portada, porque requieren aprobación de costo (~USD 0,50).
- **Calidad:** E2E en 1440 px y 390 px con las 3 líneas, el acceso de cada público y las rutas anteriores. Lighthouse móvil: rendimiento 92–93, accesibilidad 100, buenas prácticas 100. El SEO local baja a 69 solo porque `robots.txt` bloquea la indexación fuera de producción.

## 063 · Feedback de compradores: misma arquitectura, más control del libro entero

- **Fecha:** 2026-10-27 · **Fuente:** paquete "Voz del cliente" (reseñas públicas, muestra cualitativa; ver `docs/CUSTOMER-FEEDBACK-GAP-ANALYSIS.md`).
- **Decisión:** no cambia la arquitectura. Se agregan controles en las fases existentes:
  - **07d (nueva, antes del pipeline):** el adulto ve y aprueba la lámina del personaje y corrige o fija rasgos esenciales; nombre exacto verificado; moderación ampliada (burlas, diagnósticos, promesas terapéuticas); formulario en curso protegido.
  - **09:** planificador → redactor → localización por país → revisión de seguridad → revisión multimodal por página, con reparaciones localizadas.
  - **10–12:** versión aprobada congelada con hash; nada se imprime ni se entrega si no coincide. Lector web y PDF para lo digital. Impresión solo con muestra física aprobada por SKU y país.
- **Español regional:** la interfaz sigue en español neutro, pero el cuento se escribe en la variante del país (es-MX, es-AR con voseo, es-ES).
- **Límite:** no se usan métricas automáticas de parecido facial como garantía; el control es la aprobación del adulto.

## 064 · Muestra en 2 etapas: el adulto aprueba al personaje antes de ilustrar

- **Fecha:** 2026-10-27 · **Fase:** 07d · **Origen:** feedback de compradores (DECISIONS 063) y control de costos.
- **Etapa 1 (≈ USD 0,08):**
  - Cuento completo (con extensión y densidad de 07b) y la lámina del personaje: 1 sola imagen.
  - El adulto ve la lámina con sus rasgos y responde "¿Es él / es ella?": "Sí, es así" o "Corregir rasgos".
- **Corregir rasgos (≈ USD 0,07):**
  - Pelo, piel, ojos, anteojos y un rasgo distintivo (moderado).
  - El adulto marca qué rasgos deben quedar idénticos (`mustKeep`; por defecto pelo, piel y anteojos si los usa). Entran en cada prompt como "MUST KEEP IDENTICAL".
  - Vuelve a dibujar la lámina y usa la regeneración gratis.
- **Etapa 2 (≈ USD 0,20):**
  - Portada + 2 páginas, con la lámina aprobada como referencia.
  - **Pide cuenta** (`aiConfig.illustrationsRequireAccount`, por defecto activado; error `account_required`). Es la parte cara y así se limita el uso anónimo sin pedir datos antes de mostrar valor.
- **Rasgos confirmados:**
  - Se guardan en el libro (`characterTraits`, `mustKeep`) junto con `characterBase`, la foto o los rasgos sobre los que se confirmaron.
  - Si el adulto cambia la foto o los rasgos, dejan de valer y la muestra figura desactualizada.
  - No se puede aprobar una muestra desactualizada.
- **Nombre exacto:**
  - Chequeo determinístico (`nameIssues`): falta, tildes, una letra cambiada.
  - Si falla, se reescribe 1 vez. Si sigue mal, error y no se muestra.
- **Moderación ampliada:**
  - Rechaza burlas sobre el cuerpo o las necesidades, castigos que avergüencen, diagnósticos y promesas de curación.
  - En imágenes, también texto dentro de la ilustración y deformidades.
- **QA:** `books/{id}/qaEvents` con códigos (`name_mismatch`, `length_out_of_range`, `moderation_*`, `character_approved`, `character_corrected`), sin datos del niño. Solo lo leen los admins.
- **Visor del libro:**
  - Carrusel con todas las páginas (portada, dedicatoria, cuento, fin), flechas, teclado, deslizamiento y miniaturas.
  - Las páginas sin ilustrar muestran su texto real y "Se ilustra cuando confirmes tu libro".
  - Editar el texto y probar otra ilustración actúan sobre la página visible.
- **Ejemplo sin costo:**
  - La ficha de cada historia tiene "Hojear un ejemplo" (portada, dedicatoria, fragmento) con el mismo visor.
  - Los libros de ejemplo completos (~USD 7) se generan cuando el producto esté terminado.
- **Formulario en curso:** lo escrito en "Protagonista" y "Recuerdos" se guarda en el navegador (`localStorage`, 7 días) y se borra al guardar el paso.

## 065 · Pipeline del pedido: worker idempotente, Workflows y Cloud Tasks

- **Fecha:** 2026-10-27 · **Fase:** 08.
- **Estados del pedido:** las transiciones válidas están en `ORDER_TRANSITIONS` (`packages/shared`). Todo cambio de estado pasa por `assertOrderTransition`.
  - `qa_failed` es la revisión manual: desde ahí se vuelve a generar o se reembolsa.
  - Desde `ready` el admin también puede regenerar antes de enviar.
- **Flujo en la nube:**
  1. La API publica el evento (`order.paid`, `order.retry_step` u `order.regenerate`) en Pub/Sub, tema `order-events`.
  2. Una suscripción push con OIDC lo entrega al worker, que deduplica por `requestId`, cambia el pedido a `generating` y arranca Cloud Workflows.
  3. El workflow llama al worker paso por paso, con reintentos exponenciales.
  4. Las ilustraciones se reparten en Cloud Tasks (una tarea por página, con el ritmo de la cola).
- **En local**, el mismo algoritmo corre dentro del worker (`LocalOrchestrator`, `InlineDispatcher`). La API le manda los eventos por HTTP.
- **Una sola fuente de políticas:** intentos y timeouts por paso están en `STEP_POLICIES`. El worker se los pasa al workflow como argumento.
- **Idempotencia:**
  - **Eventos:** duplicados ignorados (`orders/{id}/events/{requestId}`).
  - **Pasos:** un paso terminado en la generación actual no se repite. Un paso en curso tiene dueño hasta que vence su lease.
  - **Clave idempotente** por paso (`orderId:gN:paso`), la misma en todos los reintentos. Los proveedores (imprenta, pagos) la usan para no duplicar.
  - **Páginas:** cada página es una tarea propia; reintentar las ilustraciones rehace solo las que fallaron.
  - **Ejecuciones viejas:** cerrar o fallar una ejecución vieja no toca el pedido.
- **Regenerar** sube la generación: cambian las claves y se rehace todo. **Reintentar** desde un paso rehace ese paso y los siguientes; si es antes de las ilustraciones, también todas las páginas.
- **Registro:** `orders/{id}/steps/{paso}` guarda estado, intentos, duración, error, costo (millonésimas de dólar) y un resultado sin datos del niño. El costo se suma al pedido (`costsUsdMicros`).
- **Fallas:** al agotar los reintentos, el pedido pasa a `qa_failed`, se crea `adminAlerts/{id}` y queda un log de severidad ERROR para la alerta de la fase 16.
- **Pedido:** suma `channel` (Familias por defecto) e `items[]` (pieza, formato, cantidad). Eventos imprime N copias de un solo diseño.
- **Pasos simulados:** en esta fase los pasos son simulados (`simulatedHandlers`), sin IA ni costo. La fase 09 conecta la historia, las ilustraciones y el QA reales; la 10 el PDF; la 12 la entrega.
- **Disparo de prueba:** `POST /v1/dev/books/:bookId/paid-order`, solo fuera de producción, hasta tener pagos (fase 11).
- **Seguridad:** el worker no es público. Cloud Run solo acepta OIDC de `sn-invoker` (Pub/Sub, Cloud Tasks) y `sn-workflows`. Las colecciones nuevas solo las escribe el servidor y solo las leen los admins.

## 066 · Generación del libro: se congela lo aprobado y se repara por página

- **Fecha:** 2026-10-27 · **Fase:** 09 · **Guía:** `docs/estrategia/feedback/PROMPTS-LLM-Y-QA.md` (secciones A a G) y `qa-reglas.json`.
- **El texto se escribe en la vista previa, no después del pago.**
  - La etapa 1 corre planificador (A) → redactor (B) → revisión editorial (E) → moderación (F), con los chequeos de nombre exacto y densidad.
  - El adulto lee, edita y aprueba ese texto. El pipeline nunca lo reescribe ("no_unapproved_content_mutation").
  - Si algo del texto aprobado no pasa (nombre, seguridad), el pedido va a revisión humana.
- **Planificador:** devuelve arco y escenas por página (qué se ve, qué no, hechos de continuidad, presupuesto de palabras, detalle personal). Se guarda en la vista previa y lo usan las ilustraciones y la revisión.
- **Libro congelado (G1 + G6):** el primer paso exige el personaje aprobado y copia al pedido lo aprobado:
  - texto, plan, lámina e imágenes de la muestra (salen de `previews/`, que se borra a los 30 días);
  - descripción del personaje y rasgos esenciales.
  - Un hash identifica la versión. Regenerar el libro no cambia lo congelado.
- **Ilustraciones:**
  - Portada y las 2 páginas ya aprobadas se reutilizan.
  - El resto se pinta con la lámina como referencia, la escena del plan ("debe verse", "no mostrar") y "sin texto en la imagen".
  - Cada imagen se modera (2 intentos por tarea, y la tarea se reintenta).
  - Regenerar vuelve a pintar todas.
- **Revisión por página (D):** cada imagen se compara con el texto, el plan y la lámina.
  - `pass` sigue. `needs_reference` se acepta y queda registrado.
  - `repair` vuelve a pintar solo esa página, con los problemas como corrección: hasta 2 veces por página, 30 % de las páginas por libro (mínimo 3) y USD 1,50 por libro.
  - `human_review`, un problema del texto o las reparaciones agotadas bloquean el libro: revisión manual sin reintentos (`HumanReviewError`).
- **Registro:** `books/{id}/qaEvents` con `page_repair`, `page_human_review`, `page_needs_reference`, `page_missing`, `moderation_image`, `name_mismatch` y `length_out_of_range`. Cada uno lleva pedido, página, intentos, costo de la reparación y estado final, sin datos del niño. Cada llamada de IA queda en `aiUsage` con el pedido.
- **Sin biometría:** no se usan embeddings ni métricas de parecido facial (lo pide `qa-reglas.json`). La consistencia la controlan la lámina aprobada por el adulto y la revisión de rasgos esenciales.
- **Actividades:** se generan con plantillas aprobadas por nivel y se moderan. Quedan en `orders/{id}/content/activities`; se dibujan en la maquetación (fase 10).
- **Pendiente:** maquetación (10) y entrega (12) siguen simuladas. Variante regional del idioma (es-MX, es-AR…) cuando el libro guarde el país.

## 067 · Landing: navegación por público, idioma automático y pie profesional

- **Fecha:** 2026-10-27 · **Pedido de Sebastián.**
- **Encabezado:** 3 menús, uno por público (Familias, Cumpleaños y eventos, Profesionales), cada uno con su color.
  - Cada panel tiene qué es, sus enlaces y colecciones, y el llamado propio.
  - En el celular, los mismos 3 bloques.
- **Idioma:**
  - Se detecta solo: idioma del navegador al entrar, y la cookie `sn_locale` lo recuerda.
  - El país se detecta por IP solo si la infraestructura manda el header (`X-Client-Country`, con balanceador o CDN). Hoy App Hosting no lo manda, así que se usa el idioma del navegador.
  - Cambiarlo: en el pie (idioma y país) o en "Mi cuenta → Preferencias" (queda en el perfil).
- **Pie:**
  - Redes por variables `NEXT_PUBLIC_SOCIAL_INSTAGRAM`, `_TIKTOK` y `_YOUTUBE`; una red sin URL no se muestra.
  - Íconos dibujados en línea, sin logos de terceros en el bundle.
- **Estilo 2.1:** ver `docs/BRAND.md` (pesos más livianos, menos cajas, color por público).

## 068 · Lo que enseñó la primera prueba real del libro completo (staging)

- **Fecha:** 2026-10-27 · Libro Mini de prueba (10 páginas), Vertex real. Costo total: USD 2,44 (vista previa, pedido y 2 reintentos del QA).
- **Bugs encontrados y corregidos:**
  1. **API con timeout de 60 s:** la vista previa real tarda ~110 s; pasó a 300 s.
  2. **Carrera al leer `aiConfig`:** páginas en paralelo usaban el proveedor por defecto (simulado). Ahora esperan la misma lectura. Fuera de local y tests, el worker rechaza la IA simulada, y la API espera `aiConfig` antes de escuchar.
  3. **Una revisión colgada tumbaba el QA de todo el libro.** Ahora 1 reintento y, si sigue, solo esa página va a una persona.
  4. **Una reparación rechazada por la moderación también lo tumbaba.** Ahora es un intento fallido de esa página.
  5. **La corrección copiaba la crítica del revisor al prompt** ("glifos", "placeholder") y el modelo dibujaba texto. Ahora solo dice qué tiene que verse (rasgos esperados y la escena).
- **Lo que funcionó:**
  - Libro congelado, ilustraciones en 44 s y reparaciones localizadas de las páginas 1 y 2.
  - El QA detectó la página placeholder y la derivó a una persona con el motivo.
- **Pendiente (fase 15):** que reintentar el QA reutilice las páginas ya aprobadas en vez de volver a reparar; hoy cada reintento repite reparaciones y gasta de más.

## 069 · Formato del libro y resolución de impresión

- **Fecha:** 2026-10-27 · **Decisión de Sebastián.**
- **Tamaño:** 21×28 cm vertical, igual a la proporción 3:4 de las ilustraciones (no se recorta nada). El digital usa la misma proporción.
- **Resolución:** los pedidos impresos generan las ilustraciones en 2K (~220 dpi a 21×28, suficiente para acuarela), con un costo de ≈ +USD 0,03 por imagen. El digital sigue en 1K.

## 070 · Maquetación del libro (fase 10)

- **Fecha:** 2026-10-27.
- **Motor:** plantillas HTML/CSS → Chromium (Playwright) → PDF.
  - Las tipografías de la marca (Fraunces y Nunito Sans, subconjunto latino) van embebidas en el HTML: nunca se depende de las del sistema.
  - Chromium está en la imagen del worker (`CHROME_PATH`).
- **Formato:** 21×28 cm vertical. Digital RGB, imágenes JPEG a 1600 px.
  - Imprenta: 3 mm de sangrado, TrimBox, BleedBox y ArtBox marcados, imágenes JPEG 92 a resolución completa.
  - Tripa y tapas por separado (contratapa + lomo + portada). El lomo es aproximado hasta tener el cálculo de Gelato.
- **Texto:** siempre en capa tipográfica, en un panel crema sobre la ilustración (contraste ≥ 4,5:1 aun sobre negro).
  - El alto máximo del panel y la letra salen de la densidad (visual 24 %, equilibrado 34 %, más lectura 46 %); el nivel de lectura escala la letra.
  - Un script achica la letra hasta el mínimo. Si igual no entra, la página se marca y la maquetación se bloquea: el texto aprobado no se recorta ni se cambia.
- **Ilustraciones:** a página completa sin recortes (la página es 3:4 como la imagen; solo se pierde el sangrado). Nada de texto dentro de la imagen.
- **Actividades:**
  - Laberinto (SVG determinístico por nivel), unir, completar con banco de palabras, y dibujar el final.
  - "Encontrar diferencias" se maqueta por ahora como dibujar (necesita dos versiones de una escena).
  - Todo imprimible en blanco y negro.
- **Validaciones bloqueantes (G5 + preflight G):**
  - cantidad de páginas;
  - tamaño con sangrado y área de corte;
  - tipografías embebidas;
  - texto sin desborde;
  - resolución efectiva (digital ≥ 72 dpi, imprenta ≥ 200 dpi);
  - reglas de páginas de la imprenta (si no cumple: solo digital);
  - hash del libro congelado igual al aprobado.
- **Guardado:** `pdfs/orders/{id}/g{n}/{formato}-{book|interior|cover}.pdf`, con acceso solo por URL firmada (fase 12).
- **Color:** se entrega en RGB. Gelato acepta RGB y convierte a CMYK en su flujo; si un SKU exige CMYK, se convierte en el worker (pendiente de confirmar en la fase 12).
- **Pendientes:**
  - piezas de Eventos (invitación, tarjetas, stickers), en la fase 12b;
  - lector web de la entrega digital, en la fase 12;
  - especificaciones exactas por SKU (sangrado, páginas, lomo), en la fase 12 con Gelato.
- **Resolución de lo aprobado en la vista previa:** resuelto en DECISIONS 071 (etapa 2 en 2K).

## 071 · Etapa 2 de la vista previa en 2K

- **Fecha:** 2026-10-27 · **Decisión de Sebastián.**
- La portada y las 2 páginas que el adulto aprueba en la vista previa (y su regeneración) se generan en 2K.
  - Lo aprobado se usa tal cual en el libro, también impreso: no se puede volver a dibujar en más resolución sin cambiar lo que vio el adulto.
  - La versión con marca de agua que ve el cliente sigue reducida a 1024 px.
- **Costo:** ≈ +USD 0,10 por vista previa que llega a la etapa 2, que ya pide cuenta.
- La lámina del personaje sigue en 1K: es referencia, no se imprime.
- Las vistas previas anteriores a este cambio siguen en 1K. Un pedido impreso con ellas se frena por resolución y pide revisión humana.

## 072 · Checkout y pagos (fase 11) sobre la interfaz, con el procesador por definir

- **Fecha:** 2026-10-27 · **Decisión de Sebastián:** construir la fase con el proveedor simulado y conectar el procesador real cuando se elija la entidad cobradora. Stripe no abre cuentas en Uruguay ni en Argentina; las opciones están en la conversación del 2026-10-27: Stripe con una empresa en EE. UU., Mercado Pago, dLocal o PayPal.
- **Precio siempre en el servidor (`quote`):**
  - precio del país y formato, más un ajuste por extensión (`prices.lengthAdjustmentsMinor`), por la cantidad;
  - un solo descuento, el mayor entre cupón y promoción vigente;
  - envío del país si es impreso;
  - impuesto incluido (se informa la parte) o sumado.
  - Un cupón que no sirve no frena la compra: se informa y se cobra sin él.
  - El pedido guarda el **snapshot** completo (cada componente, el descuento y su motivo). El cliente nunca manda montos, y al proveedor se le pasa un único ítem con el total.
- **Checkout (`POST /v1/checkout`):**
  - exige cuenta (no anónima), la muestra completa con el personaje aprobado y vigente, y una dirección válida para el país si es impreso (México: CP de 5 dígitos, estado y teléfono; EE. UU.: ZIP y estado de 2 letras);
  - crea el pedido en `pending_payment` con el precio y la **huella de lo aprobado**.
  - Al fabricar, el worker compara la huella. Si la muestra cambió después de pagar, revisión humana: "lo que aprobás es lo que recibís".
- **Webhook (`POST /v1/webhooks/payments/:proveedor`):**
  - cuerpo crudo, firma verificada (400 si es inválida), idempotente por ID de evento (`paymentEvents`);
  - pagado: el monto y la moneda tienen que coincidir con lo congelado. Si coinciden, `paid`, libro `ordered`, se usa el cupón y se publica `order.paid`. Si no, aviso al admin sin fabricar;
  - vencido: `cancelled`. Reembolso: `refunded`. Contracargo: aviso al admin.
- **Reembolso:** `POST /v1/admin/orders/:id/refund`, total, con clave idempotente y auditoría.
- **Conversiones del servidor (GA4 Measurement Protocol y Meta API de Conversiones):**
  - solo si el comprador aceptó la analítica y hay claves;
  - sin datos personales: pedido, valor y moneda.
  - Meta pide algún identificador del usuario para atribuir; se suma con su consentimiento cuando se active la campaña.
- **Web:**
  - `/pagar/[libro]`: formato con precio, dirección, regalo, cupón y resumen calculado por la API;
  - `/pedido/[pedido]`: estado en vivo;
  - fuera de producción, con el proveedor simulado, "Simular el pago" pasa por el mismo webhook firmado.
- **Libro con el texto editado por el adulto:** si sacó el apodo, no se frena (se registra). Un nombre mal escrito sí va a revisión.
- **Pendiente con el procesador elegido:**
  - su `PaymentProvider` (checkout, firma del webhook, reembolso);
  - Apple Pay y Google Pay;
  - multimoneda real y el procedimiento de pruebas con su CLI.

## 073 · Libro más vendible: tapa con el nombre, texto que se mueve y contratapa completa

- **Fecha:** 2026-10-27 · **Feedback de Sebastián sobre el PDF.**
- **Tapa:** el título lleva el nombre del protagonista; el redactor ahora lo incluye ("La aventura espacial de Martina"). Si un libro anterior no lo tiene, la tapa muestra el nombre grande en lavanda debajo del título.
- **Texto interior:**
  - Ya no va siempre abajo. Cada página mide el detalle visual (bordes y contraste) de 6 regiones de su ilustración y pone el texto en la más calma: banda arriba o abajo, o esquina para textos cortos.
  - Penaliza repetir la ubicación de la página anterior.
  - Las ilustraciones nuevas dejan un tercio calmo, alternando arriba y abajo, y sin caras ahí.
- **Contratapa:** título, sinopsis (la descripción de la historia), "Un cuento para {nombre}", QR a la web y la marca. En imprenta queda una zona blanca de 50×30 mm abajo a la derecha para el código de barras; el tamaño exacto se confirma con Gelato.

## 074 · Imprenta y "Mi cuenta" (fase 12) con la imprenta simulada, Gelato después

- **Fecha:** 2026-10-27 · Gelato real cuando esté la clave (Sebastián ya la tiene; falta cargarla).
- **Matriz de impresión (`printOptions/{país}_{formato}`):**
  - Solo se ofrece impreso si el formato está habilitado para el país y el libro entra en páginas y cantidad (`printAvailability`).
  - Si no, la oferta lo marca `printUnavailable` y el checkout responde `print_unavailable`: nunca se manda algo incompatible a la imprenta.
- **Entrega impresa (paso `deliver`):**
  - verifica el sha256 del PDF aprobado;
  - crea el pedido en la imprenta una sola vez (clave idempotente);
  - queda en `sent_to_print`. El digital queda en `ready` con URLs firmadas.
- **Webhooks de la imprenta (`POST /v1/webhooks/print/:proveedor`):**
  - firmados e idempotentes (`printEvents`);
  - estados: `in_production` → `shipped` (con seguimiento) → `delivered`;
  - una falla vuelve a `qa_failed` con aviso al admin (se reimprime con el mismo libro).
- **Cancelación** (admin) solo si la imprenta lo permite, con auditoría.
- **Descarga del digital:** URL firmada de 15 minutos generada al pedirla, solo para quien compró.
- **Recompra con un clic, sin IA:**
  - `?reorder=<pedido>` en el checkout cotiza y crea un pedido nuevo con la copia del libro congelado (`sourceOrderId`);
  - el worker reutiliza las ilustraciones y el PDF: la recompra digital queda lista en segundos;
  - un libro creado en digital (1K) no se puede pasar a impreso sin crearlo de nuevo en alta resolución.
- **Borrado de datos a pedido:**
  - perfil de un chico: fotos, borradores y su perfil;
  - cuenta entera: además, el usuario de Firebase Auth;
  - los pedidos pagados se conservan (facturación), con auditoría y un email de confirmación.
- **"Mi cuenta":**
  - pedidos en vivo (listener de Firestore) con una línea de tiempo amable (digital: 4 pasos; impreso: 7);
  - ver el pedido, descargar el PDF, seguir el envío y "Pedir de nuevo";
  - perfiles con "Borrar datos";
  - "Borrar mi cuenta" con confirmación explícita.
- **Imprenta simulada:** fuera de producción, "Avanzar la imprenta" en el pedido manda el siguiente webhook firmado.
- **Color `destructive`:** se agregó el token (antes `text-destructive` no tenía color) y la variante de botón.
- **Pendiente con Gelato:** su `PrintProvider` (productos y SKU por formato, cotización, pedido, webhooks) en sandbox, y sus especificaciones de sangrado, lomo y código de barras.

## 075 · Varias imprentas: se cotiza con todas y gana la más barata

- **Fecha:** 2026-10-27 · **Pedido de Sebastián:** "se consultan varios precios, el mejor gana; si hay uno solo va ahí; si no hay ninguno con envío al país, solo digital". Criterio confirmado: **precio**.
- **Matriz:** `printOptions/{país}_{formato}_{imprenta}`. Las imprentas activas en cada ambiente se configuran con `PRINT_PROVIDERS` (lista separada por comas; `PRINT_PROVIDER` sigue valiendo).
- **Oferta:** el impreso se ofrece si al menos una imprenta activa lo tiene habilitado con la muestra física aprobada.
- **Al pagar (con la dirección):**
  - se cotiza en paralelo con todas las que pueden con el pedido entero (formato, páginas y cantidad), con 8 s de tope cada una;
  - gana el **menor costo total en USD (impresión + envío)**; si empatan, la que llega antes;
  - si ninguna responde o puede, `print_unavailable` y queda el digital;
  - la elección queda congelada en el pedido (`printRouting`: ganadora, todas las cotizaciones y sus errores).
- **El precio al cliente no cambia según la imprenta:** sale del catálogo del país. Varía nuestro margen.
- **Al mandar a imprimir (`deliver`):** va a la ganadora. Si rechaza el pedido (error no reintentable) o ya no imprime ese producto, pasa a la siguiente de la lista. Un error de red reintenta el paso con la misma.
- **Webhooks, cancelación e imprenta simulada:** por la imprenta que tiene el pedido. Un evento de otra imprenta se ignora.
- **Simuladas:** `mock` y `mock_alt` (imprime más caro y envía más barato a EE. UU.). En EE. UU. compiten las dos.
- **Pendiente:**
  - especificaciones de PDF por imprenta (sangrado, lomo, código de barras); hoy todas reciben el mismo PDF de 21×28 cm con 3 mm de sangrado;
  - margen mínimo (no ofrecer impreso si ninguna imprenta deja margen), si se decide;
  - ver en el admin qué imprenta ganó y por qué.
- **Gelato (verificado con la clave de staging):**
  - tiene fotolibros de 210×280 mm vertical en tapa blanda y tapa dura: coincide con nuestro formato;
  - no hay claves de prueba: una cuenta sin medio de pago funciona como sandbox (los pedidos se cancelan solos).

## 076 · Gelato: Clásico pasa a 28 páginas y México queda en digital hasta tener imprenta local

- **Fecha:** 2026-10-27 · **Decisiones de Sebastián** después de consultar la API de Gelato (catálogo y cotizaciones gratuitas, sin pedidos).
- **Productos de Gelato:** fotolibros 210×280 mm vertical, tapa blanda y tapa dura (`photobooks-softcover_pf_210x280-mm-8x11-inch_…_ver`, `photobooks-hardcover_pf_210x280-mm-8x11-inch_…_ver`). Envían a México y EE. UU.
- **Mínimo de 28 páginas interiores** (28 a 200, pares). Mini (12) y Corto (16) ya eran solo digitales. **Clásico pasa de 24 a 28 páginas** (+4 páginas ilustradas por libro); Épico (32) no cambia. Si más adelante se suma una imprenta de libros cortos, se revisa.
- **Archivo para Gelato:** un solo PDF. Página 1: el pliego de tapa (contratapa + lomo + tapa); página 2 en blanco (guarda); las páginas interiores; la última en blanco. La tapa depende del formato y de las páginas (API `cover-dimensions`):
  - tapa dura, 32 páginas: 478×326 mm con 17 mm de vuelta, lomo de 6 mm;
  - tapa blanda, 32 páginas: 429×286 mm con 3 mm de sangrado, lomo de ~3 mm.
- **Costos reales (USD, impreso en EE. UU., el envío más barato):**
  - a EE. UU.: tapa blanda 16,85–17,50 (6–7 días), tapa dura 19,82–20,72 (7–8 días). Con nuestros precios, buen margen;
  - a México: tapa blanda 44,40–45,32, tapa dura 48,61–49,89 (9–16 días, UPS DDU: el cliente paga la importación al recibir). **A pérdida.**
- **México:** solo digital por ahora (Gelato solo en la matriz de EE. UU.). Se busca una imprenta con producción en México para sumarla al enrutador.

## 077 · Gelato conectado: cotización, pedido (borrador fuera de producción), webhooks y su PDF

- **Fecha:** 2026-10-28.
- **Cotización:** `POST /v4/orders:quote` (gratis, sin archivos). Se toma el envío normal más barato; costo total en USD para competir en el enrutador.
- **Pedido:** `POST /v4/orders` con `orderReferenceId` = nuestro pedido.
  - Antes busca si ya existe (reintentos sin duplicar).
  - Fuera de producción va como **borrador** (`GELATO_ORDER_TYPE=draft`): no se fabrica ni se cobra. En producción: `order`.
- **Archivos (`fileSpec`):** Gelato pide un solo PDF: pliego de tapa, guarda, tripa y guarda. La tapa usa su `cover-dimensions` para las páginas reales:
  - tapa dura: 20 mm de vuelta;
  - tapa blanda: 3 mm de sangrado y lomo según las páginas.
  - Sin zona de código de barras (Gelato lo imprime en la última página).
- **Maquetación por imprenta:** la maqueta usa la tapa de la imprenta elegida al pagar. Si al mandar a imprimir hay que pasar a otra imprenta con otras especificaciones, se salta ("necesita otra maquetación"). Volver a maquetar para la siguiente queda pendiente.
- **Webhooks:** Gelato no los firma. Cada aviso se verifica consultando el pedido con nuestra clave: vale lo que dice su API, no el cuerpo del webhook.
- **Producción:** el chequeo de proveedores simulados ahora también revisa la lista de imprentas (antes `mock_alt` pasaba).
- **Matriz:** Gelato solo en EE. UU., de 28 a 200 páginas pares. En producción, `qaSamplePassed` queda en falso hasta aprobar la muestra física.
- **Muestras:** `scripts/render-sample.ts --gelato` arma el PDF con la tapa real de Gelato.
- **Prueba (2026-10-28, local con IA simulada y Gelato real, sin costo):** libro Clásico de 28 páginas, tapa blanda, a Nueva York.
  - Cotización: USD 16,85 (USPS Ground Advantage, 6–7 días).
  - Borrador creado en Gelato con el producto, las 28 páginas, el envío y la dirección correctos, y nuestra referencia de pedido.
  - El PDF único sale con 31 páginas (tapa + guarda + 28 + guarda).
  - **Gelato no descarga ni valida el archivo de un borrador.** El archivo recién se valida con el primer pedido confirmado (la muestra física).
- **Webhook de Gelato (staging):** `https://api-kxfsarqx2q-uc.a.run.app/v1/webhooks/print/gelato`, configurado en su panel (Developer → Webhooks).

## 078 · Mails transaccionales y postventa (fase 13)

- **Fecha:** 2026-10-28.
- **Plantillas:** paquete `@storynido/emails`, con React Email (`@react-email/components` 1.0.12) en es, en y pt.
  - Datos validados por plantilla: un mail con datos faltantes no sale.
  - Vista previa local: `pnpm --filter @storynido/emails preview <carpeta>`.
- **Proveedor:** Resend (registra solo si hay `RESEND_API_KEY`; si no, el simulado).
  - Clave idempotente en cada envío.
  - En marketing, `List-Unsubscribe` con baja en un clic (RFC 8058).
  - Elegido sobre SendGrid por la API simple, la idempotencia nativa y el plan gratis (3.000 mails por mes).
- **Registro y no duplicar (`emailLog/{huella de la clave}`):** cada mail tiene una clave (`order:<id>:shipped`, `welcome:<uid>`…).
  - Lo ya enviado u omitido no se repite: webhooks duplicados, reintentos del pipeline o el job corrido dos veces.
  - Un mail que falla no frena el pedido: queda `failed` y el job diario lo reintenta, hasta 3 intentos.
  - Guarda los datos, para reenviar desde el admin (fase 15).
- **Cuándo sale cada uno:**
  - pago confirmado: webhook del pago;
  - libro listo (solo el digital): fin del pipeline;
  - en la imprenta: fin del pipeline, con el plazo de la imprenta elegida;
  - en producción, despachado (con seguimiento) y entregado: webhooks de la imprenta;
  - reembolso y cancelación: solo si había un pago;
  - datos borrados;
  - bienvenida: al crear la cuenta;
  - muestra lista: etapa 2 de la vista previa, solo con cuenta;
  - alertas al equipo: revisión manual, falla de imprenta, monto distinto. Destinatarios en `ADMIN_ALERT_EMAILS`.
- **"Libro listo" lleva al pedido, no a un link de descarga.** El link firmado se genera al tocar "Descargar", solo para la cuenta dueña, así no circulan links a libros de chicos por mail.
- **Postventa (job diario `POST /jobs/daily` del worker, con Cloud Scheduler):**
  - pedido de opinión a los 7 días de entregado (el digital, desde que quedó listo);
  - recordatorio de muestra sin comprar entre 1 y 3 días después;
  - sugerencia de un libro nuevo el 1/12 (Navidad, todos los países) y el 16/4 (Día del Niño, México);
  - reintento de los mails fallidos.
  - El cumpleaños del chico queda pendiente: hoy no guardamos fecha de nacimiento, solo la edad.
- **Marketing (opinión, recordatorio, sugerencias):**
  - solo con `marketingOptIn` y con enlace de baja firmado (HMAC con `EMAIL_LINK_SECRET`; sin secreto no se mandan);
  - la baja (`/v1/email/unsubscribe`, GET o POST) apaga `marketingOptIn`;
  - en Mi cuenta → Preferencias está el interruptor "Recibir novedades";
  - los avisos del pedido llegan siempre;
  - antes de mandar marketing a EE. UU. hace falta una dirección postal en el pie (CAN-SPAM): `EMAIL_POSTAL_ADDRESS`.
- **Opiniones (`reviews/{pedido}`):** formulario en la página del pedido (1–5 estrellas y comentario), recién con el libro recibido.
  - Son privadas: mostrarlas en la web requiere el permiso del cliente (regla de no publicar testimonios inventados).
- **Inicio de sesión:** el mail del enlace mágico lo sigue mandando Firebase; personalizarlo queda pendiente.
