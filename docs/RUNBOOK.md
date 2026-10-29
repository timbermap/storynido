# Operación (runbook)

Qué hacer en el día a día y cuando algo falla. Los comandos de `gcloud` llevan siempre `CLOUDSDK_ACTIVE_CONFIG_NAME=storynido` y `--project` explícito (nunca tocar otros proyectos de la cuenta).

| Ambiente   | Proyecto            | Web                                                   | Admin                                                   |
| ---------- | ------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Staging    | `storynido-staging` | https://web--storynido-staging.us-central1.hosted.app | https://admin--storynido-staging.us-central1.hosted.app |
| Producción | `storynido-prod`    | https://storynido.com (pendiente, ver `LAUNCH.md`)    | pendiente                                               |

## 1. Alertas (llegan por mail)

| Alerta                                 | Qué significa                                                                 | Qué hacer                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API caída**                          | El uptime check de `/health` falla desde varias regiones                      | Cloud Run → `api` → Revisiones: si la última revisión falla, volver a la anterior (§4). Ver los logs del arranque                                        |
| **errores 5xx en api / worker**        | Más de 5 respuestas 5xx en 5 minutos                                          | Error Reporting muestra el error y la pila. Si empezó con un deploy, volver atrás (§4)                                                                   |
| **errores en los servicios**           | Algún log de error en 5 minutos                                               | Error Reporting (agrupado por error). Un error nuevo después de un deploy: revisar ese cambio                                                            |
| **pedido en revisión manual**          | El QA de un pedido falló (`qa_failed`) o un paso agotó los reintentos         | Admin → Revisión manual. Ver las páginas y "Aprobar páginas" (vuelve al pipeline) o reembolsar (§2)                                                      |
| **pipeline atascado**                  | Un pedido lleva demasiado en el mismo paso (el vigía corre cada 30 min)       | Admin → Pedidos → el pedido: paso y error. Cloud Trace con el ID de traza del pedido muestra cada paso (§3)                                              |
| **webhooks rechazados**                | Más de 3 webhooks con firma inválida en 15 minutos                            | Si es de la imprenta o del procesador de pagos: el secreto del webhook no coincide (rotó del lado del proveedor). Si es de afuera: alguien prueba la URL |
| **presupuesto de IA cerca del límite** | El gasto de IA del día se acerca al tope                                      | Admin → IA: ver el gasto. Si es abuso, poner el sitio en "Solo vista previa" o "Mantenimiento" (§5)                                                      |
| **pico de uso de IA**                  | Muchas llamadas de IA en 30 minutos                                           | Igual que la anterior; revisar Admin → Resumen (vistas previas vs. pedidos)                                                                              |
| **Presupuesto del proyecto** (Billing) | El gasto del mes pasó el 50, 90 o 100 % (o el pronóstico va a pasar el 100 %) | Billing → Reports por servicio. Vertex AI es el más probable                                                                                             |

## 2. Pedidos

- **Reembolso:** Admin → Pedidos → el pedido → "Reembolsar" (pide motivo; queda en Auditoría). Mientras no haya procesador de pagos real, el reembolso es simulado.
- **Revisión manual:** Admin → Revisión manual. Las ilustraciones se ven solo ahí y detrás de un botón (son de un chico real).
- **Reenviar un mail:** Admin → el pedido → "Reenviar mail" (el mail del estado actual).
- **Reimpresión o recompra:** el cliente la pide desde "Mi cuenta" (reutiliza el libro aprobado, sin IA).
- **Borrado de datos de un chico o de una cuenta:** lo hace el cliente desde "Mi cuenta"; si lo pide por mail, Admin → Clientes → el cliente → "Borrar datos de los chicos a pedido" (queda en `privacyRequests`). Ver `docs/PRIVACY.md`.

## 3. Logs y trazas

- **Todo lo de un pedido:** Logs Explorer con `jsonPayload.orderId="<id>"`. Cada línea lleva la traza del pedido.
- **Traza:** Cloud Trace → Trace explorer, ID = `orderTraceId(orderId)` (sha256 del pedido, 32 hex). La API y el worker mandan un span por request muestreado; los pasos del pipeline llegan todos con la traza del pedido.
- **Errores:** Error Reporting (servicio y versión = revisión de Cloud Run).
- **Panel:** Monitoring → Dashboards → "StoryNido <ambiente>: operación": pedidos por estado, duración de pasos, llamadas de IA, errores.

## 4. Deploys y vuelta atrás

- **Staging:** automático al terminar el CI de `main` en verde (Firestore, `api` y `worker`). Web y admin: `firebase deploy --only apphosting --project storynido-staging`.
- **Producción:** al publicar un tag `v*` (por ejemplo `git tag v1.0.0 && git push --tags`) o desde Actions → Deploy → Run workflow.
- **Volver a la revisión anterior de Cloud Run:**
  ```bash
  CLOUDSDK_ACTIVE_CONFIG_NAME=storynido gcloud run revisions list --service api --region us-central1 --project <proyecto>
  CLOUDSDK_ACTIVE_CONFIG_NAME=storynido gcloud run services update-traffic api --to-revisions <revision-anterior>=100 --region us-central1 --project <proyecto>
  ```
  El próximo deploy vuelve a mandar todo el tráfico a la revisión nueva.
- **Web o admin:** Firebase console → App Hosting → el backend → Rollouts → volver a uno anterior.
- **Terraform:** siempre `plan` primero; después de un deploy, volver a planificar (un plan viejo puede revertir las imágenes de Cloud Run).

## 5. Modos del sitio (sin redeploy)

Admin → Sitio. La web lo toma en unos 15 segundos.

| Modo                  | Qué pasa                                                        |
| --------------------- | --------------------------------------------------------------- |
| **En vivo**           | Normal                                                          |
| **Solo vista previa** | Se puede crear la muestra; las compras quedan pausadas (banner) |
| **Mantenimiento**     | Página de mantenimiento; la API responde 503 salvo a los admins |

## 6. Secretos

- Se cargan con `infra/scripts/set-secret.sh <proyecto> <secreto>` (lee el valor sin mostrarlo). Nunca en el código ni en el chat.
- **Rotar:** cargar la versión nueva con el mismo script; los servicios leen `latest` en el próximo deploy o al reiniciar (forzarlo con `gcloud run services update <servicio> --update-labels rotated=<fecha>`). Después, deshabilitar la versión vieja: `gcloud secrets versions disable <n> --secret <secreto> --project <proyecto>`.
- Si una clave se filtró: rotarla del lado del proveedor primero, cargarla y deshabilitar la vieja.

## 7. Personal del panel

- Admin → Usuarios del panel: dar o quitar rol (`admin`, `superadmin`). Nadie cambia su propio rol y siempre queda al menos un superadmin.
- En producción el panel exige segundo factor (TOTP). En staging está apagado (DECISIONS 084).
