# FerreStock360

Web y app de una ferretería académica. El cliente consulta productos, guarda favoritos, reserva existencias y elige una fecha de retiro. El equipo de la tienda administra catálogo, movimientos, pedidos y cuentas.

| Directorio | Aplicación |
| --- | --- |
| `web/` | Next.js y React. Tienda y administración desde el navegador. |
| `mobile/` | Expo y React Native. Catálogo, favoritos, perfil, compras y administración. |
| `backend/` | API REST en Express. Verifica la identidad Firebase y ejecuta las operaciones de inventario en Firestore. |

## Ejecutar en desarrollo

Usar Node.js 22 o superior compatible con las versiones fijadas y ejecutar `npm ci` en cada directorio. Iniciar cada proceso desde su carpeta.

| Directorio | Comando | Configuración local |
| --- | --- | --- |
| `backend/` | `npm start` | `.env` con `DATA_BACKEND=firestore`, `FIREBASE_PROJECT_ID`, credencial de aplicación y `FRONTEND_URLS`. El puerto predeterminado es 3001. |
| `web/` | `npm run dev` | `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:3001/api`, `NEXT_PUBLIC_FIREBASE_AUTH_ENABLED=true` y los valores públicos `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID` y `APP_ID` (todos con el prefijo `NEXT_PUBLIC_FIREBASE_`). |
| `mobile/` | `npm start` | Completar `.env` a partir de `.env.example`. En un teléfono usar `EXPO_PUBLIC_API_URL=http://IP-DEL-EQUIPO:3001/api` en la misma red. En desarrollo también se detecta el host LAN de Expo. Google Sign-In requiere una compilación nativa de desarrollo y la configuración OAuth de esa plataforma. |

Ambos clientes deben usar el mismo proyecto de Firebase y la misma API. Para subir imágenes, configurar `CLOUDINARY_CLOUD_NAME` y `CLOUDINARY_UPLOAD_PRESET` en la API y sus equivalentes `EXPO_PUBLIC_` en Expo. El servidor local usa `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un JSON ubicado fuera del repositorio. En despliegue, configurar una identidad de servidor o un secreto protegido. La ruta de un archivo en el equipo de desarrollo solo sirve en ese equipo.

## Datos y prueba de compra

`products`, `categories`, `users`, `favorites` y `activity_history` corresponden al catálogo y las cuentas compartidas. La API administra carritos, reservas, pedidos, movimientos y notificaciones. Una reserva reduce las existencias disponibles. La entrega descuenta el stock físico. La cancelación libera las unidades. El pago con tarjeta es simulado.

Desde `backend/`, `node scripts/datosAcademicos.js` crea dos productos de demostración, un pedido entregado y otro pendiente. El script conserva las existencias y el estado de los pedidos al volver a ejecutarlo. Requiere una categoría existente. Los módulos SQL siguen disponibles para instalaciones anteriores.

Para verificar ambas plataformas, entrar con una cuenta de cliente, reservar una unidad, confirmar el retiro y buscar el pedido con una cuenta administrativa desde la otra plataforma. Comprobar la disponibilidad antes y después de la reserva, la actualización del historial y el cambio de estado.

## Comprobaciones

- Web: `npm run build` y `npm run lint`.
- App: `npm run typecheck` y una prueba en dispositivo con una development build.
- Backend: `node --test tests/*.test.js`. Las pruebas que escriben en SQL necesitan la base de pruebas desechable indicada en `tests/testDatabaseConfig.js`.
