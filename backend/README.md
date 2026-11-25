# Backend unificado FerreStock360

API Express y Firebase Admin. Web y móvil envían Firebase ID tokens; Express los valida con revocación habilitada, identifica al usuario por UID y comprueba perfil/rol antes de las operaciones protegidas. `FIREBASE_API_MODE` ya no se usa.

## Variables

Configura `.env` local a partir de `.env.example`:

- `FIREBASE_PROJECT_ID`: mismo proyecto que los clientes web y móvil.
- `FIREBASE_SERVICE_ACCOUNT_JSON` o credenciales de aplicación del entorno: solo para el servidor.
- `FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST`: emuladores aislados para pruebas.
- `FRONTEND_URLS`: orígenes permitidos por CORS.
- `NEXT_PUBLIC_API_URL` y `EXPO_PUBLIC_API_URL` en los clientes apuntan a esta API con `/api`.

Nunca incluyas credenciales privadas en el frontend ni en los archivos de ejemplo. La API puede responder `/api/health` aunque Firebase no esté configurado; las operaciones de datos requieren Admin SDK.

## Colecciones del contrato local de negocio

La API conserva identificadores numéricos como alias compatibles con la web. Los perfiles nuevos se guardan en `users/{firebaseUid}` y tienen `id_usuario`; el UID es identidad y el alias numérico enlaza documentos comerciales existentes.

- Catálogo: `products`, `categories`.
- Usuarios: `users`, `roles`, `counters`, `unique_keys`.
- Carrito y reservas: `carts`, `cart_items`, `reservations`, `idempotency_keys`.
- Compras: `orders`, `order_items`, `payments`, `order_history`.
- Operaciones: `inventory_movements`, `stock_alerts`, `notifications`, `locks`.
- Cuenta: `activity_history`. Los documentos históricos de `favorites` se conservan sin endpoints de lectura o escritura para clientes.

La API acepta campos heredados de producto (`id_categoria`/`categoria_id`, `imagen_1`/`imagen_url`) mediante los servicios existentes. Las colecciones antiguas no se borran ni se migran automáticamente.

## Compatibilidad de datos anteriores

Los perfiles con UID existentes reciben un alias numérico aditivo al autenticarse. Un perfil numérico antiguo solo se vincula a una cuenta Firebase cuando el correo está verificado y hay una única coincidencia. El hash de contraseña heredado no se copia. Duplicados o cuentas sin correo verificable requieren revisión administrativa.

Los documentos Steff existentes de carritos, `inventory_holds`, pedidos y notificaciones tienen adaptadores de compatibilidad: la API puede leerlos y, para carrito/pedido heredado, continuar sus transiciones sin copiar ni borrar esos documentos. Las reservas heredadas cuentan contra el stock disponible. Si aparecen simultáneamente carritos en ambos formatos, la API devuelve `409` para evitar duplicar cantidades. Los documentos históricos de `favorites` no se consultan ni modifican.

Los registros que no cumplan los formatos conocidos requieren conciliación antes de cualquier migración. No ejecutes migraciones contra datos reales desde este proyecto; realiza exportación, ensayo aislado y aprobación por separado. Los adaptadores se pueden retirar cuando exista una migración aditiva verificada y autorizada.

## Verificación

```bash
npm test
```

Las pruebas de integración de Auth/Firestore se omiten si no están definidos los dos emuladores y `TEST_FIREBASE_PROJECT_ID`. No se usan ni modifican datos reales.
