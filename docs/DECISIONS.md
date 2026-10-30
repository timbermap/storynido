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

## 079 · Eventos (fase 12b): un diseño, muchas copias, en digital para imprimir

- **Fecha:** 2026-10-28.
- **Datos del cumpleaños (`book.event`):** fecha, edad que cumple y temática.
  - Se cargan en el paso del protagonista (solo en Eventos) y los validan las reglas.
  - La temática se modera antes de entrar al prompt.
  - El cuento termina con la celebración y no nombra a los invitados.
- **Un solo diseño:** el librito Mini (con su lámina y sus ilustraciones) es el diseño.
  - Las piezas se arman con plantillas a partir de la portada aprobada: **ninguna pieza usa IA**. Verificado: un kit hace las mismas llamadas de imagen que el libro solo.
  - Lo que queda afuera: el libro para colorear con dibujos de contorno, que necesitaría IA.
- **Piezas (PDF para imprimir en casa o en una imprenta local; Carta en EE. UU., A4 en el resto):**
  - invitación y tarjeta de agradecimiento: 5×7", frente y dorso, con 3 mm de sangrado y marcas de corte;
  - hoja de 12 stickers redondos de 2";
  - 9 etiquetas para la bolsita, con el agujero marcado;
  - kit de actividades: laberinto, dibujar la torta y unir palabras.
  - Cada hoja lleva la licencia: "N copias para el cumpleaños de …".
  - Todo junto en un ZIP. Se descarga por pieza o el ZIP, con URL firmada de 15 minutos.
- **Precio (`eventPricing/{país}`):** diseño una vez (incluye el librito) + licencia digital por pieza.
  - Las copias no cambian el precio del digital: las dice la licencia.
  - "Pedir más copias" cobra solo las licencias, sin el diseño y sin IA.
  - Precios de ejemplo: México 249 MXN el diseño y 49–69 por pieza; EE. UU. USD 14.99 y 2.99–3.99. Se editan en el admin (fase 14).
- **Impreso:** hoy ninguna imprenta del enrutador imprime estas piezas (Gelato pide 28 páginas para libros). Solo digital y **"Pedir cotización"**, que le llega al equipo (`printQuoteRequests` y alerta por mail). Nunca se inventa disponibilidad.
- **Pedido:** una línea por pieza (`items`, con las copias como cantidad) y el kit en `order.kit` (piezas, invitación y hoja).
- **Pendiente:**
  - libro de colorear del kit (con IA de contorno, con costo);
  - piezas impresas, cuando haya una imprenta que las haga en el país;
  - el aviso "tu libro está listo" todavía dice "libro" también para el kit.

## 080 · Cloudprinter: libro impreso en México con margen, y tamaño de página por imprenta

- **Fecha:** 2026-10-28 · Clave de sandbox de Sebastián: el sandbox no imprime ni cobra y simula las señales.
- **Producto:** fotolibros US Letter vertical (21,59 × 27,94 cm), lo más cercano a nuestro 21×28:
  - tapa blanda: `photobook_pb_us_letter_p_fc`, 3 mm de sangrado;
  - tapa dura: `photobook_cw_us_letter_p_fc`, 18 mm de vuelta.
- **Cotización real (USD, 28 páginas, envío más barato):**

| Destino | Tapa   | Cloudprinter | Gelato    |
| ------- | ------ | ------------ | --------- |
| México  | blanda | 13,49        | 44,40     |
| México  | dura   | 19,05        | 48,61     |
| EE. UU. | blanda | 17,54        | **16,85** |
| EE. UU. | dura   | 36,62        | **19,82** |

- En México produce cerca, con envío de unos USD 8. Con los precios actuales queda un margen de USD 22–27.
- En EE. UU. gana Gelato; el enrutador elige solo, pedido por pedido.
- **Tamaño por imprenta:** la especificación de archivos (`fileSpec`) incluye el tamaño al corte. La tripa y la tapa se maquetan al tamaño de la imprenta elegida al pagar. Las ilustraciones 3:4 se recortan apenas a los costados.
- **Archivos:** tapa y tripa en dos PDF, con el MD5 de cada uno (Cloudprinter verifica la descarga). Lomo con su fórmula: gramaje × volumen × páginas/2 ÷ 1000 + 2 × grosor de tapa (papel de 200 g mate).
- **Pedido:**
  - `orders/add` con la cotización elegida y la referencia = nuestro pedido;
  - idempotente: antes consulta `orders/info`.
- **Señales (CloudSignal):** cada una trae la clave del webhook (`CLOUDPRINTER_WEBHOOK_KEY`, configurada en su panel), que se compara.
  - Producción → `in_production`; despacho → `shipped` (con seguimiento); entrega → `delivered`; cancelación → `cancelled`.
  - Error sin demora → falla (revisión manual); error con demora → atraso, se ignora.
- **Matriz:** Cloudprinter en México y EE. UU., tapa blanda y dura, de 28 a 200 páginas.
- **Pendiente:**
  - revistas abrochadas (`magazine_sas_us_letter_p_fc`, desde 8 páginas en múltiplos de 4) para los libritos impresos de Eventos: el formato exacto de la tapa se confirma con un pedido de sandbox;
  - la muestra física.

## 081 · Profesionales: cuenta Pro, proyectos por alias y descuento por recurrencia

- **Fecha:** 2026-10-28 · Fase 12c.
- **Cuenta Pro:** `users.accountType` (`family` por defecto) y un perfil mínimo (profesión de una lista con "otra", espacio opcional y país).
  - La escribe solo la API (`POST /v1/me/professional`); las reglas no dejan que el cliente la cambie.
  - No cambia el rol (`customer`): ni custom claims ni admin.
  - Se activa al entrar al creador por la línea Profesionales, después de iniciar sesión. Sin cuenta Pro no se crea el primer borrador de esa línea.
- **Precio:** `price.proAmountMinor` (precio Pro base, separado del de Familias) y el descuento por compras elegibles en 90 días (`proDiscounts/global`: 5 → 10 %, 10 → 15 %, 20 → 20 %; tope en impreso 15 %).
  - **Compras elegibles:** pedidos pagados en adelante (incluye `qa_failed`), sin reembolsados, cancelados ni pendientes; cada pedido cuenta una vez y se cuentan en el servidor.
  - Un solo descuento: el mayor entre cupón, promoción y Pro. Queda en el snapshot del pedido; los anteriores no cambian.
  - Un reembolso posterior baja el escalón para las compras siguientes.
  - Una cuenta Familia no accede al precio Pro aunque lo pida en la petición (test).
- **Proyectos por niño:** cada libro es un proyecto; el niño se identifica con un **alias** (`children.alias`, opcional) y el nombre es el que va en el cuento. No se pide el apellido.
  - "Mi cuenta" Pro: descuento vigente y próximo escalón, proyectos agrupados por niño, "Continuar" y **"Repetir configuración"** (historia, extensión, densidad, nivel y estilo a un borrador nuevo, sin datos ni fotos del niño).
  - El alias no va a analítica ni a logs.
- **Fotos de niños que no son propios:** antes de subir, el profesional declara la autorización de la madre, el padre o el tutor (`consents` tipo `guardian_authorization`, versión `guardian-authorization-v1`, con fecha, IP y navegador).
  - La API rechaza la subida de una cuenta Pro sin esa declaración.
  - El borrador de Profesionales arranca en modo sin foto (avatar).
  - El texto lo revisa un abogado antes del lanzamiento.
- **Objetivo educativo:** se elige entre los temas de las colecciones de la historia (`book.goal`). En el servidor solo entra al prompt si es uno de esos temas (nunca texto libre). Guía la historia sin indicaciones terapéuticas ni diagnósticos.
- **Aviso:** "material educativo, no reemplaza una intervención profesional o clínica" en el creador (paso del objetivo) y al cierre del PDF de los libros de Profesionales.
- **Pendiente:**
  - modo "texto propio ilustrado por StoryNido";
  - tabla de descuentos y precio Pro editables en el admin (fase 14);
  - revisión legal del texto de autorización.

## 082 · Admin, etapa 1: acceso con 2FA, auditoría transversal e interruptor del sitio

- **Fecha:** 2026-10-28 · Fase 14 (etapa 1 de 4).
- **Acceso:** solo `admin` y `superadmin`, con **verificación en dos pasos obligatoria** (TOTP de Identity Platform: Google Authenticator, 1Password, Authy).
  - Ingreso con Google. El enlace mágico no admite segundo factor en Firebase, así que el admin no lo usa.
  - Un admin sin factor registrado ve el alta (QR o clave); al confirmarlo vuelve a entrar con el código.
  - La API lo hace cumplir en todas las rutas `admin`/`superadmin`: el token tiene que traer `firebase.sign_in_second_factor` (error `mfa_required`). Por defecto se exige fuera de local (`ADMIN_MFA_REQUIRED`).
  - **Requisito:** pasar el proyecto a Identity Platform y activar TOTP. Es un cambio que no se puede deshacer; sin costo hasta 50.000 usuarios activos por mes (TOTP no cobra por uso).
- **Auditoría:** toda escritura del admin pasa por `auditedWrite`, que guarda el cambio y su entrada de `auditLog` (quién, qué, cuándo, antes y después) en el mismo lote. Pantalla de auditoría con filtro por entidad y paginado.
- **Interruptor del sitio:** `PUT /v1/admin/site-config` (admin) escribe `siteConfig/global`.
  - La API lo escucha en vivo; la web lo revalida cada 15 s, sin redeploy.
  - "Solo vista previa" muestra un aviso arriba de la web y bloquea las compras.
- **Panel:** navegación lateral con búsqueda, modo claro/oscuro (guardado en el navegador), Resumen (modo del sitio y gasto de IA de hoy), Sitio, IA (solo el superadmin edita) y Auditoría.
- **Siguientes etapas:**
  - 2: países, precios (Familias, Pro y Eventos), cupones, promociones y descuentos Pro;
  - 3: historias, colecciones, estilos, enseñanzas, opciones editoriales, contenido y prueba de prompts;
  - 4: dashboard con agregados y catálogo de modelos de IA (`aiModels`) con sus reglas.

## 083 · Admin, etapa 2: configuración del negocio (países, precios, cupones, promociones, Eventos y Pro)

- **Fecha:** 2026-10-28 · Fase 14 (etapa 2 de 4).
- **Un solo mecanismo:** `ADMIN_CONFIG` (shared) dice, por tipo, la colección, el esquema de entrada y el id del documento.
  - Rutas: `GET /v1/admin/config/:tipo` y `PUT /v1/admin/config/:tipo/:id`.
  - El servidor valida con el esquema, exige el id natural (`MX_digital`, `MX`, el código del cupón) y pone `updatedAt` y `createdAt`.
  - Nunca pisa los usos de un cupón.
  - Todo queda en la auditoría con antes y después.
- **Tipos:** países (activación, formatos, moneda, impuesto, envío e idioma), precios (Familias, Pro base y ajuste por extensión), cupones, promociones (con inicio y fin; el fin tiene que ser posterior), precios de Eventos por país y descuento Pro (ventana, escalones y tope en impresos).
- **Panel:** un editor genérico (tabla + formulario armado con la descripción de los campos).
  - Los montos se editan en la unidad de la moneda y se guardan en centavos.
  - "Nuevo" no pisa un documento existente: se edita desde la tabla.
- **Propagación:** la API toma los cambios en menos de un minuto (cache del catálogo); las páginas públicas, en hasta 5 minutos (revalidación de Next).
- **Probado en local con los emuladores:** ingreso, alta de precio, descuento Pro, cambio de modo del sitio, auditoría, búsqueda y modo oscuro.

## 084 · Admin en staging sin 2FA hasta pasar a Identity Platform

- **Fecha:** 2026-10-28 · Decisión de Sebastián: el paso a Identity Platform (sin vuelta atrás) queda para cuando preparemos producción.
- **Staging:** `ADMIN_MFA_REQUIRED=false` en la API (Terraform: `admin_mfa_required`) y `NEXT_PUBLIC_ADMIN_MFA_REQUIRED=false` en el admin. El acceso queda protegido por el rol y la cuenta de Google.
- **Producción:** sigue exigiendo 2FA por defecto. Antes de lanzar hay que pasar a Identity Platform y activar TOTP (criterio de aceptación de la fase 14).
- **Backend `admin`** en App Hosting (entorno `staging`), en https://admin--storynido-staging.us-central1.hosted.app.
  - Dominio autorizado en Auth y agregado al CORS de la API.
  - `admin_url` apunta al panel (enlace de las alertas por mail).

## 085 · Admin, etapa 3: catálogo editorial, contenido y prueba de prompts

- **Fecha:** 2026-10-28 · Fase 14 (etapa 3 de 4).
- **Mismo mecanismo que la etapa 2** (`ADMIN_CONFIG`), con seis tipos más:
  - historias: edades, textos por idioma, prompts de texto e imagen, páginas de muestra, líneas, colecciones y opciones editoriales admitidas, sin duplicar plantillas;
  - colecciones, con su línea y sus temas u objetivos;
  - estilos de ilustración y enseñanzas (con su guía para la IA y la marca de tema sensible);
  - opciones editoriales (`editorialConfig/global`);
  - contenido (legales, preguntas frecuentes y banner por idioma, en Markdown, con vista previa y quién lo cambió).
- **Validación en el servidor:** edades al revés, slugs, ids naturales (`faq_es`) y la configuración editorial completa. Nada inválido llega a Firestore.
- **Probar prompt:** arma el prompt de texto y el de una ilustración con datos de ejemplo (Martina, 5 años), tal como le llegarían a la IA, incluso antes de guardar. No llama a la IA: no tiene costo.
- **Editor:** campos por idioma (es, en, pt), texto largo, listas y JSON validado para las estructuras anidadas (extensiones, niveles, temas).
- **Pendiente (etapa 4):** dashboard con agregados precalculados y catálogo de modelos de IA (`aiModels`) con sus reglas de política de datos.

## 086 · Lulu: tercera imprenta para EE. UU., con páginas para dibujar hasta el mínimo

- **Fecha:** 2026-10-28 · Pedido de Sebastián (opciones A y B).
- **Producto:** US Letter a color estándar, papel estucado de 80 lb:
  - tapa blanda: `0850X1100FCSTDPB080CW444GXX`;
  - tapa dura: `0850X1100FCSTDCW080CW444GXX`.
- **Cotización real (sandbox, 28 páginas, Austin, TX, con impuesto):** tapa blanda USD 11,52 (5,83 + envío 5,69); tapa dura USD 20,81. Le gana a Gelato (16,85 y 19,82) y a Cloudprinter (17,54 y 36,62) en tapa blanda.
- **Mínimo de páginas:** tapa blanda de 32 a 800; tapa dura desde 24. La imprenta declara `minInteriorPages` en su especificación de archivos y el maquetador agrega páginas **"Mis dibujos"** antes del cierre (siempre pares). Así cualquier libro de 28 o más páginas puede ir a Lulu.
- **Archivos:** tapa y tripa por separado (las descarga de una URL), con sangrado de 1/8" (3,175 mm, nuevo campo `bleedMm`). La tapa usa las medidas de su API `cover-dimensions` (lomo y vuelta incluidos).
- **Envío:** el más barato entre MAIL y PRIORITY_MAIL (no hay GROUND a EE. UU. para estos libros).
- **Solo EE. UU.:** México y Latinoamérica piden el documento fiscal del destinatario; si no hay envío posible, el error no es reintentable y el enrutador elige otra imprenta.
- **Pedido:** idempotente por nuestro pedido (`external_id`). Exige teléfono del destinatario.
- **Avisos:** `PRINT_JOB_STATUS_CHANGED`. No se cree lo que llega: se consulta el trabajo con nuestras credenciales (producción → `in_production`, despacho con seguimiento → `shipped`, rechazo → `failed`, cancelación → `cancelled`).
- **Ambientes:** fuera de producción va siempre al sandbox (no imprime ni cobra; `LULU_SANDBOX`). Las claves de producción solo crean pedidos en producción.
- **Staging, en dos pasos:**
  1. Terraform crea los secretos `lulu-client-key` y `lulu-client-secret` (vacíos).
  2. Sebastián carga los valores del sandbox; recién entonces se suma `lulu` a `print_providers` (Cloud Run no arranca con un secreto sin versión).
- **Pendiente:** registrar el webhook en Lulu y hacer una prueba de punta a punta en el sandbox (confirmar si pide un medio de pago de prueba).

## 087 · Admin, etapa 4: dashboard con agregados y catálogo de modelos de IA

- **Fecha:** 2026-10-28 · Cierra la fase 14 (falta la verificación en dos pasos de staging; ver 084).
- **Dashboard:** ventas de hoy, de 7 días y del período; ticket promedio; conversión de muestra a compra; costo de IA (muestras no compradas incluidas); impresión y envío; margen neto estimado; ingresos por país y por moneda; barras por día con tooltip y vista de tabla.
  - **Agregados:** `metricsDaily/{día}`. Un día cerrado se calcula una vez y se guarda; no se recalcula. Hoy se calcula en vivo. Cada cálculo lee solo los pedidos de un día, así que escala.
  - **Ventas:** pedidos pagados y no reembolsados ni cancelados (la misma lista que el descuento Pro, `REVENUE_ORDER_STATUSES`).
  - **Margen estimado:** ingresos sin impuestos − IA − impresión y envío. No incluye comisiones de pago (proveedor por definir).
  - **Tipo de cambio:** `fxRates/{día}` desde open.er-api.com (ExchangeRate-API, acceso abierto con atribución), una consulta por día. Si falla, se usa la última cotización guardada y el panel muestra de qué fecha es.
- **Catálogo de modelos (`aiModels`):** precio por millón de tokens, política de datos (entrena con los datos, revisión humana, regiones, contrato empresarial), ambientes permitidos, si puede recibir fotos de chicos y la última evaluación. Lo edita solo el superadmin.
- **Reglas que hace cumplir el sistema:**
  - al elegir un modelo en IA, tiene que estar en el catálogo (si el catálogo tiene modelos) y permitido en el ambiente;
  - en producción, nunca un modelo que entrena con los datos o tiene revisión humana;
  - si el modelo de imagen activo no puede recibir fotos de chicos, las muestras se crean solo sin foto;
  - el costo de cada llamada usa el precio del catálogo; si no tiene, el de lista; si no, el peor caso (USD 2 / 120 por millón).
- **Costo real:** por muestra y por libro (promedio, p50 y p95, según el modelo de imagen) y por modelo, desde `aiUsage`.
- **Semilla:** los cuatro modelos de Vertex en uso, con su precio de lista. Pendiente: confirmar la exención del monitoreo de abuso de Vertex (revisión humana) antes de producción.
- **Gráficos:** una serie con el color de la marca, validado contra la superficie clara (`#79518c`) y la oscura (`#a77bd0`).

## 088 · Admin, operaciones (fase 15)

- **Fecha:** 2026-10-28.
- **Pedidos:**
  - búsqueda por número o email y filtros (estado, país, canal, formato, fechas). En Firestore va un filtro de igualdad con su índice por fecha; el resto se filtra en memoria sobre 200 pedidos;
  - detalle con montos, descuento, imprenta y cotizaciones, seguimiento, pipeline (duración, intentos, errores y costo por paso), códigos de QA, y costos y margen en USD;
  - acciones con confirmación y auditoría: aprobar, reintentar desde un paso, regenerar, reenviar el mail del estado, cancelar en la imprenta y reembolsar con motivo.
- **Revisión manual:**
  - la cola son los pedidos `qa_failed`, con el paso y los códigos de QA;
  - **aprobar** solo si falló el control de calidad. Guarda `pipeline.humanApproval` (generación y quién) y pide el reintento desde `quality_check`; el worker acepta las ilustraciones tal como están (código `human_approved`) y sigue a maqueta y entrega sin más IA. Probado de punta a punta con mocks;
  - las ilustraciones muestran al chico: el panel las da solo para pedidos en revisión, detrás de un botón, con enlaces de 15 minutos.
- **Clientes:**
  - lista y detalle con compras, gasto por moneda, nivel Pro y cantidad de perfiles de chicos (nunca sus datos);
  - borrado a pedido de fotos, perfiles y borradores. Se conservan la cuenta y los pedidos (facturación). La constancia queda en `privacyRequests` y en la auditoría, y el cliente recibe un mail.
- **Usuarios del panel:** solo el superadmin da de alta, baja o cambia roles. Nadie se cambia a sí mismo, siempre queda un superadmin, y el cambio cierra las sesiones de esa persona (`revokeRefreshTokens`).
- **Auditoría:** filtros por entidad, por quién hizo el cambio y desde una fecha.
- **Integraciones:** estado y "Probar conexión", sin pedidos ni mails reales:
  - imprenta: cotiza a EE. UU.;
  - mails: verifica la clave y los dominios;
  - IA: una moderación mínima;
  - archivos: una lectura;
  - pagos: muestra el proveedor configurado (no hay un pago de prueba real hasta elegir proveedor).
- **Cotizaciones de Eventos:** cola con estado (nueva, contactada, cerrada) y nota interna, auditados.
- **Calidad y canales:**
  - las tasas del informe §10, cada una con numerador y denominador;
  - códigos de QA del período;
  - imprenta por proveedor, formato y país (pedidos, fallas en la entrega y cancelados);
  - ventas, ticket y clientes que repiten por canal;
  - formatos, extensiones y densidades más elegidos.
  - `story_edit_rate` usa el nuevo código `text_edited`; `support_case_rate` queda sin dato hasta tener soporte.
- **Índices nuevos:** `auditLog (actorEmail, at)`, `aiUsage (kind, at)` y `qaEvents.at` en grupo de colecciones.

## 089 · Observabilidad, seguridad y privacidad (fase 16)

- **Fecha:** 2026-10-28.
- **Trazas:** cada pedido tiene un ID de Cloud Trace derivado de su número (`orderTraceId`). El worker lo manda en `X-Cloud-Trace-Context` a Cloud Tasks (cada página) y a Workflows (cada paso), así Cloud Run agrupa el recorrido completo del pedido en una sola traza.
  - Se usa el rastreo nativo de Cloud Run en lugar del SDK de OpenTelemetry: da la misma traza de punta a punta sin sumar dependencias pesadas. OpenTelemetry queda como mejora si hace falta medir dentro de un request (spans internos).
- **Logs:** cada request lleva su traza (`logging.googleapis.com/trace`), y los del pipeline, el `orderId` y la traza del pedido. Los eventos tienen nombre (`event`):
  - `pipeline_step`, con su duración y costo;
  - `pipeline_failed` y `pipeline_stuck`;
  - `order_status`;
  - `ai_usage` y `ai_budget_alert`;
  - `webhook_rejected`.
- **Error Reporting:** los logs de error salen con `@type` ReportedErrorEvent, servicio, versión (`K_REVISION`) y la pila en `stack_trace`.
- **Cloud Monitoring (Terraform):**
  - **Métricas desde los logs:** pedidos por estado, duración de cada paso, llamadas y costo de IA, revisión manual, atascos, webhooks rechazados y errores por servicio.
  - **Tablero "operación".**
  - **Alertas por mail:** pedido en revisión manual, pipeline atascado (vigía cada 30 minutos: más de 2 horas generando), webhooks rechazados, presupuesto de IA cerca del límite, pico de uso de IA, errores en los servicios, además de las que ya había (API caída, 5xx y presupuesto de facturación al 50, 90 y 100 %).
- **Seguridad:**
  - **CSP y cabeceras** (HSTS, X-Frame-Options, nosniff, Referrer-Policy, COOP y Permissions-Policy) en la web y el admin. La CSP es de lista cerrada; `script-src` conserva `'unsafe-inline'` por las páginas estáticas de Next.
  - **App Check:** la web manda el token de App Check (reCAPTCHA Enterprise) si existe la clave del sitio. Pendiente: crear la clave y registrar la app en App Check (Terraform, con OK); después se exige también en staging.
  - **Dependencias:** `pnpm audit --prod --audit-level=high` en CI. Se actualizó zod a 4.6.7 y se fuerza `@grpc/grpc-js` ≥ 1.13.6 (dos vulnerabilidades altas).
  - **Reglas:** tests nuevos para las colecciones del panel (solo lectura de admin).
- **Privacidad:** `docs/PRIVACY.md` (qué datos, dónde, cuánto tiempo, encargados, bases legales y derechos). CMEK evaluado y no adoptado por ahora.

## 090 · E2E, rendimiento y accesibilidad (fase 17)

- **Fecha:** 2026-10-28.
- **E2E con Playwright** (`e2e/`), contra los emuladores, la API, el worker, la web y el admin locales, con IA, pagos, imprenta y mails simulados (sin costo):
  - **Páginas públicas:** home, landings de Familias, Eventos y Profesionales, catálogo y detalle de una historia, en es, en y pt, a 390 y 1440 px. Cada una sin scroll horizontal, con cero violaciones de axe (WCAG 2.2 AA) y con el botón que lleva a cada público a su creador.
  - **Compra completa (escritorio, México):** foto con consentimiento, muestra, cuenta con enlace mágico, edición y regeneración, checkout de tapa blanda con cupón, pago simulado, pipeline hasta la imprenta, entrega con seguimiento, opinión, recompra en digital sin IA, y borrado de datos y de la cuenta.
  - **Móvil sin foto (390 px):** rasgos elegidos (anteojos), libro para colorear Mini, "Mía" con tilde y la lámina con los rasgos.
  - **Admin:**
    - un cliente no entra;
    - el modo del sitio llega a la web en segundos;
    - reembolso con motivo y auditoría;
    - aprobar desde la cola de revisión.
    - El segundo factor se prueba en la API: con emuladores no hay TOTP.
- **CI:** `.github/workflows/e2e.yml` corre la suite completa en cada PR y en main (emuladores con `emulators:exec` y seed), y las páginas públicas contra staging después de cada deploy.
- **Lo que encontraron los E2E (corregido):**
  - el formulario de opinión había quedado dentro del botón de descarga del kit de Eventos: solo aparecía en kits, y dentro de un botón;
  - el pie tenía contraste 4,2:1 (ahora más de 4,5:1);
  - la lista del resumen del creador tenía una estructura inválida para lectores de pantalla;
  - el creador saltaba al cargar (CLS 0,58): ahora reserva la altura.
- **Lighthouse** (`e2e/perf/lighthouse.mjs`, páginas clave en móvil y escritorio, umbral 90):
  - staging, antes de estos arreglos: rendimiento 93–100, accesibilidad 96–97, buenas prácticas 96 y SEO 89. El SEO baja solo por el canonical, que apunta al dominio real cuando se mide en `hosted.app`;
  - el creador en móvil daba 77 por el salto de diseño ya corregido;
  - `is-crawlable` no se mide: local y staging son `noindex` a propósito.
- **Carga** (`e2e/perf/load.mjs`, autocannon, 50 conexiones, una instancia local):
  - catálogo de historias: unos 15.000 pedidos por segundo (p99 de 6 ms);
  - modo del sitio y colecciones: más de 44.000 pedidos por segundo;
  - el límite por IP (120 por minuto) frena a un mismo cliente, como corresponde;
  - miles de pedidos por día son menos de un pedido por segundo; lo que escala es el pipeline (Cloud Run hasta 3 instancias en staging, con Cloud Tasks por página).
- **Escenarios del informe (§7.4):** `docs/QA-SCENARIOS.md` relaciona cada uno con su prueba.
  - Los visuales (parecido, estabilidad, ropa), los regionales y los de tono los cubre el panel humano.
  - Falta el escenario 22 (fecha de regalo).

## 091 · Trazas en Cloud Trace y documentación de salida (fase 18)

- **Problema:** Cloud Run no guardaba ningún span. El proyecto no tenía el bucket `_Trace`, y Cloud Run no lo crea (Google: solo lo crean las escrituras a la API de Trace o de Telemetry).
- **Decisión:**
  - Terraform habilita la API de Observability y crea el bucket `_Trace` en `us` (30 días de retención).
  - La API y el worker mandan un span por cada request muestreado a la API v2 de Cloud Trace (`CloudTraceSink`, en lotes cada 5 s; si falla, se pierde y no frena el request).
  - El span usa como ID el de la cabecera, el mismo que llevan los logs. Así los pasos de un pedido, que llegan con la traza del pedido, quedan en una sola traza.
  - Sin OpenTelemetry: alcanza con un hook de Fastify, sin instrumentar módulos ESM. Si hace falta ver las llamadas a Firestore o a Vertex como tramos, se suma OpenTelemetry.
- **Costo:** los primeros 2,5 millones de spans por mes son gratis; staging queda en USD 0.
- **Documentación de salida:** `docs/RUNBOOK.md` (alertas, pedidos, vuelta atrás, modos del sitio, secretos) y `docs/LAUNCH.md` (lista de salida a producción, con quién hace cada cosa).
- **Copy:** los mensajes de error de la API que ve el público pasaron a "tú" (había voseo).

## 092 · Identity Platform con TOTP, App Check y webhook de Lulu

- **Fecha:** 2026-10-29. Sebastián pidió avanzar con la seguridad para producción; reemplaza la espera de DECISIONS 084.
- **Identity Platform (sin vuelta atrás):** Terraform (`google_identity_platform_config`) pasa el Auth de staging a Identity Platform y habilita TOTP como segundo factor.
  - Replica lo que estaba configurado a mano: enlace por mail, anónimo y los dominios autorizados, ahora versionados en `auth_authorized_domains`.
  - El proveedor Google sigue configurado en la consola.
  - Staging pasa a exigir 2FA en el admin (`admin_mfa_required = true` y `NEXT_PUBLIC_ADMIN_MFA_REQUIRED=true`).
- **App Check:** clave de reCAPTCHA Enterprise por ambiente (solo los dominios de la web) y su configuración de App Check en la app web.
  - La clave pública va en `apphosting*.yaml` (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`).
  - En staging, App Check no se exige, para no cortar el E2E contra staging; producción lo exige por defecto.
- **Costos:**
  - staging: USD 0;
  - Identity Platform: gratis hasta unos 50.000 usuarios activos por mes; hay que confirmar si los anónimos cuentan;
  - reCAPTCHA: 10.000 verificaciones gratis por mes.
- **Webhook de Lulu:** se registra por la API con `infra/scripts/lulu-webhook.sh` (Lulu no tiene pantalla). Sandbox registrado y aviso de prueba recibido (rechazado con 400, como corresponde).

## 093 · Sesiones anónimas abandonadas: se borran a los 30 días

- **Problema:** el creador funciona sin cuenta, con una sesión anónima. Si el adulto no crea la cuenta, el borrador y el perfil del chico (nombre, edad, gustos) quedaban guardados para siempre, sin que nadie pudiera borrarlos.
- **Decisión:** el job diario del worker (`AnonymousCleanup`) borra las sesiones anónimas sin actividad hace más de 30 días, junto con sus borradores, ilustraciones de muestra, perfiles de chicos y fotos.
  - Nunca toca una cuenta con mail o Google, ni una sesión usada en los últimos 30 días (en Auth o con algún libro reciente), ni a nadie con pedidos.
  - Solo "el usuario no existe" cuenta como borrado: cualquier otro error de Auth corta el job.
- **Identity Platform:** `autodelete_anonymous_users = true` borra las sesiones anónimas a los 30 días. Así no cuentan como usuarios activos en el precio. Lo que quede en Firestore lo borra el job.
- **Constancias:** los consentimientos se conservan (prueba legal); `PRIVACY.md` actualizado.

## 094 · Idioma y país por IP; el país sale del footer

- **Fecha:** 2026-10-29 · Pedido de Sebastián: "seremos globales".
- **Detección:**
  - App Hosting no manda el país, solo la IP (`x-fah-client-ip`); se probó con una ruta temporal.
  - El país se saca de la IP con la base gratuita de DB-IP ("IP to Country Lite", CC BY 4.0, unos 8 MB), que `scripts/fetch-geoip.mjs` baja al compilar la web.
  - La consulta corre en nuestro servidor: la IP no sale a terceros ni se guarda. Si la base falta, se usa el idioma del navegador.
- **Idioma:** sin idioma elegido, sale del país de la IP: español en los países hispanohablantes, portugués en los lusófonos e inglés en el resto (`localeForCountry`). Elegirlo en el footer o en la cuenta tiene prioridad (cookie `sn_locale`).
- **País:**
  - sale del footer;
  - se elige en "Mi cuenta → Preferencias", junto al idioma; queda en el perfil y en el dispositivo;
  - al iniciar sesión, el país y el idioma de la cuenta se aplican al dispositivo.
  - Mientras los países conocidos sean 7, uno fuera de la lista (por ejemplo, Argentina) muestra precios del país principal del idioma. Esto cambia con el envío cotizado por pedido.
- **Privacidad:** la política pública informa el uso de la IP y atribuye a DB-IP.

## 095 · El creador desde una línea arranca el cuento de esa línea

- **Problema:** desde "Crear para un evento", con una sesión anónima que tenía un borrador vacío de otra línea, se veía "Tus cuentos en proceso · Cuento sin nombre" en vez de arrancar.
- **Decisión:**
  - con `?line=`, solo se ofrecen los borradores de esa línea; si no hay, se crea uno y se entra directo;
  - un borrador vacío (sin nombre y en el primer paso) se reutiliza en vez de listarse;
  - en la lista, los borradores sin nombre dicen de qué línea son.

## 096 · Precio = costo + margen; envío cotizado con cada pedido; todos los países

- **Fecha:** 2026-10-29 · Decisión de Sebastián: "para Argentina y demás países, siempre activo; se busca la mejor oferta y se ofrece al cliente, si paga paga". Costo real más margen por producto (incluido el digital), con el tipo de margen elegido en el admin; por defecto, monto fijo.
- **Países:** los 249 de ISO 3166-1.
  - Los 7 con configuración propia mantienen su moneda e impuesto.
  - El resto se vende en dólares, sin impuesto propio, con todos los formatos activos.
  - El admin puede pisar cualquier país (moneda, impuesto, apagar formatos o el país).
  - Los nombres salen de `Intl.DisplayNames`.
- **Márgenes** (`productPricing/{digital|softcover|hardcover}`, en USD; admin → Precios y márgenes):
  - costo propio: IA, PDF y operación, USD 1 por defecto;
  - tipo de margen: fijo, porcentaje del costo, o porcentaje con mínimo;
  - ajuste por extensión;
  - descuento base Pro;
  - de fábrica, monto fijo: digital USD 18,99 de margen (19,99 en total), tapa blanda USD 27 y tapa dura USD 28.
- **Cálculo** (`quote`):
  - libro = costo propio + impresión + margen + extensión, en dólares;
  - se convierte con el tipo de cambio del día a la moneda del país del pedido y se redondea hacia arriba a un "precio lindo" (,99; en pesos chilenos, 900);
  - el envío se cobra al costo, sin margen, redondeado hacia arriba a la unidad.
  - Cupones, promociones, descuento Pro e impuestos funcionan igual que antes.
- **Impreso:**
  - **Sin dirección:** se estima con la imprenta habilitada más barata; el envío queda "se calcula con tu dirección" y no se puede pagar.
  - **Con la dirección completa:** se cotiza en vivo con todas las imprentas que pueden y gana la más barata. El envío en dólares es el total menos la impresión, igual para todas.
  - **País del pedido:** es el de la dirección, que se elige en el checkout entre todos los países; define la moneda.
  - **Aviso de importación:** fuera de los países configurados se avisa que puede haber impuestos de importación.
- **Imprentas para cualquier destino:** opciones de imprenta con país `*` para Gelato, Cloudprinter y Lulu (y la simulada fuera de producción). Si una no llega, o pide datos que no tenemos (Lulu pide el documento fiscal en Latinoamérica), su cotización falla y queda afuera. Las del país pisan a las globales.
- **Catálogo:** la oferta muestra el digital exacto y el impreso como "desde", con "el envío se calcula con tu dirección".
- **Tipo de cambio:** el de `fxRates` del día (open.er-api.com). En los emuladores, el seed carga uno fijo para no depender de internet.
- **Pendiente:**
  - el kit de Eventos sigue con precio por país (`eventPricing`) y en países sin configurar no se ofrece;
  - impuestos de bienes digitales en la UE y otros (IVA OSS), a revisar con el procesador de pagos y el contador;
  - países con sanciones o sin cobertura de pagos, a definir con el procesador.

## 097 · Todo en dólares; la moneda local, solo de referencia

- **Fecha:** 2026-10-29 · Decisión de Sebastián: "quiero todo en US$; la conversión a moneda local, al final".
- **Se cobra en USD en todos los países:**
  - precios;
  - pedidos (`priceSnapshot.currency`);
  - cupones fijos;
  - kit de Eventos: un precio en dólares para todo el mundo, guardado en `eventPricing/US`; un país solo usa el suyo si está en USD.
- **El "precio lindo"** (,99) es en dólares. El envío se cobra al costo, al centavo.
- **La moneda del país** (`countries.currency`) es solo informativa:
  - la oferta trae `local` (moneda y tipo de cambio del día);
  - la web muestra "Precios en dólares; tu banco hace la conversión. Referencia: 1 USD ≈ 18,5 MXN" y, en el resumen del checkout, "≈ MXN 1.234".
- **Impuestos:** siguen la configuración del país (por ejemplo, el IVA incluido en México), calculados sobre el monto en dólares.

## 098 · Dos márgenes: creación e impresión

- **Fecha:** 2026-10-29 · Decisión de Sebastián: el costo del digital cambia con las páginas, así que se separan dos márgenes.
- **Creación**, en todos los productos: costo de IA (costo por página × páginas interiores del libro) + margen de creación. El libro largo cuesta más solo; se eliminan los ajustes manuales por extensión.
- **Impresión**, solo impresos: lo que cobra la imprenta elegida + margen de impresión. El envío sigue al costo.
- **Tipo de margen:** cada uno es fijo, porcentaje o porcentaje con mínimo, por producto (Admin → Precios y márgenes).
- **De fábrica:**
  - IA: USD 0,15 por página;
  - creación: USD 17 fijo;
  - impresión: 30 %, con un mínimo de USD 8.
- **Ejemplos:**
  - digital Mini (12 páginas): 1,80 + 17 = USD 18,99;
  - digital Clásico (28 páginas): 4,20 + 17 = USD 21,99;
  - tapa blanda Clásico a EE. UU. con Lulu (USD 5,83): 21,20 + 5,83 + 8 = USD 35,99, más el envío.
- **Por qué el margen de creación es fijo por defecto:** un porcentaje sobre un costo tan chico (USD 1 a 6) daría precios sin relación con el valor, y bajarían si la IA se abarata. Sobre la imprenta el porcentaje sí sirve, porque su costo varía mucho por formato y destino.
- **Pendiente:** ajustar el costo por página con el costo real de IA por libro (Resumen → costo de IA) cuando haya pedidos reales.

## 099 · Repositorio público mientras no haya ventas; producción con mínimo 0 y ping

- **Fecha:** 2026-10-29 · Decisión de Sebastián.
- **Por qué público:** se agotaron los 2.000 minutos gratis de GitHub Actions de un repositorio privado, y en uno público son gratis. Vuelve a privado con las primeras ventas o visitas.
- **Revisión previa:**
  - no hay claves en todo el historial: gitleaks en cada push más una búsqueda de patrones;
  - queda visible: el código, los prompts, los documentos de estrategia (reseñas públicas parafraseadas, sin datos personales), la infraestructura y el mail de alertas.
- **Protecciones para el modo público:**
  - el deploy de staging corre solo después del CI de un push a `main` de este mismo repositorio, nunca por un pull request ni por una copia;
  - Workload Identity solo entrega credenciales a `refs/heads/main` y a tags `v*`.
- **Producción:**
  - la API arranca con mínimo 0 instancias, más un Cloud Scheduler que llama a `/health` cada 10 minutos (`api_keep_warm`): unos USD 0,10 por mes, contra USD 8 a 10 de una instancia siempre encendida;
  - con tráfico real se pasa a `min = 1`;
  - costo fijo estimado sin ventas: unos USD 3 a 5 por mes.

## 100 · Producción en etapas

- **Fecha:** 2026-10-29 · Proyecto `storynido-prod` creado con `infra/scripts/bootstrap.sh` (misma cuenta de facturación que staging; presupuesto de USD 100 por mes con avisos).
- **Etapa 1:** toda la infraestructura (165 recursos) con la imagen de ejemplo en Cloud Run y `print_providers = ["mock"]`, para que ningún servicio lea un secreto todavía sin valor.
- **Etapa 2:** con los secretos cargados (Gelato, Cloudprinter, Lulu, Resend, enlace de bajas), imprentas reales y `email_provider = "resend"`.
- **Etapa 3:** el código real (tag `v*`). Necesita el procesador de pagos o un modo "pagos desactivados", porque la API se niega a arrancar en producción con proveedores simulados.
- **Dominios:** `api_domain` queda vacío hasta verificar `storynido.com` en Google. Después: `api.storynido.com` en Cloud Run, y `storynido.com`, `www` y `admin.` en App Hosting.

## 101 · Cumpleaños por tema, hero de Eventos y mejoras de la muestra

- **Fecha:** 2026-10-29 · Pedido de Sebastián: ampliar los temas de cumpleaños (para ellos, para ellas, superhéroes, científicos, con buena tendencia).
- **Colecciones de cumpleaños:** Fiestas mágicas, Superhéroes y heroínas, Ciencia y espacio, Fantasía y reinos, Animales y aventuras, Campeones.
- **Historias:** las aventuras de Familias que mejor funcionan en una fiesta (superhéroe, espacio, dinosaurios, selva, fondo del mar, reino encantado y fútbol) se ofrecen también en Eventos, sin costo de IA. Cada tema muestra sus tapas con enlace para empezar con esa historia.
- **Pendiente (con costo, a confirmar):** historias nuevas con portada propia para temas que faltan (científica o inventor, piratas, detectives, princesas y caballeros).
- **Muestra sin ilustraciones:** en lugar de páginas vacías se muestra la ilustración de ejemplo de la historia y del estilo, rotulada "Ejemplo del estilo · en tu libro, el protagonista será {nombre}". Además, una barra fija recuerda el paso pendiente y el botón para aprobar al personaje dice qué se obtiene.
- **Hero de Eventos y de la home:** la foto del chico y el libro más grandes; en Eventos, con el retrato "Su foto" y la flecha hacia el libro.

## 102 · Una landing completa por público, menú simple y arreglos de la revisión externa

- **Fecha:** 2026-10-29 · Decisión de Sebastián: simplificar con una landing por persona; el menú las enlaza y cada una termina con su propio "Crear". Se sumó una revisión externa de UX, de la que se verificó cada hallazgo antes de actuar.
- **Estructura:**
  - `/` es la puerta de entrada: hero y "¿Para quién es?" con tres tarjetas;
  - `/familias`, `/eventos` y `/profesionales` son landings completas (hero, cómo funciona, ejemplos, preguntas y su propio "Crear");
  - la landing de Familias es la home anterior.
- **Menú:** tres enlaces directos (Para familias, Para cumpleaños, Para profesionales), sin desplegables. El botón de crear del encabezado lleva al creador del público donde estás; en la home baja a "¿Para quién es?".
- **Hero:** foto del protagonista grande, sobre el libro. Aclara que se atiende en todo el mundo y que el envío del impreso se calcula según el país.
- **Hallazgos de la revisión que eran reales:**
  - **Países:** Brasil, España, Colombia, Chile y Perú quedaron inactivos desde el seed ("fase 3") y la lista de países activos era `[MX, US]`. Un visitante de Argentina veía precios de México y uno de Brasil, "no enviamos". Ahora todos los países se venden y salen de la lista solo los que el admin apaga; el seed los activa.
  - **Kit de Eventos:** la landing decía que las piezas "se suman muy pronto" cuando el kit digital ya se vende. Ahora cada pieza dice "Disponible hoy · PDF listo para imprimir", y la impresión profesional en cantidad figura "Por cotización".
  - **Profesionales:** pedía la cuenta antes de mostrar nada. Ahora el botón principal lleva a ejemplos por necesidad ("Empieza por lo que necesitas"), con las tapas de cada historia enlazadas a su ficha, y la cuenta se pide al crear.
- **Pendiente:** unificar las clasificaciones del catálogo (aventura, recuerdos, valores, emociones) en historia, temática y mensaje educativo; filtros por edad y búsqueda en "Explorar historias"; historias nuevas para cumpleaños (con costo, a confirmar).

## 103 · Marca v3, pregunta después de la muestra, dirección de arte y reglas narrativas

- **Fecha:** 2026-10-29 · Decisión de Sebastián: aplicar el tablero de marca nuevo y empezar por los puntos P0 de la auditoría (`AUDITORIA-PRODUCTO.md`) que no cuestan nada.
- **Marca v3** (reemplaza la v2): crema `#FFF8F1`, botón durazno `#FFB6A7` con texto navy `#26324A`, salvia, lavanda y coral tinta `#A33F33` para acentos de texto. Quicksand para la interfaz y los títulos, Lora para leer y Caveat para frases manuscritas. Detalle en `BRAND.md`.
- **"¿Qué mejorarías?"** después de la muestra: no se parece, datos incorrectos, ilustración, historia u otro. Se guarda como evento de calidad (`feedback_*`) sin datos del chico, y el panel muestra la tasa de "no se parece".
- **Dirección de arte:** un bloque fijo al final de cada prompt de imagen, con la paleta de la historia, el criterio por edad, el encuadre y lo que hay que evitar. Se guarda en la muestra y se copia al pedido congelado, así el libro pagado se ilustra con la misma dirección que la muestra. Las muestras anteriores siguen sin ella (no cambian a mitad de camino).
- **Reglas narrativas** en el prompt de texto: el protagonista decide y resuelve, gancho en la primera página, desafío real, momento visual memorable y final para releer. Eventos: misión con 2 o 3 mini desafíos. Profesionales: un objetivo, secuencia realista, validar emociones y nada de promesas clínicas.
- **Prueba antes/después** (`pnpm eval:prompts`, USD 2,15 en staging, acuarela, protagonista inventado, una historia por público):
  - **Imágenes:** la versión nueva tiene más color y profundidad, y más acción por escena.
  - **Texto:** mejora sobre todo en cumpleaños, que pasa de buscar pistas en casa a una misión con mini desafíos y la fiesta como premio. En Familias, el gancho y las decisiones del protagonista quedan más claros.
  - **Lo que se corrigió después de la prueba:**
    - la portada citaba el título y la IA lo escribió dentro de la imagen; ahora la escena de portada no menciona el título;
    - la ropa cambiaba entre imágenes; ahora la dirección de arte lo prohíbe;
    - en Profesionales los nervios "desaparecían"; ahora el cuento nombra lo que siente y muestra qué lo ayuda.

    Se repitió el caso del dentista y salió bien.

  - **Sigue abierto:** los personajes secundarios (por ejemplo, la mamá) cambian entre páginas, porque no tienen lámina (auditoría §1, punto 11). Además, la IA a veces pone palabras sueltas en los objetos.
- **Siguiente:** regenerar las portadas del catálogo con la dirección nueva.

## 104 · Descubrimiento por público, foto y correcciones guiadas

- **Fecha:** 2026-10-29 · Puntos de la auditoría sin costo (`AUDITORIA-PRODUCTO.md`).
- **"¿Qué le encanta?"** en Familias: cuatro temáticas simples (espacio y ciencia, animales y dinosaurios, magia, héroes y deporte) que llevan al catálogo filtrado. Se resuelven con las etiquetas de cada historia.
- **Catálogo:** filtro por temática y búsqueda por texto (sin tildes ni mayúsculas), además de edad y colección.
- **Profesionales:** las colecciones se nombran por necesidad concreta ("Prepararse para algo nuevo: dentista, primer día de clases", "Manejar la frustración y no rendirse"…).
- **"Qué hacemos con la foto"** en las tres landings, y en las preguntas frecuentes "Pagas una sola vez" y "nunca se usa para entrenar IA".
- **Correcciones guiadas del personaje:** primero "¿Qué no se parece?" (pelo, piel, ojos, anteojos u otra cosa), y solo se muestran esos rasgos. Lo corregido queda fijo en todas las páginas.
- **Links por público:** desde Eventos y Profesionales, la ficha de una historia recuerda el público. "Crear" abre el creador de esa línea, "Volver" regresa a la landing y Eventos no muestra los precios de los libros, porque el kit tiene los suyos. Antes llevaba al creador y al catálogo de Familias.
- **Staging:** la web y el admin no se deployan con el push (App Hosting sin repositorio conectado). Se suben con `firebase deploy --only apphosting`; ver RUNBOOK.

## 105 · Objetivos propios por historia y país de envío editable

- **Fecha:** 2026-10-29 · Segunda auditoría externa (`AUDITORIA-PRODUCTO.md` §7).
- **Objetivos:** las historias con un propósito (dentista, primer día, letras, emociones, frustración) tienen objetivos propios (`stories.objectives`, editables en el admin). La ficha los muestra en vez de las enseñanzas generales y el creador de Profesionales los ofrece como objetivo, en vez de todos los temas de la colección. Sin objetivos, todo sigue como antes.
- **"Enviar a"** en la ficha: cambia el país de envío y de precios (cookie `sn_country`) sin cuenta. El idioma es independiente.
- **Catálogo:** si un filtro de edad deja menos de 3 historias, se avisa con honestidad.

## 106 · Login con Google desde el dominio propio, "Celebraciones" y extensiones en la ficha

- **Fecha:** 2026-10-29.
- **Login con Google:** Chrome y Safari bloquean el almacenamiento entre dominios, y con `authDomain` en `firebaseapp.com` la sesión no volvía al sitio. Ahora `authDomain` es el dominio del sitio (`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`) y Next reenvía `/__/auth/*` a `<proyecto>.firebaseapp.com`.
  - **Requisitos:**
    - la URI `https://<dominio>/__/auth/handler` en el cliente OAuth;
    - `'self'` en el `frame-src` de la CSP, porque el iframe de login se sirve desde el propio dominio.
  - **Producción:** ver LAUNCH.
- **Menú:** "Para cumpleaños" pasa a "Para celebraciones" (es, en y pt), en el pie, la tarjeta de la home, la marca de la landing y el link de volver.
  - La ruta `/events` no cambia.
  - El contenido sigue hablando de cumpleaños, porque el kit pide la edad que cumple. Otras ocasiones (fin de año escolar, bautismos) se anuncian recién cuando el creador las soporte.
- **Ficha de historia:** "Elige la extensión" muestra cada extensión activa que admite la historia, con páginas, uso y formatos. No se muestra en la línea Eventos.
- **Verificación en dos pasos en el sitio:** las cuentas del equipo tienen TOTP (lo exige el admin), y Google devolvía `auth/multi-factor-auth-required` también en el sitio público. Ahora el panel de login pide el código de 6 dígitos, como el admin. Los clientes no tienen segundo factor, así que no lo ven.

## 107 · Tercera auditoría externa: enseñanzas por historia y promesas alineadas

- **Fecha:** 2026-10-29.
- **Enseñanzas sugeridas:** cada historia puede tener `suggestedLessons` (slugs, editables en el admin). La ficha muestra solo esas, en vez de todas las de la edad: el fútbol ya no ofrece "Cuidar la naturaleza". El creador las agrupa primero ("Encajan con esta historia") y el resto sigue disponible. Las historias con objetivos propios (Profesionales) no cambian.
- **"Si no te encanta, no lo pagas"** pasa a "Mira antes de comprar". Podía leerse como una garantía de satisfacción después de la compra, que la política de reembolsos no da para productos personalizados.
- **Profesionales:** el precio Pro y los descuentos se anuncian como futuros ("publicamos las condiciones cuando abramos las ventas"), no como una ventaja activa.
- **Ficha:** atajo "Hojear páginas de ejemplo" junto al título.
- **Ya resuelto antes de la auditoría:** objetivos propios del dentista, bloque de extensiones en todas las fichas y selector "Enviar a" (el país se detecta por IP; el revisor navegaba desde Brasil).
- **Pendiente, bloquea el lanzamiento:** razón social y domicilio del responsable en privacidad y términos.

## 108 · Precios a la vista y kit real en Celebraciones

- **Fecha:** 2026-10-29 · Puntos sin costo de las auditorías.
- **Landing de Celebraciones, "Tu kit incluye":** las piezas reales del kit (`KIT_PIECES`), con el precio del país (diseño con el mini cuento, más cada pieza) y el total del kit completo. Antes prometía un "mini libro para colorear" que no es una pieza del kit.
- **Fichas desde Celebraciones:** muestran el kit y sus precios, y el botón dice "Diseñar el kit con esta historia".
- **Home:** el botón principal es "Crear una vista previa gratis" (baja a "¿Para quién es?") y se suma "Explorar cuentos" (catálogo).
- **Creador y muestra:** cada extensión muestra el precio digital y, si se imprime, "impreso desde". La muestra terminada repite los precios antes de ir al pago. Es el mismo dato de la ficha; el monto final lo da el checkout. Eventos no los muestra, porque el kit tiene su precio.
- **Envíos:** "¿Llega a tu país?" con el selector de país: digital, impreso con su plazo, o que todavía no se vende.

## 109 · Historias 9–12, portadas nuevas, ejemplos por estilo y más ocasiones

- **Fecha:** 2026-10-29.
- **Para grandes lectores (9 a 12):** colección nueva con cuatro historias (misterio, ciencia, exploración y humor). Sin Mini ni libro para colorear, densidad media o alta y paleta `explorer` (azules de noche con luz de linterna). Portadas con la dirección de arte nueva (USD 0,27).
- **Portadas del catálogo:** las 14 anteriores, regeneradas con la dirección de arte nueva (paleta por historia, gouache digital, sin texto). Costo: USD 0,95.
- **Muestra:** cada estilo tiene un librito de ejemplo de 4 páginas, con el mismo chico y el mismo zorro (`public/styles/<estilo>/1-4.webp`). Las páginas sin ilustrar muestran una distinta cada una, en lugar de repetir la misma imagen. Costo: USD 1,36. El estilo Cartoon 3D no se ve 3D, ni en su muestra original ni en estas: hay que revisar su prompt.
- **Celebraciones:** el kit admite cumpleaños, bautismo, primera comunión y egreso o fin de año escolar (`event.type`).
  - Cada ocasión tiene su texto en el prompt del cuento y sus propias piezas: invitación, agradecimiento, etiquetas, actividades y licencia.
  - La edad que cumple solo se pide en el cumpleaños.
  - Lo religioso se trata con respeto y sin rituales ni doctrina.
- **CI:** estuvo fallando por formato (Prettier) desde el commit 9a1d8f8, y la API de staging no se deployaba. Ya está corregido.

## 110 · Auditoría UX del área logueada: Mis cuentos, login robusto y arreglos rápidos

- **Fecha:** 2026-10-29 · Auditoría "Auditoría UX StoryNido — áreas logueadas y flujos" (Claude Docs).
- **Panel Pro con claves sin traducir:** el namespace `Pro` no viajaba al navegador. Se agregó, y `client-namespaces.test.ts` falla si un componente de cliente usa un namespace que no está en `CLIENT_NAMESPACES`.
- **Mis cuentos** (`/mis-cuentos`) es la home de quien tiene sesión:
  - "Sigue donde lo dejaste" y los borradores, con la etiqueta de su línea y un filtro por línea si usó más de una;
  - el panel Pro, los pedidos y "¿Qué quieres crear?", con las tres líneas;
  - el menú del avatar lleva a Mis cuentos y a Ajustes; ya no hay links a `#drafts`.
- **Mi cuenta** queda solo para ajustes. El rol y la verificación de la API los ve solo el equipo, y el nombre se muestra solo si existe.
- **Login:**
  - después de entrar se vuelve a la página de origen (`?next=` o la ruta guardada); si no hay, a Mis cuentos;
  - en navegadores integrados (Instagram, Facebook, WhatsApp, TikTok…) o si el popup se bloquea, se entra por redirección (`signInWithRedirect`, con el `authDomain` propio). El panel completa la redirección, incluido el segundo factor.
- **Borradores:** entrar desde una ficha (`?story=`) reutiliza el borrador vacío de esa línea en lugar de crear otro. Ya se reutilizaba sin historia; los 3 del auditor eran uno por línea y se borraron de staging.
- **Creador:**
  - etiqueta de la línea arriba ("Kit para una celebración", "Proyecto profesional");
  - el error del nombre aparece junto al campo, que recibe el foco;
  - los ejemplos llevan "Ej.:";
  - Profesionales tiene su propio ejemplo de dedicatoria;
  - en Celebraciones, si no se elige la edad que cumple, se usa la del protagonista;
  - las etapas no alcanzadas se ven deshabilitadas.
- **Landings:**
  - "Nuevo proyecto profesional" con sesión iniciada;
  - "Precios en dólares (USD)" en el kit;
  - "inicias sesión con Google, Apple o tu correo".
- **Pendiente de esa auditoría:**
  - vista previa antes en el creador (fase 4, grande);
  - temáticas y colecciones clicables con preselección;
  - selector de país con búsqueda;
  - pasada mobile completa;
  - eventos `login_*` por navegador.

## 111 · Auditoría UX (ChatGPT): el creador nunca queda cargando

- **Fecha:** 2026-10-29 · `AUDITORIA_UX_STORYNIDO_STAGING.md`.
- **"Preparando tu cuento…" para siempre:** con un usuario nuevo, en staging, las tres entradas (`/crear`, `?line=events`, `?story=…`) abrían el creador bien. No se pudo reproducir la sesión del auditor, pero si fallaba leer o crear el borrador (red cortada, permisos, un perfil borrado), la pantalla esperaba sin fin. Ahora:
  - un perfil ilegible no traba la lista de borradores;
  - después de 20 s o ante un error, se muestra un aviso con "Reintentar", que recarga la página con una conexión nueva;
  - Mis cuentos avisa si no pudo cargar la lista.

  Lo cubre una prueba E2E que corta Firestore.

- **Sesión al cargar:** el encabezado muestra un lugar vacío mientras lee la sesión, en vez de "Iniciar sesión", que después cambiaba al avatar.
- **Catálogo:** con búsqueda o filtros, muestra cuántas historias quedaron. El estado vacío ya existía.
- **Ya resuelto en DECISIONS 110:** Mis cuentos, las claves Pro sin traducir y los links a `#drafts`.
- **Pedidos que "variaron entre cargas":** fue el borrado de los datos de prueba de la cuenta, hecho durante la auditoría.
- **País inicial Estados Unidos:** el país sale de la IP. El navegador del auditor no salía por Argentina. Se puede cambiar con "Enviar a" y en Mi cuenta.

## 112 · Ley 18.331, historial limpio y descuento por volumen para Profesionales

- **Fecha:** 2026-10-29.
- **Privacidad:** con el responsable en Uruguay, la política nombra la Ley 18.331 de Protección de Datos Personales entre las leyes que se respetan (es, en y pt). Publicado en staging.
- **Historial de git:** se sacaron de todos los commits los tres scripts temporales que se habían subido por error (`firebase/src/zz-*`, con el email y el uid de staging del dueño). Los ignora `.gitignore`.
- **Nuevo flujo de creación (plan aprobado):** Profesionales no tiene suscripción ni packs. El cierre muestra el precio con el descuento por volumen que ya existe y cuánto falta para el próximo nivel. Después del pago se sigue en la página del pedido (generación en vivo y descargas), con un acceso a Mis cuentos, que también muestra el pedido en vivo.

## 113 · Nuevo flujo de creación, PR 1: pasos por línea y paso guardado por nombre

- **Fecha:** 2026-10-29 · Plan del nuevo flujo aprobado (selector de línea, arranque propio, núcleo compartido, cierre propio).
- **`FLOWS`** (`apps/web/src/components/wizard/steps.ts`): los pasos de cada línea, en orden. Es una config declarativa con un solo asistente, y reemplaza a `hiddenSteps`.
- **`books.wizardStepKey`:** el paso alcanzado se guarda por nombre. Reordenar o quitar pasos no rompe borradores.
  - Los anteriores se migran solos al abrirse: el índice viejo (`wizardStep`) se traduce a su paso, y un paso que la línea ya no tiene cuenta como el anterior que sí está.
  - `wizardStep` se sigue escribiendo por compatibilidad.
  - El borrador nuevo no lo escribe al crearse (la regla de alta no cambia, así la web anterior sigue funcionando). Lo guarda al avanzar.
- **Reglas de Firestore:** `wizardStepKey` es editable y solo acepta pasos que existen.

## 114 · Nuevo flujo, PR 2: el borrador se crea al primer guardado

- **Fecha:** 2026-10-29.
- **`/crear`** abre el creador con un borrador en memoria (`unsavedDraft`): abrir la ruta ya no escribe nada en Firestore. En el primer guardado real (el paso del protagonista), `nav.ensureBook()` crea el documento y la URL pasa a `/crear/<id>`. Desde ahí sigue en vivo como antes. Se siguen reutilizando los borradores vacíos anteriores.
- **El catálogo del creador** se carga en el servidor también en `/crear` (`loadWizardCatalog`, compartido con `/crear/[id]`).
- **Esqueleto de carga** con la forma del asistente, en lugar del texto suelto "Preparando tu cuento…". El texto queda para lectores de pantalla.
- **Accesibilidad:** el atajo "Hojear páginas de ejemplo" de la ficha tiene un área táctil de 44 px.

## 115 · Nuevo flujo, PR 3: /nuevo y consentimiento de fotos vencido

- **Fecha:** 2026-10-30.
- **`/nuevo`** (`/new`, `/novo`): "¿Qué quieres crear?", con las tres líneas (`NewChoice`, compartido con Mis cuentos). No cuenta como paso.
  - `/crear` lo saltea si la línea se conoce: viene en la URL (`?line=`), viene de una landing en esta sesión, eligió una historia (Familia) o tiene borradores en una sola línea.
- **Encabezado:** fuera de una landing, "Crear mi cuento" lleva a `/nuevo`; en Familias, Celebraciones y Profesionales, al creador de esa línea.
- **Creador:** antes del primer guardado, "Cambiar" junto a la etiqueta de línea vuelve a `/nuevo`.
- **Fotos:** si el consentimiento guardado en la sesión ya no existe en el servidor (se borró o cambió de versión), la API responde 403. Antes la web mostraba "No pudimos subir la foto" para siempre; ahora vuelve a pedir el consentimiento. Pasó en staging después de borrar los datos de prueba de la cuenta.
- **Fotos de cuentas profesionales:** la API exigía la autorización del tutor a toda foto de una cuenta profesional, incluso en un cuento de Familia para su propio hijo, y respondía 403. La web solo la pide en los libros de Profesionales. Ahora la API la exige según la línea del libro (`book.channel === 'professionals'`).

## 116 · Nuevo flujo, PR 4 y 5: modo foco y arranque propio por línea

- **Fecha:** 2026-10-30.
- **Modo foco** (`HeaderSwitch`): en `/crear`, `/nuevo` y el pago, el encabezado solo tiene "← Guardar y salir" (a Mis cuentos), el logo y "Ayuda" (preguntas frecuentes, en otra pestaña). Sin links de marketing. La etapa, la línea y el guardado los muestra el creador.
- **Orden por línea** (`FLOWS`):
  - **Familia y Profesionales:** Aventura (historia y enseñanza u objetivo) → Protagonista (datos y recuerdos) → Su personaje (foto o rasgos, y estilo) → Muestra.
  - **Celebraciones:** Protagonista (ocasión, fecha, temática y una sola edad) → Aventura → Su personaje → Muestra.
  - Las etapas se muestran en el orden del flujo (`stagesFor`).
- **Migración:** un borrador anterior da por hecho todo lo que venía antes en el orden histórico y retoma en el primer paso del flujo nuevo que le falta.
- **Cualquier paso puede ser el primero:** todos los guardados pasan por `nav.ensureBook()`, que crea el borrador si todavía está en memoria.
- **Profesionales:** sin dedicatoria.

## 117 · Nuevo flujo, PR 6 a 9, y lámina del acompañante

- **Fecha:** 2026-10-30.
- **PR 6, protagonista reutilizable:** en un borrador sin protagonista, "¿Para quién es este cuento?" ofrece los perfiles del usuario. Elegir uno completa sus datos y copia al libro su aspecto del último cuento: los rasgos elegidos, o sus fotos si siguen válidas (se borran a los 30 días). La lámina se vuelve a aprobar en la muestra, porque cambia con el estilo y la historia.
- **PR 7, vista previa antes:** con el orden nuevo, la muestra llega justo después del personaje (lámina, y al aprobarla, portada y primeras páginas).
- **PR 8, cierre propio:** el pago, ya en modo foco, es el cierre de cada línea. Familia elige el formato y Celebraciones las piezas y copias del kit. Profesionales ve el descuento por volumen aplicado y cuánto le falta para el próximo nivel.
- **PR 9, después del pago:** se sigue en la página del pedido (generación en vivo y descargas), con "Ver en Mis cuentos", que también muestra el pedido en vivo.
- **Lámina del acompañante:** el planificador marca al personaje secundario que se repite (abuela, mascota) con un aspecto fijo en inglés. Al aprobar al protagonista se genera su lámina una vez (unos USD 0,07, solo si hay acompañante), y es la segunda referencia de la portada, las páginas, las regeneraciones y el libro completo (el worker la congela con el pedido). Se borra con el borrador o la cuenta, como el resto de la muestra.

## 118 · Preguntas frecuentes por tema y formulario de contacto

- **Fecha:** 2026-10-30.
- **Preguntas frecuentes:** agrupadas por tema ("## " en el Markdown): cómo funciona, fotos y privacidad, precios y envíos, Celebraciones y Profesionales. Se suman ver antes de pagar, protagonista reutilizable, sin fotos, borrar datos, cuánto cuesta, envíos por país, problemas con el libro (como dice la política de reembolsos), el kit y sus ocasiones, y Profesionales con descuento por volumen. Familias y la home las muestran igual.
- **Formulario de contacto** al final de la home (`#contact`). `POST /v1/contact`:
  - el mensaje queda en `contactMessages` y llega al equipo (`ADMIN_ALERT_EMAILS`) con la plantilla `contact_message`, y "Responder" contesta a quien escribió (`replyTo`);
  - nunca se manda nada a la dirección que carga la persona, así el formulario no sirve para spam;
  - un campo oculto descarta bots y hay un tope de 5 mensajes por conexión y por día (huella de la IP, sin guardar la IP).
- **El mail del equipo ya no está a la vista** en la home, Familias, el pie, envíos ni reembolsos: todo lleva al formulario. Queda en la política de privacidad y en los términos, donde la ley pide identificar al responsable con un medio de contacto.

## 119 · Preguntas frecuentes en su propia página

- **Fecha:** 2026-10-30.
- **`/preguntas-frecuentes`** (`/faq`, `/perguntas-frequentes`): todas las preguntas por tema y, al final, el formulario de contacto. Tiene los datos FAQPage para buscadores y está en el sitemap.
- **La home y Familias** muestran 4 destacadas (la primera de cada tema) y "Ver todas las preguntas". Así la landing no se alarga.
- **"Ayuda" del creador, el pie, "¿Otra duda?", envíos y reembolsos** llevan a esa página o a su formulario.

## 120 · Login en navegadores integrados, pasada en celular y temas que se pueden tocar

- **Fecha:** 2026-10-30.
- **Login en apps:** verificado en staging con los navegadores integrados de Instagram, Facebook y WhatsApp (user agent simulado): entran por redirección y llegan a Google sin error. Chrome sigue con el popup. La vuelta al sitio necesita una cuenta real.
- **Pasada en celular (390 px):** 13 páginas públicas sin scroll horizontal. Se corrigió:
  - **Ficha de historia:** abría desplazada hasta el visor, porque `scrollIntoView` de la miniatura movía toda la página. Ahora solo se desplaza la tira.
  - **Links de volver y del pie:** pasan a 44 px de área táctil.
  - **`/nuevo`:** el encabezado dice "Volver" en lugar de "Guardar y salir".
- **Temas y colecciones:**
  - cada tema de Celebraciones tiene "Diseñar el kit con este tema", que abre el creador con la temática de la fiesta cargada (`/crear?line=events&tema=…`);
  - cada colección de Profesionales tiene "Crear con esta colección", que abre el creador con su primera historia elegida.

## 121 · Selector de país, login medido por navegador y Cartoon 3D

- **Fecha:** 2026-10-30.
- **Selector de país** (`CountryOptions`), en "Enviar a", el pago, Mi cuenta y la activación Pro: arriba el país actual y los mercados principales (Argentina, México, Estados Unidos, España, Chile, Colombia, Uruguay, Perú y Brasil), después los 250 en orden alfabético. Es un select nativo: escribir salta al país.
- **Login por navegador:** en el login no corre Google Analytics, así que se cuenta en el servidor.
  - `POST /v1/events/login` suma contadores diarios (`loginMetrics/{día}`) por navegador (en apps o común), método (Google, Apple o enlace por mail), vía (popup, redirección o enlace) y etapa (empezó, entró o falló). No guarda datos de la persona.
  - El paso del segundo factor no cuenta como falla.
  - El panel del admin muestra "Login por navegador" con la tasa de éxito.
- **Cartoon 3D:** no se veía 3D porque la dirección de arte imponía "gouache pintado a mano con textura de papel" a todos los estilos y además pedía evitar "3D genérico brillante". Ahora la técnica sigue al estilo (`artDirection({ style })`): 3D de película animada para Cartoon 3D, lápices para Lápices de colores, tinta y gouache para Cuento clásico y gouache para el resto. Su `promptModifier` se reforzó (actualizado en staging). Las muestras del estilo se regeneran aparte.

## 122 · Idioma automático por IP que no se pisa solo

- **Fecha:** 2026-10-30.
- **Problema:** next-intl guardaba la cookie de idioma (`sn_locale`, un año) al visitar cualquier página con idioma en la URL. Bastaba abrir una vez un link en inglés para que `/` mandara siempre a inglés, sin mirar la IP.
- **Ahora:**
  - sin cookie automática (`localeCookie: false`);
  - solo se recuerda el idioma elegido a mano (`sn_lang`): en el pie, en Mi cuenta, el guardado en la cuenta o el aviso de idioma;
  - sin elección, `/` va al idioma del país de la IP (Argentina → español, Brasil → portugués, el resto → inglés) y, si no se sabe, al del navegador.
  - La cookie vieja `sn_locale` ya no se lee.
- **Aviso de idioma:** quien entra por un link en otro idioma que el de su país ve "Este sitio también está en español → Ver en español", escrito en el idioma sugerido. Elegir o cerrar queda recordado. No aparece en el creador ni en el pago.
- **Copy:** "We serve families worldwide" → "Available worldwide" (es: "Disponible en todo el mundo"), para que no se lea solo como un servicio para familias.

## 123 · Sin "Hojear un ejemplo" en las fichas

- **Fecha:** 2026-10-30.
- La sección "Hojear un ejemplo" de la ficha de cada historia se quita, con su atajo junto al título y su componente. Mostraba portada, dedicatoria, un fragmento y páginas vacías: parecía un libro de 4 páginas y terminaba la ficha sin una acción.
- La ficha termina en sus formatos y precios y en "Crear con esta historia". Los ejemplos ilustrados completos (libros de muestra por historia) pueden volver cuando existan.

## 124 · País de envío: detectado por IP en cada visita, elegido a mano si el usuario lo elige

- **Fecha:** 2026-10-30.
- **Problema:** el país detectado se guardaba en una cookie de un año. Si la primera visita lo detectaba mal (sin IP útil, o por el idioma del navegador), se quedaba fijo aunque después la IP dijera otro país: el auditor veía Estados Unidos desde Argentina.
- **Ahora, dos cookies:**
  - `sn_country`: el país detectado (IP, o idioma del navegador si no hay IP). Vive un día y el proxy lo vuelve a calcular; un valor viejo se corrige solo.
  - `sn_country_choice`: el país elegido a mano ("Enviar a", Mi cuenta o el país guardado en la cuenta). Dura un año y manda sobre la IP.
- El servidor decide el país de la request con la elegida y, si no hay, con la IP de esa request (no con la cookie detectada).
- Quien había elegido un país con el selector anterior lo vuelve a elegir una vez.

## 124 · País detectado por IP que se corrige solo

- **Fecha:** 2026-10-30.
- **Problema:** el proxy guardaba el país detectado en `sn_country` por un año. Un país mal detectado (VPN, viaje, IP vieja) quedaba pegado y se confundía con una elección del visitante.
- **Ahora, dos cookies:**
  - `sn_country`: país detectado por la IP; dura un día y el proxy lo recalcula (solo la reescribe si cambió);
  - `sn_country_choice`: país elegido a mano ("Enviar a", Mi cuenta o el guardado en la cuenta); dura un año y manda sobre la IP.
- Con país elegido el proxy no detecta nada. Sin elección, `preferredCountry` usa la IP de la request.
- El aviso de idioma mira primero la elección y después el país detectado.
- Los E2E que fijaban el país con `sn_country` usan `sn_country_choice`.

## 125 · Hero de la home: textos nuevos, mismo look ilustrado

- **Fecha:** 2026-10-30.
- Se mantiene el hero ilustrado (libro abierto, "Su foto" ilustrada y flecha a mano; nunca una foto real). Se adoptan del brief de heroes solo los textos: "De su foto a su libro", el párrafo nuevo, "Crear vista previa gratis" y "Ver historias". Claves nuevas solo de la home (`homeKicker`, `homeLead`, `homeCta`); las demás landings no cambian.
- La fila de confianza muestra "Digital desde {precio}" tomado de la configuración de precios del país (`offerHighlights`), no un número fijo. Por eso la home pasa a leer el país del visitante.
- No se copia "Envío a todo el mundo": el impreso solo se envía a los países habilitados. Se mantiene "Disponible en todo el mundo" (digital) y "El envío del impreso se calcula según tu país".
- El botón principal sigue llevando al selector de público (#audience), no directo al creador.
- Pendiente del brief: Familias (sin la leyenda "Foto real de Martina"), Celebraciones y Profesionales.
