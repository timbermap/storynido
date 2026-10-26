# StoryNido

Plataforma de cuentos infantiles personalizados con IA, en formato digital (PDF) e impreso bajo demanda. Dominio: [storynido.com](https://storynido.com). El nombre y el dominio son configurables (`BRAND_NAME`, `BRAND_DOMAIN` y sus variantes `NEXT_PUBLIC_*`).

Contexto completo del proyecto: [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) · Decisiones: [docs/DECISIONS.md](docs/DECISIONS.md) · Progreso: [docs/PROGRESS.md](docs/PROGRESS.md)

## Estructura

| Ruta                 | Qué es                                                                                                    | Puerto local |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ------------ |
| `apps/web`           | Sitio público (Next.js)                                                                                   | 3000         |
| `apps/admin`         | Panel super admin (Next.js)                                                                               | 3001         |
| `services/api`       | API HTTP (Fastify en Cloud Run): ver [services/api/README.md](services/api/README.md). Swagger en `/docs` | 8080         |
| `services/worker`    | Worker del pipeline (Fastify en Cloud Run)                                                                | 8081         |
| `packages/shared`    | Tipos, esquemas Zod (modelo de datos) y utilidades compartidas                                            | —            |
| `packages/providers` | Proveedores (IA, pagos, imprenta, mails, storage): mocks, registro y tests de contrato                    | —            |
| `firebase/`          | Reglas, índices, emuladores, seed y roles: ver [firebase/README.md](firebase/README.md)                   | UI 4000      |
| `infra/`             | Terraform (Google Cloud)                                                                                  | —            |

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- pnpm 11 (`npm install -g pnpm@11.22.0`)
- Java 21 para los emuladores de Firebase (`brew install openjdk@21`)
- Docker (opcional, para construir las imágenes de los servicios)

## Instalación

```bash
pnpm install
cp .env.example .env.local   # un solo archivo de claves para todo el monorepo
pnpm emulators               # terminal 1: emuladores de Firebase (requiere Java 21: brew install openjdk@21)
pnpm seed                    # terminal 2, una vez: usuarios y configuración de prueba
pnpm dev                     # terminal 2: web, admin, api y worker
```

Login local: http://localhost:3000/login con `cliente@storynido.test` (enlace mágico: el link aparece en la terminal de los emuladores y en http://127.0.0.1:4000/auth).

## Comandos

| Comando                             | Qué hace                                            |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm dev`                          | Levanta web, admin, api y worker en modo desarrollo |
| `pnpm emulators` / `pnpm seed`      | Emuladores de Firebase y datos de prueba            |
| `pnpm build`                        | Compila todo                                        |
| `pnpm lint`                         | ESLint (falla con cualquier warning)                |
| `pnpm typecheck`                    | Verificación de tipos                               |
| `pnpm test`                         | Tests con Vitest                                    |
| `pnpm format` / `pnpm format:check` | Prettier                                            |

Para trabajar sobre un solo paquete: `pnpm --filter @storynido/web dev`.

## Claves y variables de entorno

- **Local:** un único archivo `.env.local` en la raíz del repo, que leen todas las apps (vía `@next/env`) y servicios (vía `--env-file`). Está en `.gitignore` y nunca se sube.
- **Plantilla:** [`.env.example`](.env.example) lista todas las variables, por plataforma y fase, y marca con `[SECRETO]` las que son claves.
- **Staging / producción:** no hay archivos `.env`. Los secretos viven en Google Secret Manager y se inyectan como variables de entorno en Cloud Run y Firebase App Hosting (fase 02).
- **`NEXT_PUBLIC_*`** llega al navegador: nunca pongas un secreto en una variable con ese prefijo.
- **Proveedores en `mock`** (valor por defecto): todo funciona en local sin ninguna clave.
- **CI:** gitleaks revisa todo el historial de git en cada push y falla si encuentra una clave.

Si una clave se sube por error: rotala de inmediato en la plataforma (Stripe, Gelato, etc.); borrarla del repo no alcanza.

## Imágenes Docker

Desde la raíz del repo:

```bash
docker build -f services/api/Dockerfile -t storynido-api .
docker build -f services/worker/Dockerfile -t storynido-worker .
```

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre formato, lint, tipos, tests y build en cada PR y push a `main`, y construye las imágenes Docker. También valida Terraform (`fmt`, `validate`, `tflint`) y busca claves filtradas con gitleaks.

## Infraestructura y deploy

Terraform para Google Cloud en [infra/](infra/README.md). Staging se despliega solo cuando el CI de `main` pasa; production, al publicar un tag `v*`. Guía completa: [docs/SETUP.md](docs/SETUP.md).
