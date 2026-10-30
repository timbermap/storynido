# Productos, imprentas y líneas

Cruce de lo que ofrece la web (Familias, Celebraciones, Profesionales) con lo que las imprentas pueden producir y entregar. **Verificado el 2026-10-30 contra las APIs reales** de Gelato, Cloudprinter y Lulu (sandbox), pidiendo cotizaciones con nuestros códigos de producto. Cotizar no crea pedidos ni cuesta dinero.

## 1. Libros de la web contra las imprentas

Todos los códigos de producto cotizan bien. Lo que acepta cada imprenta (pedido de 1 libro, EE. UU.):

| Imprenta     | Tapa blanda                           | Tapa dura                             | Páginas mínimas reales                                | Tamaño real              |
| ------------ | ------------------------------------- | ------------------------------------- | ----------------------------------------------------- | ------------------------ |
| Gelato       | 28 p: USD 9,86 · 32 p: 10,51          | 28 p: USD 12,83 · 32 p: 13,73         | **28** (con 24 o menos rechaza)                       | 210×280 mm               |
| Cloudprinter | 24 p: 11,67 · 28 p: 12,96             | 24 p: 30,40 · 28 p: 31,69             | **24** (con 16 o menos rechaza)                       | US Letter 215,9×279,4 mm |
| Lulu         | cualquier cantidad (la completa a 32) | cualquier cantidad (la completa a 24) | Tapa blanda 32, tapa dura 24: **rellena con páginas** | US Letter 215,9×279,4 mm |

Lo que vende la web:

| Producto                   | Formatos que ofrece           | ¿Se puede entregar?                                                                    |
| -------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| Mini (12 p) y Corto (16 p) | Ebook (PDF)                   | Sí. Ninguna imprenta de fotolibros llega a 12 o 16 páginas: solo digital es correcto.  |
| Clásico (28 p)             | Ebook, tapa blanda, tapa dura | Sí en las tres. En Lulu la tapa blanda sale de 32 páginas (4 de relleno para dibujar). |
| Gran aventura (32 p)       | Ebook, tapa blanda, tapa dura | Sí en las tres.                                                                        |

**El ebook no depende de ninguna imprenta.** Lo generamos nosotros: PDF de 210×280 mm, sin sangrado, para leer en pantalla o imprimir en casa.

**El PDF de impresión sí se arma por imprenta**: el worker lee la ficha de cada una (tamaño de corte, sangrado, páginas mínimas y lomo) y rellena con páginas para dibujar cuando hace falta. El texto de la web dice "unos 21×28 cm" porque Lulu y Cloudprinter cortan 6 mm más ancho que Gelato.

## 2. Entrega por país (libro de 32 páginas, 1 ejemplar)

Producción + envío en USD y plazo en días. "No" = esa imprenta no cotiza ese destino.

| País      | Gelato                  | Cloudprinter                         | Lulu                               |
| --------- | ----------------------- | ------------------------------------ | ---------------------------------- |
| México    | 14,93 + 30,39 · 11–18 d | **5,75 + 8,26 · 4–8 d**              | No: pide RFC (`recipient_tax_id`)  |
| Argentina | 14,93 + 30,39 · 6–10 d  | 5,75 + 30,05 · 4–8 d                 | No: pide CUIT (`recipient_tax_id`) |
| Uruguay   | 14,93 + 30,39 · 6–10 d  | 5,75 + 30,05 · 4–8 d                 | **4,94 + 19,64 · 8–16 d**          |
| Brasil    | 14,92 + 18,17 · 14–25 d | 5,75 + 30,05 · 4–8 d                 | No: pide CPF (`recipient_tax_id`)  |
| España    | 11,36 + 5,67 · 7–10 d   | 8,69 + 10,99 · 2–5 d (tapa dura: no) | 5,49 + 8,87 · 8–16 d               |
| Suiza     | 14,93 + 11,13 · 6–7 d   | 6,44 + 22,86 · 5–10 d                | **4,94 + 10,28 · 8–16 d**          |
| EE. UU.   | 10,51 · 6–8 d           | 14,25 · 5–10 d                       | 5,88 · 8–16 d                      |

(Tapa blanda; la tapa dura tiene el mismo patrón de países. Lulu cotiza en sandbox.)

**Conclusión:** en los 7 países probados hay al menos 2 imprentas que entregan los dos formatos. Lulu no sirve para México, Argentina ni Brasil mientras no pidamos el documento fiscal del destinatario. El checkout ya descarta una imprenta cuya cotización falla.

## 3. Riesgos para "no ofrecer lo que no podemos entregar"

1. **El impreso se ofrece en cualquier país** (la opción de imprenta es comodín `*`) y solo se confirma al ingresar la dirección. En un país que ninguna imprenta alcance, la persona vería "desde USD …" y recién después el aviso. Falta una lista de países verificados por imprenta, o una cotización de prueba por país.
2. **En producción no se imprime nada** hasta tener la muestra física de cada producto y país (`qaSamplePassed`). Es lo correcto: la web no ofrece impreso hasta entonces.
3. **Costo de referencia desactualizado.** El seed estima Lulu en USD 4,94 y 13,51; la cotización real es 5,88 y 15,48 (32 páginas, EE. UU.). El precio final usa la cotización real, pero la estimación previa a la dirección queda corta.
4. **Envío a Latinoamérica caro:** Gelato cobra USD 30 a México, Argentina y Uruguay. Solo Cloudprinter a México baja de USD 10.
5. **Celebraciones no tiene nada impreso** (kit solo digital, decidido).

## 4. Productos que se podrían sumar (verificados con cotización real de Gelato)

| Producto                                                      | Qué resuelve                                                                           | Evidencia                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Cuento grapado de 8 a 24 páginas** (A5 o cuadrado 14,8 cm)  | Imprimir el **Mini y el Corto**, que hoy son solo digitales, y el **souvenir** del kit | Cotiza de 8 a 24 páginas. 12 p, 14,8×14,8 cm: USD 9,62 un ejemplar; **1,71 c/u en 30; 1,46 c/u en 100** (producción)         |
| **Tarjetas y tarjetas plegadas** (invitación, agradecimiento) | Piezas impresas del kit de Celebraciones                                               | Catálogos `cards`, `folded-cards` y `pack-of-cards-envelopes` (A6, 14,1 cm, A5, DL), disponibles en la mayoría de los países |
| **Cuaderno de actividades grapado** (A4)                      | Libro para colorear / actividades impreso                                              | Mismo producto grapado, A4, de 8 a 24 páginas: USD 9,96 a 12,68 un ejemplar                                                  |
| Póster, taza, camiseta infantil, calendario                   | Complementos de regalo con el personaje (Familias)                                     | Existen en el catálogo de Gelato; no se cotizó (cada uno necesita archivo y plantilla propios)                               |

No hay producto de **stickers** ni de etiquetas troqueladas en el catálogo de Gelato: las etiquetas del kit se podrían imprimir como tarjetas chicas, y los stickers siguen siendo solo digitales (para imprimir en casa).

Cualquier producto nuevo exige: una ficha de archivo (corte, sangrado, páginas múltiplo de 4 en el grapado), muestra física y una opción de imprenta en la base antes de ofrecerlo.

## 5. Decisiones

1. ¿Sumamos el cuento grapado para Mini y Corto y para el souvenir? Es el que más cierra huecos.
2. ¿Pasamos las invitaciones y tarjetas de agradecimiento a impreso en Celebraciones?
3. ¿Armamos la lista de países verificados por imprenta para no ofrecer impreso donde no entregamos?
4. ¿Pedimos el documento fiscal del destinatario (México, Argentina, Brasil) para habilitar Lulu?
