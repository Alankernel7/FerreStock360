# Imágenes de productos (Etapa 1)

## Esquema real utilizado

La base de datos de FerreStock360 ya tenía dos columnas para imágenes:

- `productos.imagen_1` (`varchar(max)`, NULL)
- `productos.imagen_2` (`varchar(max)`, NULL)

No se agregaron ni modificaron columnas. En SQL Server solo se guarda la ruta
pública del archivo (por ejemplo `/uploads/products/producto-....jpg`), nunca
Base64 ni el archivo binario.

> Nota: los scripts `database/FerreStock360.sql` y `FerreStock360.azure.sql`
> todavía declaran `imagen_url`, pero la base real usa `imagen_1` e `imagen_2`
> (verificado contra INFORMATION_SCHEMA). El código del backend y del frontend
> trabaja con el esquema real.

## Endpoints

- `GET /api/productos?estado=activo`: catálogo público, solo activos.
- `GET /api/productos/:id?estado=activo`: detalle público. Un producto
  inactivo responde `404`.
- `GET /api/productos/:id`: si el producto está inactivo, solo responde a un
  JWT de administrador; sin credenciales responde `404`.
- `POST /api/productos` y `PUT /api/productos/:id`: aceptan JSON (comportamiento
  anterior) o `multipart/form-data` con los campos del producto más:
  - `imagen_1_file`: archivo para la imagen principal.
  - `imagen_2_file`: archivo para la imagen secundaria.
- `GET /uploads/products/<archivo>`: sirve las imágenes locales desde el
  backend con una ruta controlada.

Los campos `imagen_1` e `imagen_2` siguen enviándose en el formulario: indican
la imagen actual que se conserva. Un archivo nuevo en la ranura correspondiente
la reemplaza; un valor vacío la elimina.

## Validaciones

Frontend y backend validan:

- Formatos: JPG, JPEG, PNG y WEBP (MIME type y extensión).
- Tamaño máximo: 5 MB por imagen.
- Máximo dos imágenes por producto.
- Firma real del archivo (magic numbers) en el backend, además del MIME
  declarado.
- El nombre del archivo lo genera el servidor (`producto-<timestamp>-<uuid>.<ext>`);
  nunca se usa el nombre enviado por el usuario.

Las rutas `POST`/`PUT`/`DELETE` de productos requieren JWT con rol `admin`.

## Consistencia entre archivos y SQL Server

- Los archivos se reciben en memoria y solo se escriben después de validar los
  datos del producto.
- Si falla el `INSERT`/`UPDATE`, se eliminan los archivos recién guardados.
- Al reemplazar o quitar una imagen (o eliminar un producto) se borra el archivo
  anterior solo si ningún producto lo sigue referenciando.
- Un fallo de escritura de archivos no crea el registro en SQL Server.

## Almacenamiento local (desarrollo)

Variables opcionales del backend:

```env
STORAGE_DRIVER=local
# Por defecto: backend/uploads/products
UPLOAD_DIR=
```

La carpeta `backend/uploads/products` se crea automáticamente. Su contenido no
se versiona en Git (solo se conserva `.gitkeep`).

## Limitación de producción

El almacenamiento local del servidor **no es persistente** en despliegues
serverless como Vercel. En ese escenario las imágenes cargadas pueden perderse
al redesplegar o al cambiar de instancia. Mientras no se configure un
almacenamiento persistente, las imágenes no deben considerarse permanentes en
producción.

La aplicación está preparada para sustituir el almacenamiento sin reescribir el
módulo:

1. Implementar otro controlador compatible con
   `backend/src/storage/imageStorage.js` (`guardarImagen`, `eliminarImagen`,
   `esRutaLocal`) para Azure Blob Storage, S3 u otro proveedor gratuito.
2. Seleccionarlo con `STORAGE_DRIVER` y mantener el mismo prefijo público
   (`/uploads/products`) o servir ese prefijo desde el proveedor.
3. Si el proveedor usa otro dominio, definir `NEXT_PUBLIC_ASSETS_URL` en el
   frontend. Las rutas guardadas en SQL Server no cambian.

## Pruebas

```bash
cd backend
npm test
```

Las pruebas de integración crean productos temporales inactivos, verifican la
carga/reemplazo/eliminación de imágenes y limpian los registros al finalizar.
Requieren la conexión configurada en `backend/.env`.
