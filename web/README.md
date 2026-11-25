# FerreStock360 Web

Frontend Next.js de FerreStock360. La web y la aplicación móvil comparten un único backend Express y un proyecto Firebase Authentication.

## Configuración local

1. Copia `.env.example` a `.env.local`.
2. Define `NEXT_PUBLIC_API_URL` con el origen de la API y `/api`.
3. Completa las variables `NEXT_PUBLIC_FIREBASE_*` desde la configuración de la app web Firebase. Usa el mismo `projectId` configurado en móvil y backend.
4. Inicia Firebase Authentication Email/Password (y Google si se requiere) en el proyecto correspondiente.
5. Configura Firebase Admin solo en el backend. Nunca incluyas credenciales privadas en `NEXT_PUBLIC_*`.

```bash
npm install
npm run lint
npm run build
npm run dev
```

## Arquitectura de datos

El navegador usa Firebase Authentication para iniciar y cerrar sesión, recuperar contraseñas y obtener ID tokens. Las solicitudes protegidas envían el ID token a Express como Bearer token. El servidor valida el token, el UID, el estado y el rol; todos los datos de negocio se consultan y cambian mediante la API.

Catálogo, perfil, carrito, checkout, pedidos, pagos, inventario, reservas, notificaciones e historial usan la API compartida con móvil. El carrito de invitado se conserva localmente hasta que el usuario inicia sesión; en ese momento se intenta incorporar al carrito del backend.

El repositorio no despliega el frontend ni modifica datos reales de Firebase. Para validar sincronización usa un backend y Firebase Emulator o un proyecto de pruebas autorizado.
