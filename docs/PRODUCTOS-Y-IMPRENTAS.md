# Productos, imprentas y líneas

Cruce de lo que ofrece la web (Familias, Celebraciones, Profesionales) con lo que las imprentas integradas pueden producir. Fecha: 2026-10-30. Fuentes: `packages/shared/src/models/editorial.ts`, `kit.ts`, `print.ts`, `firebase/src/seed.ts` y los adaptadores de `packages/providers/src/{gelato,lulu,cloudprinter}`.

## 1. Qué puede imprimir cada imprenta

| Imprenta     | Producto                                 | Formato de corte           | Páginas                                                                     | Destinos en el seed                                   | Costo de referencia (USD)         |
| ------------ | ---------------------------------------- | -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------- |
| Gelato       | Fotolibro tapa blanda y tapa dura        | 210×280 mm                 | 28 a 200, pares                                                             | EE. UU. y cualquier país (se cotiza con la dirección) | 9,86 / 12,83                      |
| Cloudprinter | Fotolibro tapa blanda y tapa dura        | US Letter (215,9×279,4 mm) | 28 a 200, pares                                                             | México, EE. UU. y cualquier país                      | MX 5,23 / 10,79; US 12,96 / 31,69 |
| Lulu         | Libro color estándar, tapa blanda y dura | US Letter (215,9×279,4 mm) | Tapa dura desde 24; tapa blanda desde 32 (rellena con páginas para dibujar) | EE. UU. y cualquier país                              | 4,94 / 13,51                      |
| Mock         | Solo desarrollo y staging                | 210×280 mm                 | desde 12                                                                    | Todos                                                 | —                                 |

Todas imprimen **libros encuadernados**. Ninguna está integrada para tarjetas, stickers, etiquetas ni cuadernillos.

En producción ninguna imprime todavía: cada opción exige `qaSamplePassed` (muestra física aprobada), y no hay muestras. No hay imprenta decidida para Latinoamérica ni BookVault para Europa.

## 2. Qué vende la web

| Producto web                                                      | Familias                        | Celebraciones      | Profesionales                   |
| ----------------------------------------------------------------- | ------------------------------- | ------------------ | ------------------------------- |
| Libro Mini, 12 páginas                                            | Digital                         | —                  | Digital                         |
| Libro Corto, 16 páginas                                           | Digital                         | —                  | Digital                         |
| Libro Clásico, 28 páginas                                         | Digital, tapa blanda, tapa dura | —                  | Digital, tapa blanda, tapa dura |
| Libro Gran aventura, 32 páginas                                   | Digital, tapa blanda, tapa dura | —                  | Digital, tapa blanda, tapa dura |
| Kit: mini cuento                                                  | —                               | Digital            | —                               |
| Kit: actividades, invitación, agradecimiento, stickers, etiquetas | —                               | Digital            | —                               |
| Impresión en cantidad del kit                                     | —                               | "Se cotiza aparte" | —                               |

## 3. Cruce: qué está alineado y qué no

**Alineado**

- Libros Clásico y Gran aventura (28 y 32 páginas) en tapa blanda y dura: cumplen el mínimo de las tres imprentas. Es el mismo producto en Familias y Profesionales.
- Mini y Corto (12 y 16 páginas) solo en digital: ninguna imprenta imprime menos de 24 páginas, y la web ya lo dice así.

**Desalineado o sin cubrir**

1. **Celebraciones no puede imprimir nada hoy.** Ninguna pieza del kit (invitación, agradecimiento, stickers, etiquetas, actividades) tiene imprenta integrada. La web solo promete el kit digital y cotiza la impresión aparte.
2. **El mini cuento souvenir probablemente no se puede imprimir con estas imprentas.** Los fotolibros integrados piden 28 páginas o más (24 en tapa dura de Lulu), y un souvenir para invitados es un libro corto. El largo del mini cuento del kit no está fijado en el código; si es menor a 28 páginas, hace falta otro producto (cuadernillo grapado o tapa blanda delgada).
3. **Formato de corte distinto.** La web dice "21×28 cm". Gelato corta 210×280 mm, pero Lulu y Cloudprinter cortan US Letter (215,9×279,4 mm). Falta un PDF por imprenta (pendiente ya anotado en `PROGRESS.md`).
4. **Profesionales: descuento y margen de impresión sin cruzar.** El descuento por recurrencia aplica también al impreso, con tope (`physicalMaxPercent`, 15 % por defecto, desde 5 compras en 90 días). Las opciones de imprenta limitan a 100 ejemplares por pedido y el margen mínimo por imprenta sigue pendiente (`PROGRESS.md`), así que el descuento no está verificado contra el costo real de cada imprenta.
5. **Sin imprenta para Latinoamérica.** Cloudprinter cubre México; el resto del continente se cotiza con la dirección y puede quedar sin opción de impreso.
6. **Producción cerrada para imprimir** hasta tener muestras físicas de cada producto y país.

## 4. Decisiones que hay que tomar

1. ¿Celebraciones va a vender impreso (invitaciones, stickers, etiquetas, souvenir) o se queda en kit digital? Si imprime, hay que elegir productos y una imprenta que los tenga.
2. ¿El souvenir impreso es un libro corto o un cuadernillo? Define qué imprenta sirve.
3. ¿Se unifica el formato de corte en US Letter o se genera un PDF por imprenta?
4. ¿Imprenta para Latinoamérica y para Europa?
5. ¿Profesionales necesita impresión en cantidad con precio propio?
