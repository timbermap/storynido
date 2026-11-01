# Pendientes (2026-11-01)

Estado de todo lo pedido en reportes y documentos. Se actualiza al cerrar cada tanda. Objetivo de salida suave: **16 de noviembre** (Familias y Eventos digital; español, inglés y portugués).

## A. Para salir (bloqueantes que puedo hacer yo)
1. Eventos de conversión (`preview_created`, `begin_checkout`, `purchase`) con consentimiento, sin datos del niño y sin pasos nuevos para quien compra (autorizado; falta hacerlo).
2. Home: la tarjeta de Celebraciones sigue diciendo «bautismos, comuniones y egresos: un diseño, muchas copias» y la FAQ del kit habla de «licencia de copias».
3. «Disponible en todo el mundo» → lo que es cierto (digital en todo el mundo; impreso en X países).
4. Página de envíos: solo los países con impreso habilitado, con plazo y costo.
5. Fecha límite del impreso para Navidad por país, visible en la ficha y el pago.
6. Portada de muestra de Familias igual a una historia real del catálogo.
7. Casilla de consentimiento del padre o tutor al subir la foto.
8. Descripción propia (o noindex) de las páginas legales; datos estructurados (Product, FAQPage, BreadcrumbList).
9. CSP y Permissions-Policy compatibles con el proveedor de pago (cuando se elija).
10. Aviso de fecha límite de Navidad en el checkout del impreso (parte del 5).
11. Fuentes: de 6 archivos a 2 familias y 2 pesos; hero por `next/image`.

## B. Para salir (solo tú o terceros)
1. Prueba de punta a punta con cuenta nueva (foto, vista previa, pago digital e impreso, correo, PDF, pedido a la imprenta, reembolso, borrado de cuenta), en celular y computadora.
2. Variables de producción: `NEXT_PUBLIC_SITE_ENV=production` (robots), dominio del sitemap, GA4 y Meta Pixel.
3. Correos: dominio verificado (SPF, DKIM, DMARC).
4. Abogado: términos y privacidad. Contador: impuestos (IVA UE, impuesto de venta EE. UU.).
5. Proveedor de pago elegido y probado.
6. Fotos reales del libro impreso y beta con 20 a 30 familias.
7. Inglés y portugués revisados por nativos (los dejaste activos).
8. Medir con la imprenta el plazo real a Argentina, México, España y EE. UU.
9. Probar el login en un celular real (redirección).
10. Subir `minInstances` a 1 cuando haya anuncios (hoy 0 en producción).

## C. Auditorías y documentos: lo que falta
**Historias:** primer día de clases por país (Einschulung, Reyes completo), francés y alemán, elenco con una versión por etapa, temas de «Le encanta» para las 9 historias nuevas.
**Texto por edad:** capítulos, novela corta e historieta (páginas de solo texto en el pipeline + confirmar 64/96 páginas con Lulu y Gelato).
**Eventos:** renombrar a «Cumpleaños y fiestas» (y URLs), calculadora de cantidad de invitados, foto real del hero, libritos impresos por invitado («próximamente»), código de descuento en el souvenir, recordatorio del año siguiente, temáticas por edad, libro de la clase.

## D. Plan de portadas (7 PR)
Hecho: 1 (nombre del visitante), 2 (layouts A/B/C), título repetido fuera de la tarjeta.
Falta: 3 (portada como libro y galería), 4 (temas «Le encanta»), 5 (recortes para redes y A/B), 6 (portada del pedido: lámina del chico, control automático, tapa de imprenta a 300 PPI, contratapa).

## E. Verificaciones abiertas
- E2E de los últimos commits (los pushes seguidos cancelan corridas anteriores) y el test nuevo del nombre del visitante.
- Una falla intermitente del E2E de la home en celular (banner de cookies tapando la tarjeta de Familias).
- Verificar que la página de enseñanza no cachee el encabezado de la historia destacada.
- Cuándo pedirle a Profesionales con sesión «Nuevo proyecto» (pregunta abierta).
