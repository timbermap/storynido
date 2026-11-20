# Activar los libros impresos

Hoy el impreso está apagado en todo el sitio (DECISIONS 295 y 297). Esta guía es lo que hay que cumplir para prenderlo, en orden. El interruptor es `print_enabled` en Terraform (`PRINT_ENABLED` en la API); apagado, nada ofrece ni cobra impresos.

## Qué no depende de código

| #   | Paso                                                                                                                                                                                                  | Quién |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Prueba de punta a punta en **staging** (sección siguiente) con Lulu sandbox: pago PayPal sandbox, PDF de impresión, pedido a la imprenta, webhook de estado y reembolso                                | 🤝    |
| 2   | PayPal en producción: app live y claves en Secret Manager (los físicos los acepta PayPal; el cobro es el mismo flujo)                                                                                 | 👤    |
| 3   | Cuenta de Lulu de producción: clave y secreto (`lulu-client-key`, `lulu-client-secret` en `storynido-prod`) y webhook con `infra/scripts/lulu-webhook.sh production <api>`; método de pago de Lulu     | 👤    |
| 4   | **Muestra física** de cada formato que se venda (tapa blanda y tapa dura; grapado si se ofrece), pedida a una dirección propia. Si el archivo y la calidad están bien, `qaSamplePassed` en Admin → Impresión | 👤    |
| 5   | Textos legales (términos, reembolsos, envíos, preguntas frecuentes) con la versión «impreso» (borrador en el doc del plan), revisados por Sebas y, de ser posible, un abogado                          | 👤    |
| 6   | Precios: verificar en Admin → Precios la comisión de PayPal (5,4 % + US$0,30) en tapa blanda, tapa dura y grapado, y que cada país tenga IVA/impuestos cargados                                        | 👤    |

## Qué cambia en código al activar

1. `infra/envs/production/main.tf`: `print_providers = ["gelato", "cloudprinter", "lulu"]` (hoy `["mock"]`) y `print_enabled = true`; `terraform apply` con OK sobre el plan.
2. Seed de producción: las opciones de impresión nacen con `qaSamplePassed: false`; se habilitan una a una en el admin tras la muestra del paso 4.
3. Publicar la API.

## Prueba de punta a punta en staging

1. `print_enabled = true` en `infra/envs/staging/main.tf`, `terraform apply` (Gelato en `draft`, Lulu en sandbox: no fabrica ni cobra).
2. Con la cuenta de prueba, crear un libro Clásico, elegir tapa blanda y enviar a **Uruguay** (Lulu cotiza sin documento), con dirección real de Google; repetir con **México** o **Brasil** con documento del destinatario.
3. Pagar con PayPal sandbox. Verificar: el pedido pasa a «generando», se arma el PDF de impresión de Lulu (páginas de relleno), se crea el trabajo en el sandbox de Lulu y llega el webhook de estado.
4. Revisar en Admin → Pedidos: costo de imprenta real contra el que se cobró, y el margen neto.
5. Reembolsar el pedido desde el admin y confirmar el mail.
6. Volver `print_enabled = false`.

## Riesgos conocidos

- El envío a Latinoamérica es caro (Argentina con Cloudprinter USD 30; el libro sale unos USD 70 con envío contra unos USD 22 el ebook).
- PayPal no devuelve su comisión en un reembolso: cada reembolso de impreso pierde esa comisión.
- Impuestos de importación en destino: los paga quien recibe; hay que decirlo en Envíos.
- Los plazos de la política (2 a 5 días de producción) no se cumplen: las cotizaciones dan de 6 a 25 días con envío.
