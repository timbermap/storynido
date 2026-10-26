# StoryNido — Gap analysis: estrategia comercial vs. repositorio

**Fecha:** 2026-10-26 · **Base:** `main` en `1d5e5f1` + fase 07 (motor de IA y vista previa) en curso.
**Fuentes:** `PROMPT-MAESTRO-PARA-CLAUDE.md`, `ESTRATEGIA-COMERCIAL-STORYNIDO.md`, `PLAN-DE-IMPLEMENTACION.md` (v1.0, 26/10/2026).
**No disponibles en el repo todavía:** `docs/EVENTOS-Y-KPIS.md`, `config/commercial-config.example.json`, `branding/brand-tokens.json`. El branding aprobado ya está aplicado (ver `docs/BRAND.md`); eventos y KPIs se diseñan cuando llegue ese documento.

Estados: **EXISTE** · **PARCIAL** · **NO EXISTE** · **BLOQUEADO** (depende de un servicio externo o de una decisión de negocio).

## 1. Base técnica (se conserva)

| Pieza                                                                                                  | Estado    | Dónde                                     |
| ------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------- |
| Monorepo pnpm + Turborepo, TS estricto, CI (lint, typecheck, tests, gitleaks, terraform, docker)       | EXISTE    | `.github/workflows/`                      |
| Web Next.js 16 + next-intl (es, en, pt) con rutas traducidas                                           | EXISTE    | `apps/web`                                |
| País separado del idioma (cookie, geo, selector manual, aviso de país no disponible)                   | EXISTE    | `apps/web/src/lib/country.ts`, `proxy.ts` |
| API Fastify con contrato Zod compartido, errores únicos, rate limit, App Check en producción           | EXISTE    | `services/api`, `packages/shared/src/api` |
| Firebase Auth (Google, Apple, enlace mágico), roles por custom claim, reglas estrictas con tests       | EXISTE    | `firebase/`                               |
| Proveedores intercambiables con mocks y suites de contrato (IA, pagos, imprenta, mail, storage, fotos) | EXISTE    | `packages/providers`                      |
| Infra Terraform (Cloud Run, buckets, Pub/Sub, Workflows, WIF, budget, monitoring); staging aplicado    | EXISTE    | `infra/`                                  |
| Producción (proyecto, dominios, App Hosting)                                                           | NO EXISTE | pendiente, requiere aprobación            |

## 2. Experiencia comercial (Fase 1 de la estrategia)

| Requisito                                                               | Estado              | Detalle                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero con claim y CTA de vista previa                                    | EXISTE              | CTA dice "Crear una vista previa gratis"; la estrategia pide "Crear mi vista previa gratis" (cambio de copy).                                                                           |
| Ejemplo fiel del producto                                               | PARCIAL             | Portadas de muestra en acuarela, generadas con IA y con niños inventados. Falta rotularlas como "ejemplo" y no hay fotos de libro impreso (no existe todavía).                          |
| 3 colecciones curadas (Aventuras, Nuestros Recuerdos, Grandes Momentos) | NO EXISTE           | Hoy hay 7 aventuras sueltas más 16 enseñanzas combinables. Requiere decisión de mapeo (ver §8).                                                                                         |
| Selector de ocasiones                                                   | PARCIAL             | Los grupos de enseñanzas ("Momentos de la vida") cubren parte; no hay ocasiones como cumpleaños o abuelos.                                                                              |
| Precios por país en la home                                             | PARCIAL             | Muestra "desde" con precios de ejemplo del seed, no aprobados.                                                                                                                          |
| FAQ, garantía, sin testimonios inventados                               | EXISTE              | FAQ desde Firestore; no hay reseñas ni sellos falsos.                                                                                                                                   |
| Wizard sin login obligatorio al inicio                                  | EXISTE (2026-10-26) | Sesión anónima de Firebase; la cuenta se crea desde la muestra y conserva el cuento (DECISIONS 056). En staging falta habilitar el proveedor anónimo.                                   |
| Foto opcional / modo sin foto (avatar por rasgos)                       | NO EXISTE           | El paso de fotos exige al menos una válida.                                                                                                                                             |
| Recuerdos guiados (2–4 preguntas, opcionales y moderadas)               | NO EXISTE           | Hoy: gustos, mascota, mejor amigo, dedicatoria y hasta 2 enseñanzas.                                                                                                                    |
| Datos mínimos del niño                                                  | EXISTE              | Nombre de pila, edad, pronombres opcionales; no se piden apellido, fecha de nacimiento ni colegio.                                                                                      |
| Consentimiento del adulto antes de subir fotos (fecha, versión, IP)     | EXISTE              | `consents`, verificado en la API.                                                                                                                                                       |
| Vista previa gratis con marca de agua, límites y presupuesto de IA      | EXISTE (2026-10-26) | "Muestra de la historia": portada + 2 páginas, 1 regeneración gratis, cuotas, presupuesto diario con corte y alerta, y explicación de qué cambia en el libro final (DECISIONS 053–055). |
| Responsive 390 px / 1440 px, foco visible, contraste                    | EXISTE              | Lighthouse móvil: 92–96 de rendimiento y 100 de accesibilidad.                                                                                                                          |

## 3. Monetización (Fase 2)

| Requisito                                                                                     | Estado    | Detalle                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precios en unidades menores con moneda explícita                                              | EXISTE    | `prices/{país}_{formato}.amountMinor`.                                                                                                                                                          |
| Estados `draft/test/approved/active` por país, formato y precio                               | NO EXISTE | Solo un booleano `active`.                                                                                                                                                                      |
| Precios de prueba de la estrategia (US 14,99 / 29,99 / 44,99; MX 149–199 / 499–549 / 649–749) | NO EXISTE | El seed tiene otros valores de ejemplo (US 19,99 / 39,99 / 49,99; MX 349 / 799 / 999).                                                                                                          |
| España y resto deshabilitados                                                                 | EXISTE    | Solo MX y US activos (fase de lanzamiento 1).                                                                                                                                                   |
| Cotización de envío e impuestos en backend con `supported=false` seguro                       | PARCIAL   | La interfaz `PrintProvider.quote()` existe (mock); no hay servicio de cotización ni tabla de quotes con vencimiento.                                                                            |
| Checkout y pagos reales                                                                       | BLOQUEADO | Hay interfaz y mock. Falta definir la entidad cobradora: Stripe no abre cuentas en Uruguay; opciones: LLC en EE. UU. (p. ej. Stripe Atlas) u otro procesador. Decisión de negocio con asesoría. |
| Webhooks idempotentes                                                                         | PARCIAL   | Firma verificada en los mocks; falta registro de claves de idempotencia y órdenes únicas.                                                                                                       |
| Unit economics y ledger de costos                                                             | PARCIAL   | `orders.costsUsdMinor` (IA, imprenta, envío); `aiUsage` por llamada en fase 07. Faltan comisiones de pago, FX con fecha y fuente, reserva de reembolsos y reconciliación.                       |
| Descuentos auditados                                                                          | PARCIAL   | Modelos `coupons` y `promotions`; sin motor de precios ni auditoría de cambios.                                                                                                                 |

## 4. Producto y fulfillment (Fase 3)

| Requisito                                                | Estado             | Detalle                                                                                                                                                  |
| -------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consistencia del personaje                               | PARCIAL (en curso) | Ficha del personaje + foto + portada como referencia; script de evaluación pendiente.                                                                    |
| Libro completo, maquetación y PDF de imprenta            | NO EXISTE          | El worker solo tiene `/health`; Workflows tiene el esqueleto.                                                                                            |
| QA editorial con reintentos y cola manual                | NO EXISTE          | Hay moderación por texto e imagen en la vista previa (fase 07).                                                                                          |
| Aprobación explícita antes de imprimir, con versión fija | NO EXISTE          | Los estados de pedido no tienen `ready_for_review`, `changes_requested` ni `approved_for_print`; hay que ampliarlos sin reutilizar `paid` como aprobado. |
| PrintProvider real (Gelato, Prodigi o Lulu)              | BLOQUEADO          | Hacen falta cuenta, API key y muestras físicas; hoy solo hay mock.                                                                                       |
| Seguimiento y mails transaccionales                      | PARCIAL            | Interfaz de mail y mock; sin plantillas ni proveedor real.                                                                                               |

## 5. Privacidad y protección infantil

| Requisito                                                                          | Estado     | Detalle                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fotos privadas, URLs firmadas cortas, sin acceso del cliente al bucket             | EXISTE     | Reglas de Storage niegan todo; subida y descarga firmadas.                                                                                                                                                                                           |
| Rechazadas borradas al instante; borrado a pedido inmediato                        | EXISTE     | `PhotoService`.                                                                                                                                                                                                                                      |
| Borrado a 30 días de originales                                                    | EXISTE     | Regla de ciclo de vida del bucket de fotos, sin papelera (`soft_delete_retention_seconds = 0`).                                                                                                                                                      |
| Borrado de derivados (retrato, ficha del personaje, ilustraciones de vista previa) | PARCIAL    | El retrato está en el mismo bucket (30 días); la ficha se borra con la foto. Las ilustraciones de vista previa en `generated-assets` no tienen política de borrado todavía. **No prometer plazos en la web hasta cerrarlo.**                         |
| Analítica sin datos del niño                                                       | **RIESGO** | GA4 y Meta Pixel se cargan solo con consentimiento, pero registran page views en todas las rutas, incluido el creador (`/create/<bookId>`). La estrategia pide aislar los pasos sensibles: hay que desactivarlos ahí. No se envían nombres ni fotos. |
| Logs sin PII                                                                       | EXISTE     | La API registra método, URL e IDs; no registra cuerpos, nombres ni fotos. Revisar URLs con IDs de borrador al diseñar eventos.                                                                                                                       |
| Proveedor de IA que no entrene con los datos                                       | EXISTE     | Vertex AI. Se descarta la capa gratuita de la API de Gemini para fotos de chicos.                                                                                                                                                                    |
| Revisión legal (COPPA, GDPR, LGPD, México)                                         | BLOQUEADO  | Textos legales de ejemplo; requieren abogado.                                                                                                                                                                                                        |

## 6. Medición, experimentos y admin (Fase 4)

| Requisito                                                               | Estado    | Detalle                                                                                              |
| ----------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Eventos del embudo sin PII                                              | NO EXISTE | Esperando `docs/EVENTOS-Y-KPIS.md`.                                                                  |
| Experimentos de precio y mensaje con asignación estable                 | NO EXISTE |                                                                                                      |
| Panel admin (países, precios, catálogo, IA, QA, kill switch, auditoría) | NO EXISTE | `apps/admin` es un esqueleto. Existen `auditLog`, `siteConfig` (kill switch del sitio) y `aiConfig`. |
| Datos simulados rotulados                                               | PARCIAL   | Proveedores `mock` y proyecto demo en local; falta rotular métricas cuando existan.                  |

## 7. Riesgos priorizados

1. **P0 — Analítica en el creador:** desactivar GA4 y Meta Pixel en `/create`, `/account` y `/login` antes de configurar IDs reales. Hoy no hay IDs configurados en ningún ambiente, así que no hubo envíos.
2. **P0 — Cobro:** sin entidad cobradora elegible no hay checkout real. No bloquea el desarrollo con mocks.
3. **P0 — Precios:** los del seed no coinciden con la estrategia y se muestran como "desde". Pasarlos a los de prueba con estado `test` y no publicarlos en producción sin aprobación.
4. **P1 — Derivados de fotos:** definir y aplicar el borrado de las ilustraciones de vista previa antes de prometer plazos.
5. **P1 — Login antes de mostrar valor:** frena la conversión; resolver con sesión anónima.

## 8. Decisiones que necesitan al dueño

- **Colecciones:** propuesta de mapeo para el MVP, con 2–3 títulos por colección:
  - **Aventuras:** aventura espacial, valle de los dinosaurios y reino encantado. Gol de campeón, superhéroe, selva y fondo del mar quedan inactivas, sin borrarse.
  - **Grandes Momentos:** llega un hermanito, primer día de clases y mudanza, como historias propias y no solo como enseñanza combinable.
  - **Nuestros Recuerdos:** 2 historias nuevas, con abuelo/a y con su mascota, que se alimentan de los recuerdos guiados.
  - **Enseñanzas:** se mantienen como capa opcional dentro de cualquier historia.
- **Entidad cobradora y procesador de pagos.**
- **Imprenta candidata y SKU:** para pedir cotizaciones y muestras de 32 páginas en tapa dura de ~21×21 cm a EE. UU. y México.
- **Primer mercado:** EE. UU. (estrategia) o México (hoy activo con precios de ejemplo).

## 9. Orden de implementación propuesto

| Paso | Contenido                                                                                                     | Requiere decisión externa                                       |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1a   | Aislar la analítica del creador (P0)                                                                          | No                                                              |
| 1b   | Terminar la vista previa (fase 07) con los ajustes de la estrategia                                           | No (la evaluación con modelos reales cuesta: se pide OK aparte) |
| 1c   | Sesión anónima: crear sin cuenta hasta guardar o comprar                                                      | No                                                              |
| 1d   | Modo sin foto (avatar por rasgos) y recuerdos guiados                                                         | No                                                              |
| 1e   | 3 colecciones en catálogo, home y wizard; copy del CTA                                                        | Sí: mapeo de colecciones                                        |
| 2    | Estados de publicación de país, formato y precio; precios de prueba; servicio de cotización; ledger de costos | Parcial: precios aprobados                                      |
| 2b   | Checkout real y webhooks idempotentes                                                                         | Sí: entidad y procesador                                        |
| 3    | Libro completo, QA, aprobación antes de imprimir, PDF, PrintProvider sandbox                                  | Sí: imprenta                                                    |
| 4    | Eventos sin PII, experimentos, admin                                                                          | Sí: `EVENTOS-Y-KPIS.md`                                         |

Cada paso se cierra con lint, typecheck, tests y capturas en desktop y móvil. Nada se despliega a producción ni cobra sin aprobación.
