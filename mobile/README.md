# FerreStock360 Mobile

Aplicación React Native + Expo. Web y móvil usan el mismo proyecto de Firebase Authentication y la misma API Express para las operaciones de negocio. El cliente móvil no consulta ni modifica Cloud Firestore directamente.

## Configuración

1. Copia `.env.example` a `.env`.
2. Completa `EXPO_PUBLIC_FIREBASE_*` con la configuración de una app web registrada en el mismo proyecto Firebase usado por la web y el backend.
3. Define `EXPO_PUBLIC_API_URL` con la URL de la API y el sufijo `/api`. En desarrollo con Expo, el fallback usa el host de Metro y el puerto `3001`.
4. Habilita Email/Password en Firebase Authentication. Google Sign-In requiere también sus Client IDs y una development build.
5. Configura el backend con el mismo `FIREBASE_PROJECT_ID` y credenciales Firebase Admin en el entorno del servidor. No copies credenciales Admin al cliente.

No publiques las reglas locales de Firestore hasta revisar y aprobar el cambio del proyecto Firebase destino. `firestore.rules` bloquea lecturas y escrituras directas desde clientes; Firebase Admin accede desde Express. Este repositorio no despliega reglas ni modifica Firebase.

## Desarrollo

```bash
npm install
npm run typecheck
npx expo start
```

Define `EXPO_PUBLIC_API_URL` como una dirección alcanzable desde el dispositivo, por ejemplo la IP local del equipo de desarrollo, no `localhost` del teléfono.

## Datos y seguridad

Firebase Authentication proporciona el UID y el ID token. La app envía ese token en `Authorization: Bearer …`; Express lo valida con Firebase Admin y comprueba estado y rol en el perfil `users/{uid}`.

Perfil, actividad, productos, categorías, carrito, checkout, pedidos, inventario y notificaciones se leen o modifican mediante la API compartida. Los cambios desde la web y móvil se guardan en las colecciones que usa el backend.

La autenticación del cliente requiere valores `EXPO_PUBLIC_*`. La cuenta de servicio y cualquier clave privada solo van en las variables seguras del backend. No ejecutes el script de datos de demostración contra un proyecto real; úsalo solo con un entorno aislado autorizado.

## Pruebas

- `npm run typecheck` revisa TypeScript.
- La validación funcional entre clientes requiere un backend y un proyecto/emulador Firebase de prueba.
- El cliente no hace migraciones de Firestore.
