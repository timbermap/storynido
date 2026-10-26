# StoryNido

Plataforma de cuentos infantiles personalizados con IA, en formato digital (PDF) e impreso bajo demanda. Dominio: [storynido.com](https://storynido.com). El nombre y el dominio son configurables (`BRAND_NAME`, `BRAND_DOMAIN` y sus variantes `NEXT_PUBLIC_*`).

Contexto completo del proyecto: [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) · Decisiones: [docs/DECISIONS.md](docs/DECISIONS.md) · Progreso: [docs/PROGRESS.md](docs/PROGRESS.md)

## Estructura

| Ruta              | Qué es                                       | Puerto local |
| ----------------- | -------------------------------------------- | ------------ |
| `apps/web`        | Sitio público (Next.js)                      | 3000         |
| `apps/admin`      | Panel super admin (Next.js)                  | 3001         |
| `services/api`    | API HTTP (Fastify en Cloud Run)              | 8080         |
| `services/worker` | Worker del pipeline (Fastify en Cloud Run)   | 8081         |
| `packages/shared` | Tipos, esquemas Zod y utilidades compartidas | —            |
| `infra/`          | Terraform (Google Cloud)                     | —            |

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- pnpm 11 (`npm install -g pnpm@11.22.0`)
- Docker (opcional, para construir las imágenes de los servicios)

## Instalación

```bash
pnpm install
# Variables de entorno locales (opcionales por ahora):
for d in apps/web apps/admin services/api services/worker; do cp -n $d/.env.example $d/.env.local; done
```

## Comandos

| Comando                             | Qué hace                                            |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm dev`                          | Levanta web, admin, api y worker en modo desarrollo |
| `pnpm build`                        | Compila todo                                        |
| `pnpm lint`                         | ESLint (falla con cualquier warning)                |
| `pnpm typecheck`                    | Verificación de tipos                               |
| `pnpm test`                         | Tests con Vitest                                    |
| `pnpm format` / `pnpm format:check` | Prettier                                            |

Para trabajar sobre un solo paquete: `pnpm --filter @storynido/web dev`.

## Variables de entorno

| Variable                 | Dónde       | Descripción        | Default     |
| ------------------------ | ----------- | ------------------ | ----------- |
| `NEXT_PUBLIC_BRAND_NAME` | web, admin  | Nombre de la marca | `StoryNido` |
| `PORT`                   | api, worker | Puerto HTTP        | 8080 / 8081 |
| `LOG_LEVEL`              | api, worker | `trace`…`fatal`    | `info`      |

Nunca subas archivos `.env.local` ni claves: en producción los secretos van en Secret Manager.

## Imágenes Docker

Desde la raíz del repo:

```bash
docker build -f services/api/Dockerfile -t storynido-api .
docker build -f services/worker/Dockerfile -t storynido-worker .
```

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre formato, lint, tipos, tests y build en cada PR y push a `main`, y construye las imágenes Docker. El deploy se agrega en la fase 02.
