# Progreso

| #   | Fase                                                 | Estado                           |
| --- | ---------------------------------------------------- | -------------------------------- |
| 01  | Monorepo base, paquete compartido, lint, tests y CI  | ✅ Hecha (2026-10-26)            |
| 02  | Infraestructura con Terraform y ambientes            | ✅ Staging aplicado (2026-10-26) |
| 03  | Autenticación, roles y modelo de datos               | ✅ Hecha (2026-10-26)            |
| 04  | API base y abstracciones de proveedores              | ✅ Hecha (2026-10-26)            |
| 05  | Sitio público                                        | ✅ Hecha (2026-10-26)            |
| 06  | Creador del libro y fotos                            | ✅ Hecha (2026-10-26)            |
| 07  | Motor de IA y vista previa                           | ✅ Hecha (2026-10-27)            |
| 07b | Opciones editoriales (extensión, texto, nivel, tipo) | ⏳ Pendiente                     |
| 07c | Líneas comerciales y landings                        | ⏳ Pendiente                     |
| 08  | Pipeline: orquestación y worker                      | ⏳ Pendiente                     |
| 09  | Generación del libro y QA                            | ⏳ Pendiente                     |
| 10  | PDF                                                  | ⏳ Pendiente                     |
| 11  | Pagos con Stripe                                     | ⏳ Pendiente                     |
| 12  | Gelato y "Mi cuenta"                                 | ⏳ Pendiente                     |
| 12b | Eventos (un diseño, muchas copias)                   | ⏳ Pendiente                     |
| 12c | Profesionales (cuenta Pro, descuentos)               | ⏳ Pendiente                     |
| 13  | Emails y postventa                                   | ⏳ Pendiente                     |
| 14  | Admin: configuración                                 | ⏳ Pendiente                     |
| 15  | Admin: operaciones                                   | ⏳ Pendiente                     |
| 16  | Observabilidad y seguridad                           | ⏳ Pendiente                     |
| 17  | E2E y rendimiento                                    | ⏳ Pendiente                     |
| 18  | Documentación y salida                               | ⏳ Pendiente                     |

## Estrategia comercial

- 2026-10-27: alcance ampliado a 3 líneas (Familias, Eventos, Profesionales) y opciones editoriales; ver `docs/estrategia/LINEAS-COMERCIALES.md`, DECISIONS 059 y gap analysis §10.

- 2026-10-26: se incorporó la estrategia comercial (`PROMPT-MAESTRO-PARA-CLAUDE.md` y documentos asociados). Diagnóstico y orden de trabajo en [`STORYNIDO-GAP-ANALYSIS.md`](STORYNIDO-GAP-ANALYSIS.md).
- Hecho: analítica aislada del creador, la cuenta y el acceso (P0); vista previa con los ajustes de la estrategia (1 regeneración gratis, "Muestra de la historia", qué cambia en el libro final).

## Fuera de alcance / pendientes detectados

- Repo en GitHub: [timbermap/storynido](https://github.com/timbermap/storynido) (privado). CI y build de imágenes Docker en verde desde el 2026-10-26.

- Fase 02: **staging aplicado** en el proyecto `storynido-staging` (organización timbermap.com, facturación Forestech Uruguay SRL). **Production** (`storynido-prod`) se crea más cerca del lanzamiento.
- Staging: deploys automáticos activos (api y worker desplegados desde GitHub Actions el 2026-10-26). Pendiente: backends de App Hosting (web/admin) y dominios.

- Fase 07: modelo elegido con `pnpm eval:character` (DECISIONS 055 y 057). Proveedores alternativos (Claude para texto, Flux para imágenes): interfaz y registro listos, implementación pendiente.
- Fase 05: textos legales base para revisar con asesoría legal; portadas de muestra generadas con IA (niños inventados); testimonios ocultos hasta tener reseñas reales; el sitio público todavía no está publicado en App Hosting (staging).

## Riesgos

- Consistencia del personaje en las ilustraciones (fase 07).
- Entidad cobradora: Stripe no abre cuentas en Uruguay ni en Argentina; definir entidad y procesador (fase 11, ver gap analysis).
