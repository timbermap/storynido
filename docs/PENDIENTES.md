# Pendientes (2026-11-01, actualizado al cierre del día)

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

1. (Hecho: el aviso de Navidad ya está también en el checkout del impreso.)
2. CSP y Permissions-Policy del proveedor de pago (cuando se elija).

## C. Para salir: solo tú o terceros

1. Prueba de punta a punta con cuenta nueva (foto, vista previa, pago digital e impreso, correo, PDF, pedido a la imprenta, reembolso, borrado de cuenta), en celular y computadora.
2. Variables de producción: `NEXT_PUBLIC_SITE_ENV=production` (robots), dominio del sitemap, GA4 y Meta Pixel.
3. Correos: dominio verificado (SPF, DKIM, DMARC).
4. Abogado: revisar términos y privacidad (son un borrador) y completar el domicilio legal y el RUT de StoryNido SRL. Contador: impuestos (IVA UE, impuesto de venta EE. UU.).
5. Proveedor de pago elegido y probado.
6. Foto real del primer libro impreso (la foto de muestra generada con IA ya no está en Familias) y beta con 20 a 30 familias.
7. Medir con la imprenta el plazo real a Argentina, México, España y EE. UU.
8. Probar el login en un celular real (redirección).
9. Subir `minInstances` a 1 cuando haya anuncios (hoy 0 en producción).

## D. Auditorías y documentos: lo que falta

**Historias:** primer día de clases por país, francés y alemán, elenco con una versión por etapa.
**Texto por edad:** capítulos, novela corta e historieta (páginas de solo texto en el pipeline y confirmar 64 o 96 páginas con Lulu y Gelato).
**Eventos:** renombrar a «Cumpleaños y fiestas» (y URLs), calculadora de cantidad de invitados, foto real del hero, libritos impresos por invitado («próximamente»), código de descuento en el souvenir, recordatorio del año siguiente, temáticas por edad, libro de la clase.

## E. Plan de portadas (7 PR)

Hecho: 2 (layouts A, B y C), título fuera de la tarjeta. El PR 1 (nombre del visitante) se retiró hasta poder hacer coincidir nombre y dibujo.
Falta: 3 (portada como libro y galería), 5 (recortes para redes y A/B), 6 (portada del pedido: lámina del chico, control automático, tapa de imprenta a 300 PPI, contratapa).

## G. Profesionales (documento «auditoría y estudio de mercado», 2026-11-01)

**P0:**

1. (Hecho) Dos colecciones nuevas: «Calmarme y regularme» e «Historias sociales para el día a día», con 4 historias cada una.
2. (Hecho) Las 4 colecciones actuales ya tienen 4 historias cada una.
3. Guía para el profesional en cada historia (PDF: objetivo, cómo leerla, cinco preguntas, una actividad y cómo seguir en casa).
4. Una persona con título que revise el contenido, con nombre y matrícula en la landing (lo tienes que aportar tú).

**P1:** precio profesional más bajo que Familias y packs de créditos con factura; modo historia social (texto mínimo, una acción por página), versión para proyectar y en blanco y negro; «libro de la clase»; landing con resultado en el hero, ejemplo para hojear, filtros por edad, objetivo y rol, y preguntas frecuentes de uso en clase.
**P2:** colecciones de pantallas y juego, amigos y convivencia, preocupaciones y miedos, mi cuerpo es mío y cambios en la familia (las dos últimas con revisión de especialista); landings por necesidad para buscadores.

## F. Verificaciones abiertas

- E2E de los últimos commits (cada push cancela la corrida anterior).
- Encabezado en celular: mide 401 px en 400 (falta 1 px) y 408 en Eventos; el último ajuste está en camino a staging.
- Notificaciones de GitHub: avisan por correo cada CI fallido. Para apagarlas: GitHub, Settings, Notifications, sección Actions (o Unwatch del repositorio). Yo corro el lint y el formato completos antes de cada push.
- Falla intermitente del E2E de la home en celular (el banner de cookies tapa la tarjeta de Familias).
- Que la página de enseñanza no cachee el encabezado de la historia destacada.

## H. Después del live (evaluaciones del 2026-11-03)

Origen: evaluación del kit de Celebraciones («Angelica y el reino de los colores») y del cuento de Profesionales («El rincón de la calma»). Lo que se hizo antes del live está en DECISIONS 225.

- [ ] **300 ppi para el impreso** (4K en la generación final, maquetación a 2600 px, `minDpi` 290; las muestras siguen en 2K). Obligatorio antes de ofrecer impreso. Necesita una generación de prueba y la estimación de costo aprobada.
- [ ] Sangrado de 3 mm en las piezas del kit; varias invitaciones por hoja y versión plegable; stickers recortados alineados a una plancha comercial.
- [ ] Hoja de personaje fija para secundarios y objetos clave (ropa, utilería), con imagen de referencia por personaje.
- [ ] Dialecto por país (vos o tú, torta o pastel, formatos de fecha); pasar el país al generador del cuento.
- [ ] Profesionales: guía de 1 página para el adulto, 3 fichas imprimibles y versión para proyectar; libro de 24 páginas; objetivo, edad y contexto en el formulario; términos para profesionales y tratamiento de datos de menores.
- [ ] Formatos de imprenta: 21×21 o 20,3×25,4, múltiplo de 4, PDF/X-1a CMYK.
- [ ] Negocio: suscripción para profesionales, referidos y comisión, catálogo de 12 temas, validación con 5 profesionales reales, métricas semanales (libros con error bloqueante, páginas regeneradas por QA, segundo cuento en 30 días).
- [ ] Verificar que `BRAND_DOMAIN` de producción sea `storynido.com` (el QR del libro usa el dominio del entorno).

## I. Home con sesión: después del live (revisión del 2026-11-03, DECISIONS 226)

- [ ] Navbar y footer en Figtree y con el mismo contenedor que la página (el logo alinea con el título del hero).
- [ ] Explorar: tres columnas iguales (Familias, Celebraciones, Profesionales) con su portada y 2 o 3 accesos; «Plantillas profesionales» pasa a «Profesionales».
- [ ] Secciones según el estado: con un pedido en curso o comprado, sin «Un libro de verdad» ni «Antes de decidir»; el estado del pedido y «Ayuda con tu pedido» en su lugar. Borrador o vista previa: «Cómo sigue» solo con los pasos que faltan.
- [ ] Preguntas con el acordeón del sitio y un solo fondo de página.
- [ ] El nombre del protagonista sobre la portada de otro chico: priorizar portadas sin cara o marcar «ilustración de ejemplo»; en «Cómo sigue», el personaje aprobado si existe.
