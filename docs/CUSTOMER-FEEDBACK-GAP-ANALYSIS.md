# StoryNido — Feedback de compradores vs. repositorio

**Fecha:** 2026-10-27 · **Base:** `main` en `e38ae9c` (fases 01–07c).
**Fuentes:** paquete "Voz del cliente" del 27/10/2026: `INFORME-COMPLETO.md`, `evidencia-casos.csv`, `qa-reglas.json`, `PROMPTS-LLM-Y-QA.md` y `PROMPT-PARA-CLAUDE.md` (guardar en `docs/estrategia/feedback/`).
**Alcance:** las reseñas son una muestra cualitativa, no una tasa de fallas. Las prioridades son hipótesis de riesgo, no estadísticas.

## 1. Qué cambia en la dirección

**La arquitectura no cambia.** El feedback confirma el rumbo (digital primero, impresión selectiva, foto opcional, tres líneas) y agrega 4 énfasis que se integran en las fases existentes:

1. **El libro entero, no solo la portada.** La consistencia del personaje y del texto se verifica en todas las páginas, con un QA por página (texto e imagen) y reparaciones localizadas (fase 09).
2. **"Lo que aprobás es lo que recibís."** Una versión aprobada se congela con hash (textos, nombres, dedicatoria, ilustraciones y PDF) y nada se imprime ni se entrega si no coincide (fases 10–12). Hoy no existe: es la brecha P0 más grande.
3. **El adulto aprueba el personaje.** Hoy la lámina del personaje es interna. El feedback (G1) pide que el adulto la vea y confirme los rasgos que no pueden cambiar (pelo, piel, anteojos) antes de seguir. Se adelanta a una fase corta, la 07d.
4. **Español regional.** Las quejas de traducción rígida (ES05) y de naturalidad piden escribir el cuento en la variante del país (es-MX, es-AR con voseo, es-ES, pt-BR, en-US). La interfaz sigue en español neutro con rutas por idioma; el cuento usa la variante del país elegido.

## 2. Diagnóstico sobre el código real

Prioridades: **P0** bloquea vender · **P1** calidad o servicio · **P2** optimización.

| Falla (ID del informe)                                              | Qué hay hoy                                                                                                                                 | Brecha                                                                                                  | Cambio mínimo                                                                                                                  | Prioridad    | Fase                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------- |
| Rostro poco parecido / deriva entre páginas (ID-01, 02)             | Ficha del personaje (foto o rasgos), lámina como referencia de cada ilustración, evaluación con retrato sintético (DECISIONS 052, 055, 057) | El adulto no ve ni aprueba la lámina; no hay chequeo de continuidad por página                          | Lámina visible con marca de agua y aprobación "¿Es él / es ella?"; rasgos esenciales confirmados; QA de continuidad por página | P0           | 07d (aprobación) y 09 (QA)      |
| Rasgos esenciales perdidos: anteojos, piel, pelo (ID-04, US10)      | Modo sin foto con anteojos y tonos de piel; con foto, la IA extrae la ficha                                                                 | Con foto, el adulto no puede corregir ni marcar rasgos obligatorios                                     | Ficha editable por el adulto ("mustKeepTraits"), que entra en cada prompt y en el QA                                           | P0           | 07d                             |
| Mezcla de dos niños / datos de otra familia (ID-03, 22)             | Reglas por dueño con tests, URLs firmadas, rutas por usuario, fusión anónima con token verificado                                           | Faltan tests de concurrencia entre libros del mismo dueño (Pro) y de mezcla de assets                   | Tests multi-proyecto y verificación de que cada asset pertenece al libro                                                       | P0           | 09 y 12c                        |
| Nombre o dedicatoria equivocados (ID-05, 06)                        | El nombre entra en el prompt; la dedicatoria se pide en el creador pero no se usa todavía                                                   | Nada verifica el nombre exacto (con tildes) en el texto generado; la dedicatoria no está en un snapshot | Chequeo determinístico del nombre y del apodo; dedicatoria como página fija, idéntica en la muestra, el PDF y el pedido        | P0           | 07d (nombre) y 10 (dedicatoria) |
| Humor humillante, diagnósticos, promesas terapéuticas (ID-10, US09) | Moderación de texto e imagen por violencia, sexo, odio, marcas y datos personales                                                           | No rechaza burlas sobre el cuerpo o las necesidades, diagnósticos ni promesas de curación               | Ampliar las reglas de moderación y del prompt                                                                                  | P0           | 07d                             |
| Historia genérica o moralizante (ID-07, 08)                         | Recuerdos guiados, enseñanzas "sin sermonear", revisión editorial                                                                           | No hay plan de páginas que obligue a que los detalles personales cambien la trama                       | Planificador (`planStory`) antes de escribir: arco, escenas y 2–3 detalles causales; el redactor sigue el plan                 | P1           | 09                              |
| Edad o lectura inadecuada (ID-09, ES13)                             | Extensión, densidad y nivel independientes, con validación del largo por página (DECISIONS 061)                                             | Sin chequeo de vocabulario por nivel                                                                    | Revisión del nivel en el QA literario                                                                                          | P1           | 09                              |
| Texto e imagen contradictorios; anatomía (ID-11, 12)                | La moderación de imágenes rechaza texto colado y deformaciones (DECISIONS 057)                                                              | No compara la imagen con lo que dice la página                                                          | Revisor multimodal por página: pass / repair / human_review                                                                    | P0           | 09                              |
| Traducción rígida (ID-13)                                           | Interfaz es/en/pt; el cuento se escribe en "español neutro"                                                                                 | Sin variantes regionales en el texto del cuento                                                         | Variante por país en el prompt y revisión de localización                                                                      | P1           | 09                              |
| Texto cortado, contraste, texto dentro del dibujo (ID-14)           | Las imágenes rechazan texto                                                                                                                 | No hay PDF todavía                                                                                      | Texto en capa tipográfica, tests de desborde y contraste                                                                       | P0           | 10                              |
| Muestra distinta del entregable (ID-15)                             | Muestra con marca de agua; marca de desactualizada si cambian historia, estilo, foto u opciones                                             | No hay versión congelada ni hash                                                                        | Snapshot aprobado inmutable (textos, nombres, dedicatoria, assets y hash del PDF); un cambio invalida la aprobación            | P0           | 10, 11 y 12                     |
| No se guarda en el celular (ID-16, ES10)                            | Autoguardado por paso en Firestore; sesión anónima que sobrevive                                                                            | Lo escrito dentro de un paso se pierde si se cierra la app antes de "Siguiente"                         | Guardar el formulario en curso (borrador local por paso)                                                                       | P1           | 07d                             |
| Muestra incompleta o engañosa (ID-17)                               | Portada y 2 páginas, más qué cambia en el libro final                                                                                       | Competidores muestran el libro entero antes de pagar                                                    | Evaluar la muestra completa en texto (ya se escribe) e ilustrada después del pago con aprobación; es decisión comercial        | P1           | 11 y 12                         |
| Impresión imposible o mala (ID-19, 26)                              | Mini y Corto solo digital; formatos por extensión                                                                                           | Sin matriz país × SKU × muestra aprobada                                                                | Matriz con `qa_sample_passed` y `enabled`; nada se imprime sin muestra física                                                  | P0 en físico | 12                              |
| Lectura digital incómoda (ID-24)                                    | No existe entrega digital todavía                                                                                                           | Falta                                                                                                   | Lector web en celular más PDF de pantalla e imprimible                                                                         | P1           | 10 y 12                         |
| Profesional sin control del contenido (ID-25, GL03)                 | Edición de texto en la muestra                                                                                                              | En el libro completo, el profesional tiene que poder editar y validar                                   | Edición y validación de todas las páginas en Pro; modo "texto propio"                                                          | P0 en Pro    | 12c                             |
| Eventos: licencias confusas                                         | Diseño maestro (fase 12b)                                                                                                                   | Licencia de copias digitales                                                                            | PDF de Eventos con la cantidad de copias autorizadas                                                                           | P1           | 12b                             |
| Métricas de calidad                                                 | Costo de IA por llamada y por libro                                                                                                         | Faltan los códigos de QA y las tasas                                                                    | `qa_issue_code`, regeneraciones, aprobación del personaje, desajuste entre muestra y entrega                                   | P1           | 09, 15 y 16                     |

## 3. Fase nueva 07d (antes del pipeline): P0 que se resuelven ya, sin costo de IA

> **Estado:** hecha el 2026-10-27 (DECISIONS 064). Ajustes respecto del plan:
>
> - La muestra se divide en 2 etapas: primero el cuento completo y la lámina; recién con la aprobación se ilustran la portada y 2 páginas. Ilustrar pide cuenta gratis.
> - Los códigos de QA son `character_approved` y `character_corrected` (en vez de `character_rejected`).
> - Se sumó un visor del libro completo, tipo "echar un vistazo".

1. **"¿Es él / es ella?"**
   - La muestra muestra la lámina del personaje (con marca de agua) junto con sus rasgos.
   - El adulto confirma o corrige pelo, piel, ojos y anteojos, y marca los rasgos que no pueden cambiar.
   - Con foto, la ficha que extrajo la IA pasa a ser editable. Los rasgos confirmados entran en cada prompt.
   - Si se corrigen, la lámina se regenera dentro del límite de regeneraciones.
2. **Nombre exacto:** chequeo determinístico de que el nombre (con tildes) y el apodo aparecen tal cual. Si falta o está mal escrito, se reescribe 1 vez y queda registrado.
3. **Moderación ampliada:** se rechazan burlas sobre el cuerpo, la apariencia o las necesidades; diagnósticos; promesas terapéuticas; y castigos que avergüencen. También en el prompt del cuento.
4. **Formulario en curso protegido:** lo escrito en un paso se guarda en el navegador y se recupera si la app se cierra antes de "Siguiente".
5. **Códigos de QA:** `name_mismatch`, `length_out_of_range`, `moderation_*` y `character_rejected` quedan registrados por libro, sin datos del niño.

## 4. Ajustes a las fases siguientes

- **09:**
  - Planificador → redactor → revisor de localización → revisor multimodal por página, todos con salida JSON.
  - Reparaciones localizadas por página, con presupuesto por libro y derivación a revisión humana.
  - Cada componente reutiliza `AITextProvider` y `AIImageProvider` (sin motor nuevo).
- **10:** dedicatoria como página fija desde el snapshot; texto en capa; tests de desborde, contraste y recorte; lector web, PDF de pantalla e imprimible.
- **11–12:** snapshot aprobado con hash; el pago y la impresión exigen que el hash coincida; matriz de impresión con muestra física aprobada.
- **12b:** licencia de copias en el PDF de Eventos.
- **12c:** edición y validación profesional de todas las páginas; texto propio.
- **15 y 16:** métricas de calidad del informe (§10), sin datos identificables.
- **17:** los 24 escenarios de prueba del informe (§7.4), con fixtures sintéticos.

## 5. Lo que NO se hace

- No se usan métricas automáticas de parecido facial como garantía de identidad: el control es la aprobación del adulto.
- No se promete "se parece exactamente", "sin errores", impresión local en todo el mundo ni fechas garantizadas.
- No se cambia la arquitectura, el motor de IA ni el stack. Los "agentes" del documento de prompts son funciones de los proveedores actuales.
