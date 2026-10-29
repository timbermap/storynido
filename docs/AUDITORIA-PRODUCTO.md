# Auditoría de producto, editorial y UX (2026-10-29)

Responde a tres documentos externos:

- el "prompt maestro" editorial y visual;
- la propuesta de UX;
- el análisis de reseñas de la competencia.

Los tres piden lo mismo para empezar: ver qué existe antes de cambiar nada.

**Leyenda:**

- **EXISTE:** verificado en el código.
- **PARCIAL:** hay una parte.
- **FALTA:** no existe.
- **HIPÓTESIS:** requiere probar con usuarios.
- **BLOQUEADO:** depende de algo que no tenemos (muestras físicas, pedidos reales, abogado).

**Tipo de cambio:**

- C: configuración o contenido;
- P: solo prompts;
- F: frontend;
- B: backend o pipeline.

## 1. Los problemas de la competencia, contra lo que ya tiene StoryNido

| #   | Problema en reseñas                      | Estado    | Lo que hay hoy                                                                                                                                                                                                              | Propuesta                                                                                                                                                                               | Tipo  | Prioridad |
| --- | ---------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------- |
| 1   | El chico no se parece                    | PARCIAL   | La lámina del personaje se aprueba **antes** de generar portada y páginas ("¿Es él / es ella?"), con ajuste de rasgos y otra lámina dentro del límite                                                                       | Pedir el motivo cuando no se parece (pelo, ojos, edad, expresión) y regenerar con ese ajuste                                                                                            | F + P | P0        |
| 2   | Cambia entre páginas                     | EXISTE    | Cada página se genera con la lámina aprobada como **imagen de referencia**, más una ficha de rasgos (`mustKeep`). El QA de cada página la compara con la referencia y la que no coincide se regenera o va a revisión humana | Medirlo con pedidos reales (`pnpm eval:character`)                                                                                                                                      | —     | Validar   |
| 3   | Ilustraciones artificiales o cara pegada | PARCIAL   | El prompt de imagen pide ilustración y nada de texto en la imagen. Nunca se pega la foto: la foto solo describe rasgos                                                                                                      | Dirección de arte por público y edad: paletas, composición variada (plano general, medio, primer plano) y restricciones negativas (piel plástica, brillo excesivo, 3D genérico). Ver §3 | P     | P0        |
| 4   | Historias genéricas o incoherentes       | PARCIAL   | Plan editorial por escenas (objetivo, momento emocional, lo visible, continuidad), extensión y densidad por edad, y reglas obligatorias (no humillar, no diagnosticar)                                                      | Reglas narrativas en el prompt de texto: el chico **decide** y resuelve, gancho, desafío real, momento visual memorable y motivo para releer. Ver §4                                    | P     | P0        |
| 5   | Nombre equivocado                        | EXISTE    | El nombre y la dedicatoria salen de datos estructurados. La tapa y el texto los compone el PDF, no la IA. Un nombre mal escrito **bloquea** el libro. La huella impide que se fabrique algo distinto de lo aprobado         | —                                                                                                                                                                                       | —     | Hecho     |
| 6   | No se puede corregir                     | PARCIAL   | Se puede editar el texto de cada página, pedir otra ilustración de una página (con límite) y ajustar los rasgos del personaje                                                                                               | Correcciones guiadas ("el pelo", "la expresión") en vez de solo "otra ilustración"                                                                                                      | F + P | P1        |
| 7   | El impreso no es lo prometido            | BLOQUEADO | La geometría del PDF está validada (sangrado, área segura, contraste)                                                                                                                                                       | Muestras físicas de cada imprenta y formato, con **fotos y video reales** del libro en la web: papel, tapa y medidas                                                                    | C     | P1 (tuyo) |
| 8   | Entregas tarde                           | PARCIAL   | Plazo de la imprenta en el checkout, fecha del regalo con aviso si no llega, seguimiento en "Mi cuenta"                                                                                                                     | Correcto por ahora. Medir plazos reales con las primeras órdenes                                                                                                                        | —     | Validar   |
| 9   | Cobros recurrentes confusos              | EXISTE    | Compra única, sin suscripciones                                                                                                                                                                                             | Decirlo en las preguntas frecuentes ("Pagas una sola vez")                                                                                                                              | C     | P2        |
| 10  | Privacidad de la foto                    | EXISTE    | Consentimiento con versión, fotos borradas a los 30 días, borrado a pedido, nunca para entrenar modelos, sesiones anónimas que se limpian                                                                                   | Un bloque visible en las landings ("Qué hacemos con la foto")                                                                                                                           | F     | P1        |
| 11  | Familiares que no se parecen             | PARCIAL   | Mascota y acompañante aparecen descritos en texto, sin imagen de referencia                                                                                                                                                 | Ficha de rasgos (y lámina) para el acompañante principal                                                                                                                                | B     | P2        |
| 12  | Sin datos propios para mejorar           | FALTA     | Opiniones después de la entrega                                                                                                                                                                                             | **Una pregunta después de la muestra:** "¿Qué mejorarías?" (no se parece, datos incorrectos, ilustración, historia, otro), unida al costo de IA y a la conversión en el panel           | F + B | P0        |

## 2. UX por público

| Recomendación                                                   | Estado  | Notas                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home: foto → personaje → libro en el primer pantallazo          | EXISTE  | Hero con el retrato grande sobre el libro (DECISIONS 101 y 102)                                                                                                                                                                                                                                                                                    |
| Home: "¿Para quién es?" con tres entradas                       | EXISTE  | Una landing completa por público (DECISIONS 102)                                                                                                                                                                                                                                                                                                   |
| Familias: elegir por edad y por temática                        | PARCIAL | El catálogo filtra por edad (2–3, 4–5, 6–8, 9–12) y por colección. Falta la pregunta "¿Qué le encanta?" con 4 temáticas simples, sin mostrar las colecciones internas                                                                                                                                                                              |
| Eventos: comprar por ocasión y ver lo disponible hoy            | PARCIAL | Disponible hoy vs. por cotización (DECISIONS 102) y temas de cumpleaños (101). Solo existe la ocasión "cumpleaños"                                                                                                                                                                                                                                 |
| Profesionales: entrar por necesidad, cuenta después             | PARCIAL | Ejemplos primero (102). Falta nombrar las colecciones por necesidad concreta ("Primera visita al dentista", "Manejar la frustración")                                                                                                                                                                                                              |
| Creador: máximo 4 etapas visibles                               | FALTA   | Hoy son 7 pasos: protagonista, foto, aventura, recuerdos, enseñanza, estilo y resumen. Propuesta: **El chico**, **La aventura** (historia, extensión y estilo), **Su personaje** (foto o rasgos) y **Muestra**, con recuerdos y enseñanza como opcionales después de la muestra. La historia y el público elegidos antes de entrar ya se conservan |
| Muestra como experiencia de compra                              | PARCIAL | Portada y 2 páginas para hojear, edición, otra ilustración, ejemplos del estilo en vez de páginas vacías, aviso del paso pendiente. Falta el selector de formato con precio dentro de la muestra (hoy está en el checkout)                                                                                                                         |
| Un color de acción común y colores por público solo de contexto | EXISTE  | Marca v3: botón durazno en todo el sitio; cada público con su tono (salvia, durazno y lavanda)                                                                                                                                                                                                                                                     |

## 3. Dirección de arte (propuesta, solo prompts)

- **Hoy:** cinco estilos (acuarela, cartoon 3D, cuento clásico, lápices de colores y para colorear) y un prompt de imagen común a todas las historias.
- **Propuesta:** sumar al prompt una **dirección de arte por público y por edad**, sin crear estilos nuevos:
  - **Paleta por familia de historias**, en HEX:
    - Familias, magia: #183F50, #20A69C, #F3BE65, #EF8B91 y #F9EDD9;
    - Familias, aventura y ciencia: #283C83, #744DC5, #17B8C6, #F5B942 y #F06D55;
    - Cumpleaños: #FF6F76, #FBC84B, #31BFC4, #A78BE4 y #FFF0DB;
    - Profesionales: #418D89, #90B9D3, #EAB39B, #C1ADDF y #F8F4EA.

    Va en la historia (configuración), editable en el admin.

  - **Por edad:**
    - 2–3 años: personajes grandes y fondos simples;
    - 4–5: color y acción clara;
    - 6–8: composición cinematográfica;
    - 9–12: más dramatismo y menos aniñado.
  - **Composición variada** a lo largo del libro: plano general, plano medio, primer plano emocional e interacción. El plan editorial asigna un encuadre por escena.
  - **Restricciones negativas:** piel plástica, brillo excesivo, 3D genérico, anatomía rara, objetos al azar y estilos distintos entre páginas.
  - **Espacio libre para el texto,** según la maqueta de cada página.
- **No copiar** estilos de ilustradores ni personajes protegidos: se toman principios editoriales, no obras.
- **La marca de la web es suave** (v3, DECISIONS 103). La intensidad de color va **dentro** de los libros.
- **Implementado** (DECISIONS 103): `artDirection` en `packages/shared/src/models/art-direction.ts`, paleta editable por historia en el admin.

## 4. Narrativa (propuesta, solo prompts)

- **Reglas comunes:**
  - el protagonista decide y resuelve, no mira;
  - gancho en la primera página;
  - un objetivo claro y un desafío real a su edad;
  - un momento visual memorable;
  - un final que dé ganas de releer;
  - la enseñanza se teje en la historia, sin sermón.
- **Por público:**
  - **Familias:** emoción y vínculo, aventura con verdadero conflicto.
  - **Cumpleaños:** una misión festiva con 2 o 3 mini desafíos y la celebración como recompensa, no solo saludos.
  - **Profesionales:** un objetivo principal por cuento, secuencias realistas (por ejemplo, la visita al dentista paso a paso), validar emociones y nunca prometer resultados clínicos.
- **Implementado** (DECISIONS 103): `narrativeRules` en `packages/shared/src/providers/prompts.ts`.
- **Revisión profesional:** antes de promocionar contenido de salud (dentista, emociones) como recurso de preparación, debe revisarlo un profesional.

## 5. Orden propuesto

| Paso | Qué                                                                                                                                 | Costo                  | Necesita              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------- |
| 1    | Pregunta "¿Qué mejorarías?" después de la muestra, en el panel (hecho)                                                              | USD 0                  | —                     |
| 2    | Dirección de arte y reglas narrativas en los prompts (hecho)                                                                        | USD 0 para escribirlas | —                     |
| 3    | (hecho, DECISIONS 103) **Prueba antes y después:** 1 historia por público, mismo protagonista inventado, prompt actual contra nuevo | ~USD 3–5 de IA         | Tu OK                 |
| 4    | Creador en 4 etapas                                                                                                                 | USD 0                  | Tu OK sobre el diseño |
| 5    | Libros de ejemplo por estilo para la muestra (aprobado)                                                                             | ~USD 3                 | — (ya aprobado)       |
| 6    | (hecho, DECISIONS 104) "¿Qué le encanta?" en Familias y colecciones por necesidad en Profesionales                                  | USD 0                  | —                     |
| 7    | (hecho, DECISIONS 104) Correcciones guiadas del personaje                                                                           | USD 0 de desarrollo    | —                     |
| 8    | Fotos y video del libro impreso real                                                                                                | Muestras físicas       | Tus muestras          |
| 9    | Lámina del acompañante (familiar o mascota)                                                                                         | Más IA por libro       | Decisión de producto  |

## 6. Cómo medirlo

- **Embudo:**
  1. empieza el creador;
  2. termina el personaje;
  3. aprueba la muestra;
  4. compra;
  5. vuelve a comprar.

  Ya se registra en la analítica aislada; falta verlo en el panel.

- **Calidad:** la respuesta a "¿Qué mejorarías?" por historia, estilo y modelo; la tasa de páginas regeneradas por el QA; la puntuación de parecido (`eval:character`).
- **Umbral interno propuesto,** no un estándar de la industria: una historia sale a la venta con 85/100 en la rúbrica de 8 criterios del prompt maestro, revisada por una persona.

## 7. Segunda auditoría externa (2026-10-29): verificación

Etiquetas: **VERIFICADO** (código o prueba en navegador), **OBSERVACIÓN**, **RECOMENDACIÓN**, **HIPÓTESIS**.

| Hallazgo                                         | Estado                                                          | Evidencia                                                                                                                                                                            | Qué se hizo / propuesta                                                                                                                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Pocas historias para 10–12                    | VERIFICADO                                                      | `/es/historias?edad=10`: solo "¡Gol de campeón!" (4–10) y "El cumpleaños más mágico" (2–10)                                                                                          | Aviso honesto cuando hay menos de 3 (hecho). **Propuesta:** 3–4 historias para 9–12 (misterio, ciencia, exploración, humor) con la paleta "aventura madura" (#202D50, #3A7591, #6956A6, #E9AE55, #F3EBDD). Necesita OK (portadas con costo) |
| B. Rangos de edad amplios (2–10, 4–10)           | VERIFICADO (rangos) · HIPÓTESIS (si el resultado queda aniñado) | La edad del chico entra al prompt de texto y a la dirección de arte (9–12: "nada aniñado"); el nivel de lectura y la extensión los elige el adulto                                   | Probar una historia a 10 años antes de achicar rangos. Si se achican hoy, el filtro de 10 queda vacío                                                                                                                                       |
| C. Enseñanzas genéricas en la ficha profesional  | VERIFICADO                                                      | El dentista sugería "compartir", "amistad"… y en el creador ofrecía "Primer día de clases" como objetivo                                                                             | **Hecho:** objetivos propios por historia (5 historias), en la ficha y en el creador; el motor de enseñanzas sigue para Familias (DECISIONS 105)                                                                                            |
| D. Página en español con envío a Brasil          | VERIFICADO (diseño)                                             | El país sale de la IP, independiente del idioma; sin cuenta no había forma de cambiarlo en la ficha                                                                                  | **Hecho:** "Enviar a" en la ficha. El idioma no cambia el país                                                                                                                                                                              |
| E. Diferencia entre 12 y 32 páginas poco visible | OBSERVACIÓN                                                     | La ficha muestra "12 a 32 páginas" y precios por formato                                                                                                                             | **Propuesta:** comparador de extensión y formato dentro de la muestra. Necesita OK de diseño                                                                                                                                                |
| F. Creador "Preparando tu cuento…"               | VERIFICADO                                                      | En navegador (escritorio y 390 px) el primer paso carga en ~5,5 s, sin errores de JavaScript. El recorrido completo (foto, personaje, muestra, checkout) pasa en E2E con IA simulada | Prueba con IA real y pago: pendiente del proveedor de pagos. **Propuesta:** bajar el tiempo de arranque (sesión anónima + borrador)                                                                                                         |
| Reseñas y prueba social                          | VERIFICADO                                                      | No hay reseñas reales todavía                                                                                                                                                        | No se inventan. Mostrar demos reales (libros de ejemplo, aprobado)                                                                                                                                                                          |
| Eventos de conversión                            | VERIFICADO                                                      | En el navegador solo se envía `page_view` (con consentimiento); el panel tiene métricas del servidor                                                                                 | **Propuesta:** los eventos del embudo de la auditoría, sin nombres ni fotos. Necesita OK                                                                                                                                                    |
| Tipografía (Nunito Sans + Lora)                  | RECOMENDACIÓN                                                   | La marca v3 usa Quicksand + Lora (tablero aprobado)                                                                                                                                  | Se mantiene: la auditoría acepta la tipografía actual si es equivalente                                                                                                                                                                     |
