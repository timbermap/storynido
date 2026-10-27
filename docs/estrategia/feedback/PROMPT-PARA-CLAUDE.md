# PROMPT MAESTRO — Adaptar StoryNido al feedback real de compradores

**Contexto:** StoryNido es una aplicación YA AVANZADA, con arquitectura existente. Ya definimos los canales **Familias, Eventos y Profesionales**; formatos Mini/Corto/Clásico/Gran aventura, tres densidades de texto y distintos niveles de lectura. El producto **digital se ofrecerá globalmente solo en países compatibles con pagos, idioma y cumplimiento**; la impresión se activará únicamente por país/SKU con viabilidad confirmada.

**Fuentes de trabajo:** leer `INFORME-COMPLETO.md` (investigación y enlaces), `evidencia-casos.csv` (casos y limitaciones de evidencia), `qa-reglas.json` (criterios mínimos y severidad). No presentar testimonios como hechos comprobados respecto a la causa de cada incidente. Las conclusiones comerciales son hipótesis, no estadísticas.

## Restricción de arquitectura (PRIORIDAD MÁXIMA)
NO reconstruir la app ni cambiar stack, Firestore, auth, orquestación, pagos, pipeline de generación, proveedores de IA, print provider o panel admin. NO crear tres aplicaciones. NO recrear servicios existentes. Inspeccionar primero el repositorio real y proponer **adaptaciones incrementales mínimas** a los servicios ya implementados. Pedir aprobación si un cambio arquitectónico grande resultara indispensable.

## Trabajo requerido

1. **Diagnóstico concreto:** buscar funciones actuales de character consistency, preview, dedicatoria, nombres, versionado, QA imagen, QA narrativa, render, privacidad, print routing y localización. Crear tabla: hallazgo real, archivos actuales, brecha, cambio mínimo, prioridad y prueba.
2. **Priorizar fallos P0 por riesgo:** nombre incorrecto, personaje distinto, rasgos esenciales perdidos, mezcla de datos infantiles, contenido hiriente/inapropiado, texto cortado/ilegible, PDF diferente a preview, acceso a fotos de otro usuario.
3. **Adaptar generación LLM existente** para utilizar biblia de personajes y planning de páginas: atributos permitidos del protagonista, detalles familiares aprobados, arco narrativo y presupuesto de palabras por página; mantener la estructura de idioma/edad/longitud/densidad del proyecto. No inyectar datos sensibles de los niños en prompts ni logs.
4. **Adaptar generador de ilustraciones existente:** conservar rostro y rasgos claves entre poses y escenas; detectar anomalías anatómicas y discrepancias texto-imagen. No afirmar que una métrica automática certifica identidad humana; apoyarse en revisión del responsable adulto.
5. **QA editorial como etapa de aceptación:** verificar nombre y dedicatoria exactos, acentos, parentescos, vocabulario/edad, relato con conflicto y resolución, ausencia de insultos, estereotipos dañinos o promesas terapéuticas. Para Pro, todo contenido queda sujeto a validación profesional.
6. **Preview/edición sin regresiones:** permitir corrección puntual y preservación de otras páginas; crear snapshot aprobado/versionado del resultado exacto. No dejar que la versión final se modifique silenciosamente.
7. **Digital internacional:** reutilizar entrega digital actual; mejorar lector móvil/PDF si corresponde, aplicar localización regional es/en/pt con QA y permitir activación solo donde pagos/fiscalidad/datos soporten operación. No asumir que soportar un idioma habilita ventas legales automáticas.
8. **Print selectivo:** en el sistema de impresión actual, usar disponibilidad real por país + SKU, cotización, formato, envío, impuestos y muestra física comprobada. No inventar impresión local ni plazos. Mantener disabled para destinos no verificados.
9. **Eventos:** generar un master visual reutilizado para copias y productos del mismo evento, sin códigos individuales. Evitar re-generación por copia.
10. **Profesionales:** biblioteca de proyectos separados, materiales revisables, niveles de lectura/densidad configurables y privacidad de pacientes; no diagnósticos ni recomendaciones clínicas automáticas.
11. **Métricas y soporte:** añadir códigos de error de QA, datos de regeneración/costo, aprobación, reclamos, devoluciones/print issues por país y marca sin datos identificables infantiles en analytics.
12. **Tests:** usar los 24 escenarios del informe y añadir un conjunto reproducible de fixtures ficticios/sintéticos, con fotos solo con autorización. QA visual debe incluir evaluación humana de muestras. Ejecutar pruebas disponibles y reportar exactamente cuáles pasaron.

## Modo de ejecución

- Primero entregar `docs/CUSTOMER-FEEDBACK-GAP-ANALYSIS.md` con cambios mínimos sobre archivos existentes; sin reescritura masiva.
- Implementar por orden P0 -> P1 -> P2, en commits/fases verificables, asegurando compatibilidad con pedidos existentes.
- Preservar configuración del admin actual y defaults compatibles para registros existentes.
- No activar impresión sin SKU/costos/muestras, ni afirmar disponibilidad global que no esté habilitada por cumplimiento.
- Después de cada fase: archivos modificados, motivo comercial, prueba automatizada/visual ejecutada, resultados, riesgos y costo de IA adicional estimado.
- Los criterios del informe son **puntos de control propuestos**, no promesas de calidad ya alcanzadas.

**Objetivo final:** StoryNido editorialmente superior y técnicamente confiable, con pruebas que ataquen las quejas específicas encontradas, digital primero y oferta física selectiva, **sin cambiar la arquitectura actual**.
