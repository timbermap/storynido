# StoryNido · Marca y sistema visual

Resumen operativo de la **marca v3** ("cálida, luminosa y editorial"), aprobada el 2026-10-29 con el tablero de marca, y de cómo está implementada. Reemplaza a la v2 (lavanda editorial, 2026-10-26) y a su actualización 2.1.

## Posicionamiento

- Vendemos un **regalo afectivo** donde el niño se reconoce como héroe, no "un generador de cuentos con IA".
- La marca le habla **al adulto** (padres, abuelos, padrinos); la ilustración le habla al niño.
- Promesa: un cuento bonito y personal, con **vista previa gratis** antes de pagar.

## Voz

- Cálida, cercana, imaginativa, clara y segura. Adulto accesible, no tono de jardín.
- **Español neutro con "tú"** (México, EE. UU. hispano, Latinoamérica). Nunca voseo en el sitio.
- Lema: **"Historias que inspiran, enseñan y quedan para siempre."** (va en letra manuscrita, Caveat).
- Hero de la home: "Tu hijo, protagonista de una historia única." y el botón "Elegir para quién es", que baja a las tres entradas por público.
- CTA principal: **"Crear una vista previa gratis"**.
- Checkout: "Elige cómo quieres recibir su historia".

## Reglas de honestidad (no negociables)

- Nada de testimonios, cifras ("miles de familias") ni reseñas inventadas: solo reales y verificables.
- No prometer envíos, plazos ni calidad que no estén medidos ("envío a todo el mundo" no: solo los países activos).
- Las maquetas de branding (portadas "Emilia", "Mateo", etc.) son conceptuales: **no se publican como libros reales**. Los ejemplos del sitio salen del pipeline real (fase 07).
- No posicionar la IA como protagonista del copy ("La IA crea su historia" no; "Elige una aventura" sí).

## Producto: aventura + enseñanza

Cada cuento combina una **aventura** (escenario) con una **enseñanza** (el mensaje): compartir, valentía, llega un hermanito, dormir solo… o un mensaje propio del adulto. Comunicarlo como "Un cuento para cada momento". El mensaje se transmite con lo que el héroe vive, **nunca con sermones ni moralejas explícitas**.

## Paleta (tokens en `apps/web/src/app/globals.css`)

| Token                                 | Hex                   | Uso                                           |
| ------------------------------------- | --------------------- | --------------------------------------------- |
| `--background`                        | `#FFF8F1`             | Crema de fondo                                |
| `--card`                              | `#FFFFFF`             | Tarjetas, formularios, checkout               |
| `--muted`                             | `#FBF1E8`             | Bloques suaves                                |
| `--foreground` / `--navy`             | `#26324A`             | Texto, foco y pie                             |
| `--muted-foreground`                  | `#555C6E`             | Texto secundario                              |
| `--action` / `--action-hover`         | `#FFB6A7` / `#FF9F8A` | **Botón principal** (durazno), con texto navy |
| `--primary`                           | `#A33F33`             | Coral tinta: enlaces y acentos de texto       |
| `--sage`                              | `#8AC8BC`             | Salvia: confianza, Familias                   |
| `--lavender` / `--secondary`          | `#E6DDF6`             | Lavanda: fondos, badges, Profesionales        |
| `--peach` `--mint` `--sky` `--butter` | pasteles              | Solo fondos, **nunca** texto                  |
| `--success`                           | `#245D4F`             | Íconos de confianza sobre menta               |

Contrastes verificados (WCAG 2.2 AA): navy sobre durazno 7,6:1 (hover 6,5:1) · navy sobre crema 12,2:1 · coral sobre crema 6,0:1 · coral sobre lavanda 4,8:1 · blanco sobre coral 6,3:1 · secundario sobre crema 6,3:1 y sobre lavanda 5,1:1.

**Un tono por público** (`AUDIENCE_TONES` en `site-header.tsx`), solo de contexto; el botón de acción es el mismo en todo el sitio:

| Público              | Punto     | Fondo     | Texto     |
| -------------------- | --------- | --------- | --------- |
| Familias             | `#5FAE9F` | `#E4F3EF` | `#2F6F66` |
| Cumpleaños y eventos | `#FF8F7A` | `#FFE7DF` | `#A33F33` |
| Profesionales        | `#8C79C9` | `#EEE8FA` | `#5B4A99` |

## Tipografía (`apps/web/src/lib/fonts.ts`, con `next/font`)

- **Quicksand** (600 y 700): interfaz, botones, menú y títulos.
- **Lora**: texto de lectura y el texto de los libros en el visor.
- **Caveat**: solo para frases manuscritas cortas (lema, rótulos de fotos). Nunca para párrafos.

## Componentes

- Botones tipo píldora, mínimo 44 px de alto, durazno con texto navy en Quicksand bold.
- Tarjetas blancas con borde fino `#EFE3D8` y sombra suave.
- Logo: palabra "StoryNido" en navy con dos corazones (durazno y salvia). Favicon: círculo navy con los corazones. **Pendiente: logo definitivo de diseñador y búsqueda de marca registrada.**
- Hero: polaroid grande de la foto ("Su foto", en Caveat) sobre el libro ilustrado.
- Pie navy, sin selector de país (la venta es global y el envío se calcula por país). El idioma se detecta por IP y se cambia en el pie o en "Mi cuenta".

## Dentro de los libros: dirección de arte

La marca del sitio es suave; los libros llevan **colores ricos y memorables**. Cada prompt de imagen termina con un bloque fijo (`artDirection` en `packages/shared/src/models/art-direction.ts`) que el admin no puede quitar:

- **Paleta por historia** (campo `palette`, editable en el admin; si falta, la del público): `magic`, `adventure`, `bedtime`, `nature`, `celebration` y `learning`, con 5 HEX cada una.
- **Criterio por edad:** 2–3 personajes grandes y fondos simples; 4–5 color y una acción clara; 6–8 composición cinematográfica; 9–12 más dramatismo, nada aniñado.
- **Encuadre con intención** (plano general, medio, primer plano emocional) y el protagonista como foco.
- **Qué evitar:** caras fotográficas, piel plástica, brillo excesivo, 3D genérico, anatomía rara, objetos al azar, texto en la imagen y cambios de estilo entre páginas.
- La dirección queda guardada en la muestra y se congela en el pedido: **el libro final se ilustra igual que la muestra aprobada.**
- No se copian estilos de ilustradores ni personajes protegidos.

## Movimiento

Flotación suave del libro del hero (CSS), transiciones de 150 a 250 ms. Siempre respetar `prefers-reduced-motion`. **Sin animaciones continuas en el checkout.**

## Pendiente

- Aplicar la v3 al admin y a los emails.
- Tipografía v3 en el PDF del libro.
- Libros de ejemplo por estilo para la muestra (aprobado, ~USD 3).
- Portadas del catálogo regeneradas con la dirección de arte nueva, después de la prueba antes/después.
- Fotos y video del libro impreso real.
