# StoryNido · Marca y sistema visual

Resumen operativo de la guía de marca v2 ("magia editorial + confianza") aprobada el 2026-10-26, y de cómo está implementada. La guía completa la tiene el equipo de producto.

## Posicionamiento

- Vendemos un **regalo afectivo** donde el niño se reconoce como héroe, no "un generador de cuentos con IA".
- La marca le habla **al adulto** (padres, abuelos, padrinos); la ilustración le habla al niño.
- Promesa: un cuento bonito y personal, con **vista previa gratis** antes de pagar.

## Voz

- Cálida, cercana, imaginativa, clara y segura. Adulto accesible, no tono de jardín.
- **Español neutro con "tú"** (México, EE. UU. hispano, Latinoamérica). Nunca voseo en el sitio.
- Lema: **"Historias que abrazan"** · EN: "Stories that hug" · PT: "Histórias que abraçam".
- Hero: "Tu hijo es el héroe de esta historia." / "Un cuento único con su nombre, su carita y las aventuras que siempre soñó."
- CTA principal: **"Crear una vista previa gratis"**.
- Checkout: "Elige cómo quieres recibir su historia".

## Reglas de honestidad (no negociables)

- Nada de testimonios, cifras ("miles de familias") ni reseñas inventadas: solo reales y verificables.
- No prometer envíos, plazos ni calidad que no estén medidos ("envío a todo el mundo" no: solo los países activos).
- Las maquetas de branding (portadas "Emilia", "Mateo", etc.) son conceptuales: **no se publican como libros reales**. Los ejemplos del sitio salen del pipeline real (fase 07).
- No posicionar la IA como protagonista del copy ("La IA crea su historia" no; "Elige una aventura" sí).

## Paleta (tokens en `apps/web/src/app/globals.css`)

| Token                                          | Hex                                               | Uso                                  |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `--background`                                 | `#FAF0E5`                                         | Fondo crema / papel                  |
| `--card`                                       | `#FFFFFF`                                         | Tarjetas, formularios, checkout      |
| `--muted`                                      | `#F8F3FA`                                         | Bloques suaves                       |
| `--foreground`                                 | `#342A40`                                         | Texto                                |
| `--muted-foreground`                           | `#69616C`                                         | Texto secundario                     |
| `--primary`                                    | `#79518C`                                         | Botón principal, enlaces             |
| `--primary-hover`                              | `#613B75`                                         | Hover                                |
| `--secondary` / `--accent`                     | `#EADCF2`                                         | Lavanda de marca, badges, destacados |
| `--peach` `--mint` `--sky` `--butter` `--rose` | `#F5D9C9` `#DDF1E8` `#E1EFFA` `#FBEDC6` `#F9E3ED` | Solo fondos                          |
| `--success`                                    | `#245D4F`                                         | Íconos de confianza sobre menta      |
| `--ring`                                       | `#7A4DB1`                                         | Foco                                 |

Proporción orientativa: 60 % crema/blanco, 30 % pasteles, 10 % violeta. Los pasteles **nunca** son color de texto.

Contrastes verificados (WCAG 2.2 AA): blanco sobre violeta 6,2:1 · tinta sobre crema 12:1 · secundario sobre crema 5,3:1 · violeta sobre crema 5,5:1 · violeta sobre lavanda 4,75:1.

## Tipografía

- Títulos: **Fraunces** 600 (`font-display`), interletrado -0,035 em.
- Interfaz y texto: **Nunito Sans** (400 a 900).
- Se cargan con `next/font` (servidas desde el sitio), no con `@import`.

## Componentes

- Botones tipo píldora, altura mínima 44 px, violeta con sombra suave; leve elevación al pasar el mouse (sin movimiento si el usuario lo desactivó).
- Tarjetas blancas, borde `#E7DFE9`, radio 1,6 rem, sombra `--shadow-card`.
- Pasos numerados en cuadrado lavanda con número violeta.
- Íconos de contorno redondeado (lucide), confianza sobre menta.
- Logo provisorio: estrella de 4 puntas sobre lavanda + "StoryNido" en Nunito Sans Black violeta. **Pendiente: logo definitivo de diseñador y búsqueda de marca registrada.**

## Movimiento

Flotación suave del libro del hero (CSS), transiciones de 150 a 250 ms. Siempre respetar `prefers-reduced-motion`. **Sin animaciones continuas en el checkout.**

## Pendiente de la guía

- Ilustración de acuarela del hero (`hero-acuarela-muestra.webp`): reemplaza el libro con portadas SVG cuando esté el archivo original.
- Portadas reales en acuarela generadas por el pipeline (fase 07).
- Wizard (fase 06) y checkout (fase 11) con este sistema: un objetivo por pantalla, progreso visible, checkout sereno.
- Experimentos de copy y CTA (A/B) cuando haya tráfico.
