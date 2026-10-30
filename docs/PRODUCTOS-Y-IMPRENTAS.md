# Productos, imprentas y líneas

Cruce de lo que ofrece la web (Familias, Celebraciones, Profesionales) con lo que las imprentas pueden producir y entregar. **Verificado el 2026-10-30 contra las APIs reales** de Gelato, Cloudprinter y Lulu (sandbox), pidiendo cotizaciones con nuestros códigos de producto. Cotizar no crea pedidos ni cuesta dinero.

## 1. Libros de la web contra las imprentas

Todos los códigos de producto cotizan bien. Lo que acepta cada imprenta (pedido de 1 libro, EE. UU.):

| Imprenta     | Tapa blanda                           | Tapa dura                             | Páginas mínimas reales                                | Tamaño real              |
| ------------ | ------------------------------------- | ------------------------------------- | ----------------------------------------------------- | ------------------------ |
| Gelato       | 28 p: USD 9,86 · 32 p: 10,51          | 28 p: USD 12,83 · 32 p: 13,73         | **28** (con 24 o menos rechaza)                       | 210×280 mm               |
| Cloudprinter | 24 p: 11,67 · 28 p: 12,96             | 24 p: 30,40 · 28 p: 31,69             | **24** (con 24 acepta; con 16 o menos rechaza)        | US Letter 215,9×279,4 mm |
| Lulu         | cualquier cantidad (la completa a 32) | cualquier cantidad (la completa a 24) | Tapa blanda 32, tapa dura 24: **rellena con páginas** | US Letter 215,9×279,4 mm |

Lo que vende la web:

| Producto                   | Formatos que ofrece           | ¿Se puede entregar?                                                                     |
| -------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| Mini (12 p) y Corto (16 p) | Ebook (PDF), cuento grapado   | Sí. Ningún fotolibro llega a 12 o 16 páginas: se imprimen como cuento grapado (Gelato). |
| Clásico (28 p)             | Ebook, tapa blanda, tapa dura | Sí en las tres. En Lulu la tapa blanda sale de 32 páginas (4 de relleno para dibujar).  |
| Gran aventura (32 p)       | Ebook, tapa blanda, tapa dura | Sí en las tres.                                                                         |

**El ebook no depende de ninguna imprenta.** Lo generamos nosotros: PDF de 210×280 mm, sin sangrado, para leer en pantalla o imprimir en casa.

**El PDF de impresión sí se arma por imprenta**: el worker lee la ficha de cada una (tamaño de corte, sangrado, páginas mínimas y lomo) y rellena con páginas para dibujar cuando hace falta. El texto de la web dice "unos 21×28 cm" porque Lulu y Cloudprinter cortan 6 mm más ancho que Gelato.

## 2. Entrega por país (libro de 32 páginas, 1 ejemplar)

Producción + envío en USD y plazo en días. "No" = esa imprenta no cotiza ese destino.

| País      | Gelato                    | Cloudprinter                         | Lulu                      |
| --------- | ------------------------- | ------------------------------------ | ------------------------- |
| México    | 14,93 + 30,39 · 11–18 d   | **5,75 + 8,26 · 4–8 d**              | No: pide documento fiscal |
| Argentina | 14,93 + 30,39 · 6–10 d    | 5,75 + 30,05 · 4–8 d                 | No: pide documento fiscal |
| Uruguay   | 14,93 + 30,39 · 6–10 d    | 5,75 + 30,05 · 4–8 d                 | **4,94 + 19,64 · 8–16 d** |
| Brasil    | 14,92 + 18,17 · 14–25 d   | 5,75 + 30,05 · 4–8 d                 | No: pide documento fiscal |
| España    | 11,36 + 5,67 · 7–10 d     | 8,69 + 10,99 · 2–5 d (tapa dura: no) | 5,49 + 8,87 · 8–16 d      |
| Suiza     | 14,93 + 11,13 · 6–7 d     | 6,44 + 22,86 · 5–10 d                | **4,94 + 10,28 · 8–16 d** |
| EE. UU.   | 10,51 (envío no cotizado) | 14,25 (envío no cotizado)            | 5,88 (envío no cotizado)  |

(Tapa blanda. La tapa dura sigue el mismo patrón de países, salvo Cloudprinter a España, que no la cotiza. Lulu cotiza en sandbox. Los plazos son los que informó cada imprenta en su cotización; en EE. UU. se midió solo el costo de producción.)

**Conclusión:** en los 7 países probados hay al menos 2 imprentas que entregan los dos formatos. Lulu no sirve para México, Argentina ni Brasil mientras no pidamos el documento fiscal del destinatario (el checkout hoy no lo pide). El checkout ya descarta una imprenta cuya cotización falla.

## 3. Riesgos para "no ofrecer lo que no podemos entregar"

1. **Resuelto (DECISIONS 138):** el impreso solo se ofrece en los países verificados de cada imprenta (lista en el seed); fuera de ellos, solo digital. Para sumar un país se cotiza con la imprenta y se agrega a la lista.
2. **En producción no se imprime nada** hasta tener la muestra física de cada producto y país (`qaSamplePassed`). Es lo correcto: la web no ofrece impreso hasta entonces.
3. **Resuelto:** los costos de referencia de Lulu eran los viejos (4,94 / 13,51); ahora son los cotizados.
4. **Envío a Latinoamérica caro:** Gelato cobra USD 30 a México, Argentina y Uruguay. Solo Cloudprinter a México baja de USD 10.
5. **Celebraciones no tiene nada impreso** (kit solo digital, decidido).
6. **Lulu sin México, Argentina y Brasil** hasta que el pago pida el documento fiscal del destinatario (decisión 4 de abajo).

## 4. Productos nuevos

**Hecho: cuento grapado A5 (Mini y Corto).** Gelato, 8 a 24 páginas con tapas, múltiplo de 4. Cotización real de 16 páginas, 1 ejemplar, producción USD 9,96 (20 páginas: 10,30):

| País      | Envío (USD) | Plazo   |
| --------- | ----------- | ------- |
| EE. UU.   | 5,04        | 10–12 d |
| México    | 27,12       | 11–18 d |
| Argentina | 27,12       | 14–25 d |
| Uruguay   | 27,12       | 14–25 d |
| Brasil    | 22,34       | 14–25 d |
| España    | 4,54        | 7–10 d  |
| Suiza     | 13,52       | 6–7 d   |

Con 30 ejemplares de 16 páginas la producción baja a USD 2,04 c/u. Falta la muestra física y abrir la cantidad (ver DECISIONS 138).

**Cotizado, no construido: tarjetas A6** (invitación, agradecimiento). 30 tarjetas: producción USD 21,81 y envío USD 6,65 a 20,56; EE. UU. usa otro producto (100 lb: USD 16). Necesita un pedido de impresión propio dentro del kit.

**Existen, sin cotizar:** cuaderno de actividades grapado A4 (mismo producto, otro tamaño), póster, taza, camiseta infantil y calendario. Los stickers siguen solo digitales (Gelato no los tiene).

Cualquier producto nuevo exige una ficha de archivo, muestra física y una opción de imprenta en la base antes de ofrecerlo.

## 5. Decisiones

1. Hecho (DECISIONS 139): cantidad de ejemplares del cuento grapado, con la creación cobrada una vez.
2. Tarjetas impresas en Celebraciones.
3. Hecho (DECISIONS 139): el pago pide el documento fiscal (opcional) en México, Argentina y Brasil y Lulu suma una tercera opción.
