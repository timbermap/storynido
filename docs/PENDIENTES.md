# Pendientes (2026-11-01, actualizado)

Estado de todo lo pedido en reportes y documentos. Objetivo de salida suave: **16 de noviembre** (Familias y Eventos digital; español, inglés y portugués).

## A. Para salir: hecho

- Eventos de conversión (`preview_created`, `begin_checkout`, `purchase`), con consentimiento y sin datos del niño (decisión 179).
- Home y FAQ de Eventos sin «bautismos, comuniones y egresos: un diseño, muchas copias» ni «licencia de copias».
- «Disponible en todo el mundo» → «Digital en todo el mundo; impreso en los países donde enviamos».
- Página de envíos: lista solo los países con imprenta probada.
- Fecha límite de Navidad por país en la ficha del libro.
- Portada de muestra de Familias igual a una historia real.
- Consentimiento de la foto (ya existía, con versión y registro en el servidor).
- Descripción propia de las páginas legales; datos estructurados (Product y FAQPage ya estaban).
- Títulos, descripciones y canónicas de Familias y del buscador; `favicon.ico` y manifest.
- Errores del navegador en el log propio.
- Hero de Eventos (opción B), precios unificados, términos y privacidad ampliados, foto del libro impreso (de muestra).
- Fuentes variables (4 archivos en lugar de 9) y hero más livianos.

## B. Para salir: me faltan

1. Aviso de la fecha límite de Navidad también en el checkout del impreso.
2. CSP y Permissions-Policy del proveedor de pago (cuando se elija).

## C. Para salir: solo tú o terceros

1. Prueba de punta a punta con cuenta nueva (foto, vista previa, pago digital e impreso, correo, PDF, pedido a la imprenta, reembolso, borrado de cuenta), en celular y computadora.
2. Variables de producción: `NEXT_PUBLIC_SITE_ENV=production` (robots), dominio del sitemap, GA4 y Meta Pixel.
3. Correos: dominio verificado (SPF, DKIM, DMARC).
4. Abogado: revisar términos y privacidad (son un borrador) y completar el domicilio legal y el RUT de StoryNido SRL. Contador: impuestos (IVA UE, impuesto de venta EE. UU.).
5. Proveedor de pago elegido y probado.
6. Foto real del primer libro impreso (la actual es de muestra generada con IA) y beta con 20 a 30 familias.
7. Medir con la imprenta el plazo real a Argentina, México, España y EE. UU.
8. Probar el login en un celular real (redirección).
9. Subir `minInstances` a 1 cuando haya anuncios (hoy 0 en producción).

## D. Auditorías y documentos: lo que falta

**Historias:** primer día de clases por país, francés y alemán, elenco con una versión por etapa, temas de «Le encanta» para las 9 historias nuevas.
**Texto por edad:** capítulos, novela corta e historieta (páginas de solo texto en el pipeline y confirmar 64 o 96 páginas con Lulu y Gelato).
**Eventos:** renombrar a «Cumpleaños y fiestas» (y URLs), calculadora de cantidad de invitados, foto real del hero, libritos impresos por invitado («próximamente»), código de descuento en el souvenir, recordatorio del año siguiente, temáticas por edad, libro de la clase.

## E. Plan de portadas (7 PR)

Hecho: 1 (nombre del visitante), 2 (layouts A, B y C), título fuera de la tarjeta.
Falta: 3 (portada como libro y galería), 4 (temas «Le encanta»), 5 (recortes para redes y A/B), 6 (portada del pedido: lámina del chico, control automático, tapa de imprenta a 300 PPI, contratapa).

## F. Verificaciones abiertas

- E2E de los últimos commits (cada push cancela la corrida anterior).
- Falla intermitente del E2E de la home en celular (el banner de cookies tapa la tarjeta de Familias).
- Que la página de enseñanza no cachee el encabezado de la historia destacada.
