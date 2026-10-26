# @storynido/firebase

Reglas de seguridad, índices, emuladores y scripts de Firebase.

| Archivo                                            | Qué es                                                  |
| -------------------------------------------------- | ------------------------------------------------------- |
| [`firestore.rules`](firestore.rules)               | Reglas de Firestore                                     |
| [`storage.rules`](storage.rules)                   | Reglas de Storage (todo cerrado: se usan URLs firmadas) |
| [`firestore.indexes.json`](firestore.indexes.json) | Índices compuestos                                      |
| [`test/`](test/)                                   | Tests de reglas contra el emulador                      |
| [`src/seed.ts`](src/seed.ts)                       | Datos de desarrollo en los emuladores                   |
| [`src/set-role.ts`](src/set-role.ts)               | Asigna roles (custom claims)                            |

## Emuladores

Requieren Java 21+ (`brew install openjdk@21`; el script lo encuentra aunque no esté en el PATH).

```bash
pnpm emulators   # desde la raíz: Auth, Firestore, Storage y Pub/Sub + UI en http://127.0.0.1:4000
pnpm seed        # en otra terminal, con los emuladores corriendo
```

Proyecto local: `demo-storynido`. Los proyectos `demo-*` solo existen en los emuladores, así que nada de esto toca Google Cloud. Los datos se guardan en `firebase/.emulator-data/` al cerrar los emuladores (Ctrl+C).

| Emulador  | Puerto                        |
| --------- | ----------------------------- |
| UI        | 4000                          |
| Auth      | 9099                          |
| Firestore | 8180 (no 8080: lo usa la API) |
| Storage   | 9199                          |
| Pub/Sub   | 8085                          |

Usuarios del seed (inician sesión por enlace mágico; el enlace aparece en la terminal de los emuladores y en la UI):

| Email                       | Rol        |
| --------------------------- | ---------- |
| `cliente@storynido.test`    | customer   |
| `admin@storynido.test`      | admin      |
| `superadmin@storynido.test` | superadmin |

## Roles

Los roles son custom claims (`role`). Sin claim, el usuario es `customer`. Solo un script con credenciales de servidor los puede cambiar:

```bash
# Emuladores
pnpm --filter @storynido/firebase exec ./scripts/with-emulators-env.sh tsx src/set-role.ts --email vos@ejemplo.com --role admin

# Staging (primer superadmin): requiere gcloud auth application-default login
pnpm --filter @storynido/firebase set-role --project storynido-staging --email vos@ejemplo.com --role superadmin
```

El usuario tiene que haber iniciado sesión al menos una vez. El cambio queda en `auditLog` y se aplica cuando el usuario renueva su token (como máximo una hora, o al volver a iniciar sesión).

## Principios de las reglas

- Cada cliente solo lee y escribe lo suyo (`ownerUid`).
- Precios, estados, costos, pedidos, fotos, consentimientos y auditoría los escribe **solo el servidor** (Admin SDK), nunca el cliente.
- Las colecciones de configuración son de solo lectura desde el cliente: lo público solo si está activo o publicado, y lo sensible (cupones, configuración de IA, auditoría) solo para admins. Las escrituras de admins pasan por la API para quedar auditadas.
- Todo lo que no está permitido explícitamente está denegado.
