// Almacenamiento de imágenes de productos.
//
// La aplicación guarda en SQL Server únicamente la ruta pública del archivo
// (por ejemplo /uploads/products/producto-....jpg). El archivo físico vive en
// un almacenamiento intercambiable detrás de este módulo.
//
// Controlador local (por defecto):
//   STORAGE_DRIVER=local
//   UPLOAD_DIR=<ruta opcional>  (por defecto backend/uploads/products)
//
// Limitación importante: el disco local no es persistente en plataformas
// serverless (por ejemplo Vercel). Para producción se debe implementar otro
// controlador (Azure Blob Storage, S3, etc.) respetando esta misma interfaz
// (guardarImagen / eliminarImagen / esRutaLocal) y definir STORAGE_DRIVER.
// Las rutas guardadas en SQL Server no cambian si el proveedor sirve el mismo
// prefijo público.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DRIVER = (process.env.STORAGE_DRIVER || "local").toLowerCase();

const PREFIJO_PUBLICO = "/uploads/products";

const EXTENSION_POR_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// backend/src/storage → backend/uploads/products
const DIRECTORIO_LOCAL = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "..", "..", "uploads", "products");

const NOMBRE_ARCHIVO_VALIDO = /^producto-\d+-[0-9a-f-]{36}\.(jpg|png|webp)$/;

let directorioListo = false;

const asegurarDirectorio = () => {
  if (directorioListo) return;

  fs.mkdirSync(DIRECTORIO_LOCAL, { recursive: true });
  directorioListo = true;
};

// Guarda un buffer ya validado y devuelve la ruta pública que se almacena
// en SQL Server. El nombre lo genera el servidor: nunca se usa el nombre
// enviado por el usuario.
const guardarImagen = async ({ buffer, mimetype }) => {
  if (DRIVER !== "local") {
    throw new Error(
      `STORAGE_DRIVER="${DRIVER}" no está implementado. Use "local" o agregue un controlador compatible.`
    );
  }

  const extension = EXTENSION_POR_MIME[mimetype];

  if (!extension) {
    throw new Error("Formato de imagen no permitido");
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("El contenido de la imagen está vacío");
  }

  asegurarDirectorio();

  const nombre = `producto-${Date.now()}-${crypto.randomUUID()}${extension}`;
  const destino = path.join(DIRECTORIO_LOCAL, nombre);

  // flag "wx" evita sobrescribir un archivo existente.
  await fs.promises.writeFile(destino, buffer, { flag: "wx" });

  return {
    nombre,
    ruta: `${PREFIJO_PUBLICO}/${nombre}`,
  };
};

// Indica si la ruta corresponde al almacenamiento local administrado.
// Las URL externas (http/https) o rutas heredadas de web/public no se tocan.
const esRutaLocal = (ruta) =>
  typeof ruta === "string" && ruta.startsWith(`${PREFIJO_PUBLICO}/`);

// Elimina un archivo local. Devuelve true solo si se eliminó.
// Nunca elimina rutas externas ni permite salir del directorio de uploads.
const eliminarImagen = async (ruta) => {
  if (DRIVER !== "local" || !esRutaLocal(ruta)) {
    return false;
  }

  const nombre = path.basename(ruta);

  if (!NOMBRE_ARCHIVO_VALIDO.test(nombre)) {
    return false;
  }

  try {
    await fs.promises.unlink(path.join(DIRECTORIO_LOCAL, nombre));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

// Configuración para servir los archivos mediante una ruta controlada.
const obtenerConfiguracionServido = () => {
  if (DRIVER !== "local") return null;

  asegurarDirectorio();

  return {
    prefijo: PREFIJO_PUBLICO,
    directorio: DIRECTORIO_LOCAL,
  };
};

module.exports = {
  DRIVER,
  PREFIJO_PUBLICO,
  EXTENSION_POR_MIME,
  guardarImagen,
  eliminarImagen,
  esRutaLocal,
  obtenerConfiguracionServido,
};
