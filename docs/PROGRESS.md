# Progreso

| #   | Fase                                                 | Estado                                |
| --- | ---------------------------------------------------- | ------------------------------------- |
| 01  | Monorepo base, paquete compartido, lint, tests y CI  | ✅ Hecha (2026-10-26)                 |
| 02  | Infraestructura con Terraform y ambientes            | ✅ Staging aplicado (2026-10-26)      |
| 03  | Autenticación, roles y modelo de datos               | ✅ Hecha (2026-10-26)                 |
| 04  | API base y abstracciones de proveedores              | ✅ Hecha (2026-10-26)                 |
| 05  | Sitio público                                        | ✅ Hecha (2026-10-26)                 |
| 06  | Creador del libro y fotos                            | ✅ Hecha (2026-10-26)                 |
| 07  | Motor de IA y vista previa                           | ✅ Hecha (2026-10-27)                 |
| 07b | Opciones editoriales (extensión, texto, nivel, tipo) | ✅ Hecha (2026-10-27)                 |
| 07c | Líneas comerciales y landings                        | ✅ Hecha (2026-10-27)                 |
| 07d | Aprobación del personaje y P0 de calidad (feedback)  | ✅ 2026-10-27                         |
| 08  | Pipeline: orquestación y worker                      | ✅ 2026-10-27 (infra sin aplicar)     |
| 09  | Generación del libro y QA                            | ✅ 2026-10-27 (falta la prueba real)  |
| 10  | PDF                                                  | ✅ 2026-10-27                         |
| 11  | Pagos (procesador por definir)                       | ✅ 2026-10-27 (con pagos simulados)   |
| 12  | Gelato y "Mi cuenta"                                 | ✅ 2026-10-27 (con imprenta simulada) |
| 12b | Eventos (un diseño, muchas copias)                   | ⏳ Pendiente                          |
| 12c | Profesionales (cuenta Pro, descuentos)               | ⏳ Pendiente                          |
| 13  | Emails y postventa                                   | ⏳ Pendiente                          |
| 14  | Admin: configuración                                 | ⏳ Pendiente                          |
| 15  | Admin: operaciones                                   | ⏳ Pendiente                          |
| 16  | Observabilidad y seguridad                           | ⏳ Pendiente                          |
| 17  | E2E y rendimiento                                    | ⏳ Pendiente                          |
| 18  | Documentación y salida                               | ⏳ Pendiente                          |

## Estrategia comercial

- 2026-10-27: alcance ampliado a 3 líneas (Familias, Eventos, Profesionales) y opciones editoriales; ver `docs/estrategia/LINEAS-COMERCIALES.md`, DECISIONS 059 y gap analysis §10.

- 2026-10-26: se incorporó la estrategia comercial (`PROMPT-MAESTRO-PARA-CLAUDE.md` y documentos asociados). Diagnóstico y orden de trabajo en [`STORYNIDO-GAP-ANALYSIS.md`](STORYNIDO-GAP-ANALYSIS.md).
- Hecho: analítica aislada del creador, la cuenta y el acceso (P0); vista previa con los ajustes de la estrategia (1 regeneración gratis, "Muestra de la historia", qué cambia en el libro final).

## Fuera de alcance / pendientes detectados

- **Maquetación del libro (feedback de Sebastián sobre el PDF, 2026-10-27):** hecho (DECISIONS 073).
- **Navbar con sesión iniciada:** hecho (menú con iniciales). Falta la marca de cuenta Pro en Profesionales.
- **Gelato real (fase 12):** falta cargar la clave (`GELATO_API_KEY` en `.env.local` y `gelato-api-key` en Secret Manager) e implementar su `PrintProvider` en sandbox (DECISIONS 074).
- **Mi cuenta:** las filas "Rol" y "API" son de diagnóstico; ocultarlas a los clientes en la pasada de diseño.
- **Pedidos trabados (detectado en la fase 08):** si Workflows no arranca y Pub/Sub manda el evento a `dead-letter`, el pedido queda en `generating`. Hace falta un barrido periódico que reintente los eventos con `started: false` y avise por los pedidos sin avance (fase 15 o 16).
- **Hero y navbar (pedido de Sebastián, 2026-10-27):** rediseño con la referencia que mandó: titular grande con una palabra en lavanda, el libro abierto ilustrado con la "foto" del chico (ilustrada o sintética, nunca una foto real), CTA principal "Crear la vista previa gratis", enlace "Ver historias", línea "Digital en todo el mundo · Impreso en países seleccionados" y las 3 líneas como tarjetas debajo del hero. Navbar con menús por línea, búsqueda, "Iniciar sesión" y "Crear un cuento".
- **UX a mejorar (pedido de Sebastián, 2026-10-27):** el diseño y la experiencia del encabezado (navbar), las preguntas frecuentes y el pie de página no convencen. Hace falta una pasada de diseño dedicada:
  - jerarquía y agrupación del menú (3 líneas + Historias + Blog + idioma + país + sesión);
  - menú móvil;
  - preguntas frecuentes más fáciles de recorrer;
  - pie con más estructura.
    Sin fase asignada todavía; propuesta: una fase corta de diseño antes de la 17 o junto con ella.
- Fase 07d: ejemplos de libros completos generados con IA (~USD 7) quedan para cuando el producto esté terminado. Mientras tanto, la ficha de cada historia tiene "Hojear un ejemplo" con la portada y el fragmento, sin costo.

- Repo en GitHub: [timbermap/storynido](https://github.com/timbermap/storynido) (privado). CI y build de imágenes Docker en verde desde el 2026-10-26.

- Fase 02: **staging aplicado** en el proyecto `storynido-staging` (organización timbermap.com, facturación Forestech Uruguay SRL). **Production** (`storynido-prod`) se crea más cerca del lanzamiento.
- Staging: deploys automáticos activos (api y worker desplegados desde GitHub Actions el 2026-10-26). Pendiente: backends de App Hosting (web/admin) y dominios.

- Fase 07: modelo elegido con `pnpm eval:character` (DECISIONS 055 y 057). Proveedores alternativos (Claude para texto, Flux para imágenes): interfaz y registro listos, implementación pendiente.
- Fase 05: textos legales base para revisar con asesoría legal; portadas de muestra generadas con IA (niños inventados); testimonios ocultos hasta tener reseñas reales; el sitio público todavía no está publicado en App Hosting (staging).

## Riesgos

- Consistencia del personaje en las ilustraciones (fase 07).
- Entidad cobradora: Stripe no abre cuentas en Uruguay ni en Argentina; definir entidad y procesador (fase 11, ver gap analysis).
