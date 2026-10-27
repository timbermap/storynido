# PROMPT PARA CLAUDE CODE

## StoryNido — Adaptación comercial incremental de la aplicación existente

> Documento del dueño (2026-10-27), guardado sin cambios como fuente de verdad del alcance comercial.
> Cómo se aplica a las fases: `docs/STORYNIDO-GAP-ANALYSIS.md` (sección 10) y `docs/DECISIONS.md` (059).

### CONTEXTO FUNDAMENTAL

StoryNido es una aplicación que YA ESTÁ EN DESARROLLO AVANZADO y tiene una arquitectura, estructura de código, servicios, funcionalidades e integraciones existentes.

**NO QUIERO RECONSTRUIR LA APLICACIÓN NI CAMBIAR SU ARQUITECTURA.**

Quiero evolucionar el producto comercial para que aproveche la tecnología que ya desarrollamos y permita comercializar tres líneas de productos:

1. **StoryNido Familias**
2. **StoryNido Eventos**
3. **StoryNido Profesionales**

También quiero ofrecer cuentos de diferentes extensiones, cantidades de texto y niveles de lectura.

Tu trabajo consiste en adaptar el proyecto existente con cambios incrementales, reutilizando al máximo los componentes, servicios, modelos de datos, APIs, pipelines, configuraciones y diseños que ya funcionan.

---

# 1. REGLAS OBLIGATORIAS

Estas reglas tienen prioridad sobre las demás instrucciones de este documento.

### NO HACER

- NO reconstruir el proyecto desde cero.
- NO cambiar el stack tecnológico.
- NO reorganizar el monorepo ni los directorios existentes sin necesidad.
- NO reemplazar servicios de generación con IA.
- NO reconstruir el sistema de autenticación.
- NO reemplazar Firestore ni modificar innecesariamente su modelo actual.
- NO reemplazar las integraciones de pagos.
- NO reemplazar las integraciones de imprentas.
- NO crear otro panel administrativo.
- NO modificar innecesariamente el pipeline de generación de cuentos.
- NO eliminar funcionalidades existentes.
- NO romper compatibilidad con cuentos y pedidos anteriores.
- NO cambiar el branding actual.
- NO crear una aplicación separada para cada línea comercial.
- NO introducir nuevos frameworks ni dependencias importantes si las existentes resuelven la necesidad.
- NO implementar grandes refactors que no estén directamente relacionados con los requisitos comerciales.

### SÍ HACER

- Inspeccionar primero el código existente.
- Reutilizar todos los servicios y componentes posibles.
- Extender funcionalidades existentes mediante nuevos parámetros y configuraciones.
- Aprovechar el creador de cuentos actual.
- Aprovechar el catálogo y checkout actuales.
- Aprovechar el sistema de generación de imágenes y PDF actual.
- Aprovechar la gestión administrativa existente.
- Utilizar los patrones de diseño, programación y organización ya establecidos.
- Implementar cambios pequeños, compatibles y verificables.
- Agregar configuraciones al admin existente cuando corresponda.
- Mantener compatibilidad con los productos anteriores.
- Añadir pruebas para las funcionalidades nuevas.

**Si una función ya existe, adaptala; no construyas otra en paralelo.**

Antes de modificar cualquier servicio central, comprobá si el requisito se puede resolver simplemente mediante configuración, parámetros opcionales o componentes existentes.

Si considerás imprescindible un cambio arquitectónico importante, documentá el motivo y la alternativa incremental; no lo ejecutes sin mi aprobación.

---

# 2. NUEVA ESTRATEGIA COMERCIAL

StoryNido tendrá tres líneas comerciales visibles para el cliente.

Estas líneas deben compartir la aplicación, los servicios y la infraestructura existentes.

## A. STORYNIDO FAMILIAS

Es la evolución de la tienda actual.

Propuesta comercial:

**"Tu hijo es el protagonista de su propia historia."**

Productos:

- Mini cuentos personalizados.
- Cuentos cortos.
- Cuentos clásicos.
- Grandes aventuras.
- Libros para colorear.
- Cuentos con actividades.
- Formatos digitales e impresos.

Mantener todas las opciones actuales de personalización, incluyendo fotografías, personajes, dedicatorias, gustos, temática y estilos de ilustración, según lo que ya esté implementado.

Agregar solamente los controles que falten para seleccionar:

- Extensión del cuento.
- Cantidad de texto.
- Nivel de lectura.
- Tipo de contenido.

La experiencia debe seguir siendo sencilla para padres y familiares.

No convertir el configurador en un formulario técnico.

## B. STORYNIDO EVENTOS

Propuesta comercial:

**"Recuerdos mágicos para compartir en cada celebración."**

Inicialmente enfocado en cumpleaños infantiles.

Productos:

- Mini cuentos de cumpleaños.
- Mini libros para colorear.
- Kits de actividades.
- Invitaciones.
- Tarjetas de agradecimiento.
- Etiquetas y stickers imprimibles.
- Souvenirs para las bolsitas.

### Regla comercial más importante

**UN DISEÑO, MUCHAS COPIAS.**

Ejemplo:

Un padre quiere 30 libritos de cumpleaños con el nombre e ilustración de Mateo.

La aplicación genera un único diseño aprobado y permite comprar 30 ejemplares idénticos.

NO generar 30 historias diferentes.

NO generar 30 conjuntos de ilustraciones.

NO crear cuentas individuales para los invitados.

NO implementar códigos corporativos.

Reutilizar el sistema de creación actual y agregar una experiencia de selección de productos para eventos.

### Datos necesarios

- Tipo de evento.
- Nombre del protagonista.
- Edad.
- Fecha.
- Temática.
- Fotografía opcional.
- Estilo de ilustración.
- Productos del kit.
- Cantidad de unidades.
- Entrega digital o impresa.

La versión digital debe generar archivos imprimibles con tamaños adecuados.

La versión física deberá utilizar el sistema de impresión existente, cuando el proveedor soporte el producto y la cantidad requerida.

Si no existe una opción de producción física válida, mostrar únicamente la versión digital o solicitar cotización, sin inventar disponibilidad.

## C. STORYNIDO PROFESIONALES

Propuesta comercial:

**"Historias únicas para acompañar cada aprendizaje y cada etapa."**

Dirigido a:

- Psicólogos infantiles.
- Psicopedagogos.
- Profesores particulares.
- Docentes.
- Fonoaudiólogos.
- Odontólogos infantiles.
- Otros profesionales que trabajan con niños.

### Modelo de negocio

Un mismo profesional utiliza su cuenta para crear y comprar cuentos de diferentes niños en diferentes momentos.

Ejemplo:

Una psicopedagoga crea un cuento para Sofía.

Después crea uno para Mateo.

Más adelante compra otro para Lucas.

Cada proyecto es independiente, pero todas las compras pertenecen a la misma cuenta profesional.

**NO necesitamos códigos de regalo, cuentas para cada niño ni sistemas corporativos.**

Reutilizar el sistema actual de usuarios y pedidos.

Agregar un atributo o mecanismo equivalente para identificar una cuenta profesional, siguiendo el modelo de datos y autenticación existentes.

El profesional debe poder:

- Crear cuentos nuevos.
- Elegir colecciones educativas.
- Seleccionar extensión y densidad de texto.
- Configurar nivel de lectura.
- Comprar productos digitales o físicos.
- Acceder a pedidos anteriores.
- Repetir configuraciones cuando corresponda.
- Recibir descuentos comerciales por recurrencia.

No crear un sistema de gestión clínica.

No solicitar diagnósticos ni historias clínicas.

Cuando sea posible, identificar los proyectos infantiles mediante alias, con mínima información personal.

La inclusión de fotografías u otros datos identificables de menores debe requerir la autorización correspondiente y respetar las reglas de privacidad existentes.

---

# 3. DIFERENTES EXTENSIONES DE CUENTOS

Actualmente queremos ofrecer cuatro formatos comerciales.

| Formato       | Páginas interiores objetivo |
| ------------- | --------------------------- |
| Mini          | 8–12                        |
| Corto         | 16                          |
| Clásico       | 24                          |
| Gran aventura | 32                          |

Estos valores deben poder configurarse desde el sistema administrativo existente cuando sea posible.

Revisar cómo se determina hoy la cantidad de páginas.

Si ya hay un mecanismo equivalente, extenderlo.

No crear un segundo sistema de conteo de páginas.

El número debe contemplar la estructura editorial: páginas narrativas, dedicatorias, actividades y otros elementos.

Para los libros físicos, validar las restricciones reales de cada imprenta.

No asumir que todos los formatos digitales pueden imprimirse.

---

# 4. CANTIDAD DE TEXTO INDEPENDIENTE DE LA EXTENSIÓN

Este cambio es esencial.

La cantidad de páginas NO debe determinar automáticamente cuánto texto contiene cada página.

Agregar tres opciones:

### Muy visual

- Objetivo de 5–20 palabras por página narrativa.
- Ilustraciones protagonistas.
- Frases simples.
- Adecuado para primeros lectores y libros visuales.

### Equilibrado

- Objetivo de 25–60 palabras por página narrativa.
- Historia desarrollada.
- Equilibrio entre imágenes y texto.
- Opción predeterminada para Familias.

### Más lectura

- Objetivo de 70–120 palabras por página narrativa.
- Historias más desarrolladas.
- Más narración.
- Pensado para lectores que disfrutan textos extensos.

Los valores son rangos orientativos y deben ajustarse a la edad, nivel de lectura, idioma, páginas realmente narrativas y posibilidades de maquetación.

**Los parámetros de extensión y cantidad de texto deben funcionar de forma independiente.**

Ejemplo:

Un cuento de 24 páginas puede tener 15 palabras por página o 90 palabras por página.

El sistema debe adaptar la generación y la maquetación sin desbordar el diseño.

---

# 5. NIVEL DE LECTURA

Agregar tres niveles:

- Inicial.
- En desarrollo.
- Avanzado.

Estos niveles ajustarán:

- Vocabulario.
- Complejidad de las oraciones.
- Dificultad de comprensión.
- Estructura de las historias.
- Repetición de palabras.
- Complejidad de actividades.

El nivel de lectura debe ser independiente de la edad, la extensión y la densidad.

No reemplazar los prompts actuales innecesariamente.

Adaptar el mecanismo actual de generación para recibir estos parámetros, respetando su arquitectura y validaciones.

---

# 6. TIPOS DE CONTENIDO

Agregar o extender la clasificación de productos para contemplar:

- Cuento ilustrado.
- Libro para colorear.
- Libro de actividades.
- Cuento combinado con actividades.

### Cuentos

Utilizar el motor de generación existente.

### Libros para colorear

Producir ilustraciones con contornos limpios, adecuados para colorear.

No limitarse a transformar automáticamente una acuarela a blanco y negro.

Reutilizar personajes y composiciones existentes cuando resulte adecuado.

### Actividades

Incluir juegos y ejercicios según plantillas aprobadas.

Para contenido educativo, permitir al profesional seleccionar objetivos generales.

No presentar materiales generados como diagnósticos o intervenciones clínicas automáticamente validadas.

### Formato mixto

Permitir intercalar páginas narrativas y actividades dentro del mismo libro, respetando el número total de páginas.

---

# 7. PLANTILLAS REUTILIZABLES

Aprovechar el sistema actual de historias y plantillas.

La biblioteca debe poder diferenciar:

- Plantillas de Familias.
- Plantillas de Eventos.
- Plantillas de Profesionales.
- Plantillas compartidas entre varios canales.

Evitar duplicar una plantilla simplemente porque se vende en otra categoría.

Agregar metadatos solo cuando sean necesarios, tales como:

- Canal de venta.
- Categoría.
- Edades recomendadas.
- Niveles de lectura.
- Extensiones compatibles.
- Densidades de texto.
- Tipos de productos disponibles.
- Idiomas.
- Personalización admitida.

### Colecciones de Profesionales

Incluir inicialmente:

**¡Qué lindo es aprender!**

- Lectura.
- Letras.
- Números.
- Curiosidad.
- Hábitos de estudio.

**Conozco mis emociones**

- Reconocer emociones.
- Expresar necesidades.
- Cambios cotidianos.
- Vínculos.

**Mis pequeños logros**

- Perseverancia.
- Aprender nuevas habilidades.
- Pedir ayuda.
- Reconocer progresos.

**Mi primera experiencia**

- Visita al dentista.
- Primer día de clases.
- Nuevas situaciones.

Las colecciones deben poder editarse desde el admin existente.

---

# 8. PRECIOS Y DESCUENTOS

Aprovechar el sistema comercial y de precios existente.

No crear otro PricingEngine si ya hay lógica de precios funcional.

Agregar soporte para diferenciar precios según:

- Canal comercial.
- Tipo de producto.
- Extensión.
- Formato.
- Nivel de personalización.
- Cantidad de copias.
- País.
- Moneda.
- Descuento profesional.

## Precios de Familias

Compra tradicional de productos individuales.

El precio debe contemplar el costo real de generación y producción.

## Precios de Eventos

Separar conceptualmente:

- Costo de creación del diseño.
- Licencia digital.
- Cantidad de ejemplares físicos.
- Impresión y envío.

Generar el diseño una vez, aunque se vendan múltiples unidades.

## Precios Profesionales

Agregar descuentos automáticos basados en compras previas elegibles de la misma cuenta.

Propuesta inicial configurable:

| Compras elegibles en 90 días | Beneficio       |
| ---------------------------- | --------------- |
| 1–4                          | Precio Pro base |
| 5–9                          | 10%             |
| 10–19                        | 15%             |
| 20 o más                     | 20%             |

No fijar estas reglas definitivamente: deben ser modificables desde el panel de administración.

El descuento se aplica a compras futuras, sin cambiar retroactivamente pedidos anteriores.

Controlar cancelaciones, reembolsos y duplicaciones.

El descuento nunca debe hacer que se venda un producto físico por debajo del margen mínimo configurado.

En productos digitales podría permitirse una política de descuentos más generosa.

**No implementar suscripciones obligatorias.**

---

# 9. CAMBIOS EN LA EXPERIENCIA DEL USUARIO

Reutilizar la home, navegación, catálogo, creador, checkout y cuenta existentes.

Incorporar las tres líneas comerciales de forma clara.

### Navegación propuesta

- Familias.
- Eventos.
- Profesionales.

La tienda actual de libros debe convertirse naturalmente en Familias, sin eliminar sus rutas ni romper enlaces existentes.

Para Eventos, crear una entrada comercial que lleve al creador reutilizado, parametrizado para kits y productos de cumpleaños.

Para Profesionales, crear una entrada comercial que explique los beneficios y lleve al catálogo de plantillas educativas.

La navegación y el configurador deben mantener la identidad visual actual:

- Crema cálido.
- Violeta.
- Pasteles.
- Acuarelas.
- Estética editorial premium.

No realizar un rediseño global.

No crear un segundo wizard si se puede adaptar el existente mediante parámetros o pasos condicionales.

---

# 10. PANEL DE ADMINISTRACIÓN

**Extender el panel existente, no construir uno nuevo.**

Incorporar solamente las opciones administrativas que falten para gestionar:

- Canales comerciales.
- Categorías y colecciones.
- Extensión de libros.
- Cantidad de texto.
- Niveles lectores.
- Tipos de contenido.
- Plantillas.
- Precios por producto y canal.
- Descuentos Profesionales.
- Cantidades para Eventos.
- Disponibilidad digital e impresa.
- Costos de generación y márgenes.

Mantener el dashboard, configuración de IA, pedidos, clientes, países, proveedores y demás funcionalidades actuales.

En analytics, agregar filtros o métricas para diferenciar:

- Ventas Familias.
- Ventas Eventos.
- Ventas Profesionales.
- Compras recurrentes de profesionales.
- Ticket promedio.
- Costo por producto.
- Contribución por canal.
- Formatos más vendidos.
- Extensiones y densidades más elegidas.

Reutilizar la infraestructura analítica existente.

---

# 11. CONSERVAR GENERACIÓN, PAGOS E IMPRESIÓN

Estos sistemas ya forman parte del proyecto.

No reemplazarlos.

### Generación

Adaptar las entradas del pipeline existente a los parámetros editoriales nuevos.

Mantener los controles de calidad, límites de regeneración, seguridad y seguimiento de costos.

### Pagos

Reutilizar PaymentProvider, checkout, webhooks y registros de pedidos existentes.

No implementar nuevos proveedores de pagos como parte de esta modificación comercial.

Los nuevos productos deben utilizar los medios de pago que estén configurados y disponibles en la aplicación.

### Impresión

Reutilizar PrintProvider y el flujo de producción existente.

Agregar soporte para cantidades de copias idénticas solo si hace falta.

No enviar a imprenta productos incompatibles con sus especificaciones.

Mantener aprobación de diseño y verificación de pago antes de producir.

---

# 12. COMPATIBILIDAD Y SEGURIDAD

Las funcionalidades existentes son prioritarias.

Todos los cambios deben conservar:

- Cuentas actuales.
- Pedidos históricos.
- Libros generados anteriormente.
- PDFs anteriores.
- Precios y monedas configurados.
- Estados del pipeline.
- Integraciones activas.
- Configuraciones del panel administrativo.

Si es necesario modificar esquemas, hacerlo de forma compatible con los documentos existentes.

Utilizar valores predeterminados para datos antiguos.

No ejecutar migraciones destructivas.

No incorporar información identificable de menores a eventos analíticos o logs.

Conservar los controles existentes de privacidad, borrado de fotografías y acceso a contenidos.

---

# 13. PLAN DE IMPLEMENTACIÓN INCREMENTAL

Antes de comenzar, realizá una inspección concreta del repositorio.

Necesito que identifiques:

1. Qué funcionalidades ya existen.
2. Qué funcionalidades cubren parcialmente esta estrategia.
3. Qué modificaciones puntuales son necesarias.
4. Qué componentes podemos reutilizar directamente.
5. Qué cambios pueden realizarse sin tocar servicios centrales.

Prepará un plan breve de archivos y componentes a modificar.

**No quiero una auditoría arquitectónica extensa ni propuestas de reconstrucción.**

Quiero un plan de adaptación comercial sobre lo que ya existe.

### Fase A: opciones editoriales

Agregar extensión, densidad de texto y nivel de lectura al creador y a los servicios existentes.

Validar PDF, vista previa y compatibilidad con los productos actuales.

### Fase B: tres líneas comerciales

Adaptar navegación y catálogo para Familias, Eventos y Profesionales.

Reutilizar componentes y rutas cuando sea posible.

### Fase C: Eventos

Agregar kits descargables, diseño maestro reutilizable y selección de cantidades.

Mantener impresión física como función condicionada a disponibilidad real del proveedor.

### Fase D: Profesionales

Agregar identificación de cuenta Pro, colecciones educativas y descuentos recurrentes.

Permitir múltiples compras independientes desde la misma cuenta.

### Fase E: administración y métricas

Agregar únicamente las configuraciones faltantes al admin y adaptar la analítica existente.

### Fase F: pruebas

Ejecutar las pruebas disponibles y agregar las necesarias para:

- Compatibilidad de pedidos anteriores.
- Diferentes longitudes y densidades.
- Niveles de lectura.
- Reutilización de diseños de Eventos.
- Descuentos de Profesionales.
- Cálculo de precios.
- PDF digital.
- Compatibilidad de impresión.
- Seguridad y acceso a datos.

No declarar pruebas como aprobadas si no fueron ejecutadas.

---

# 14. QUÉ NO DESARROLLAR

Quedan expresamente fuera de esta etapa:

- Corporate gifting con códigos individuales.
- Portales para empresas.
- Plataformas white-label.
- Sistemas escolares institucionales.
- Integraciones con restaurantes.
- Integraciones con hoteles.
- Un CRM nuevo.
- Un nuevo backend.
- Un nuevo motor de generación.
- Un nuevo sistema de pagos.
- Un sistema de suscripciones nuevo.
- Una aplicación móvil independiente.
- Refactors generales sin beneficio comercial directo.

---

# 15. RESULTADO ESPERADO

Al finalizar quiero tener **la aplicación StoryNido actual, evolucionada comercialmente**, sin cambios innecesarios en su arquitectura.

Debe permitir:

**Familias:** comprar cuentos personalizados de diferentes extensiones y niveles de lectura, digitales o impresos.

**Eventos:** crear una sola vez un diseño de cumpleaños y utilizarlo para varios productos o múltiples unidades.

**Profesionales:** utilizar una misma cuenta para crear y comprar cuentos para distintos niños, con colecciones específicas y descuentos comerciales por compras recurrentes.

Todo debe funcionar utilizando al máximo los servicios existentes.

## INSTRUCCIÓN FINAL

Trabajá directamente sobre mi repositorio actual.

Primero inspeccioná el código real y comprobá qué ya está implementado. No asumas que una función falta sin buscarla.

Prepará una lista concreta de los cambios mínimos y ejecutalos por fases, verificando que cada fase funcione.

**Tu prioridad es adaptar la estrategia comercial, NO rediseñar la arquitectura.**

Si un cambio se puede resolver agregando una configuración a un componente existente, hacelo así.

Si una funcionalidad puede reutilizar un servicio actual, reutilizalo.

Si una propuesta exige un cambio arquitectónico importante, detené solamente esa parte, explicá el motivo y presentá una alternativa conservadora.

No reescribas lo que ya funciona.

Al terminar, entregá un resumen de las funcionalidades comerciales incorporadas, los archivos modificados, las pruebas realizadas y las limitaciones pendientes.
