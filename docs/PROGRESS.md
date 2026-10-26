# Progreso

| #   | Fase                                                | Estado                |
| --- | --------------------------------------------------- | --------------------- |
| 01  | Monorepo base, paquete compartido, lint, tests y CI | ✅ Hecha (2026-10-26) |
| 02  | Infraestructura con Terraform y ambientes           | ⏳ Pendiente          |
| 03  | Autenticación, roles y modelo de datos              | ⏳ Pendiente          |
| 04  | API base y abstracciones de proveedores             | ⏳ Pendiente          |
| 05  | Sitio público                                       | ⏳ Pendiente          |
| 06  | Creador del libro y fotos                           | ⏳ Pendiente          |
| 07  | Motor de IA y vista previa                          | ⏳ Pendiente          |
| 08  | Pipeline: orquestación y worker                     | ⏳ Pendiente          |
| 09  | Generación del libro y QA                           | ⏳ Pendiente          |
| 10  | PDF                                                 | ⏳ Pendiente          |
| 11  | Pagos con Stripe                                    | ⏳ Pendiente          |
| 12  | Gelato y "Mi cuenta"                                | ⏳ Pendiente          |
| 13  | Emails y postventa                                  | ⏳ Pendiente          |
| 14  | Admin: configuración                                | ⏳ Pendiente          |
| 15  | Admin: operaciones                                  | ⏳ Pendiente          |
| 16  | Observabilidad y seguridad                          | ⏳ Pendiente          |
| 17  | E2E y rendimiento                                   | ⏳ Pendiente          |
| 18  | Documentación y salida                              | ⏳ Pendiente          |

## Fuera de alcance / pendientes detectados

- Repo en GitHub: [timbermap/storynido](https://github.com/timbermap/storynido) (privado). CI y build de imágenes Docker en verde desde el 2026-10-26.

- Fase 02: **staging aplicado** en el proyecto `storynido-staging` (organización timbermap.com, facturación Forestech Uruguay SRL). **Production** (`storynido-prod`) se crea más cerca del lanzamiento.
- Staging: deploys automáticos activos (api y worker desplegados desde GitHub Actions el 2026-10-26). Pendiente: backends de App Hosting (web/admin) y dominios.

## Riesgos

- Consistencia del personaje en las ilustraciones (fase 07).
- Disponibilidad de Stripe para una cuenta abierta desde Argentina (fase 11).
