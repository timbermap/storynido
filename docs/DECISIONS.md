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
