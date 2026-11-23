// Resolución de rutas de imágenes de productos.
//
// - Las imágenes nuevas se guardan como /uploads/products/archivo.jpg y las
//   sirve el backend.
// - Las rutas heredadas (por ejemplo /products/x.jpg de web/public) y las URL
//   externas se respetan tal cual.
// - NEXT_PUBLIC_ASSETS_URL permite mover los archivos a otro dominio
//   (por ejemplo Azure Blob Storage) sin cambiar los datos de SQL Server.

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const ASSETS_URL =
  process.env.NEXT_PUBLIC_ASSETS_URL || API_URL.replace(/\/api\/?$/, "");

const PREFIJO_ALMACENAMIENTO = "/uploads/";

export function resolverUrlImagen(
  ruta: string | null | undefined
): string | null {
  if (!ruta) return null;

  const limpia = ruta.trim();

  if (!limpia) return null;

  if (/^https?:\/\//i.test(limpia) || limpia.startsWith("data:")) {
    return limpia;
  }

  if (limpia.startsWith(PREFIJO_ALMACENAMIENTO)) {
    return `${ASSETS_URL}${limpia}`;
  }

  return limpia;
}
