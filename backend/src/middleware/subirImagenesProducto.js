// Middleware de carga de imágenes de productos.
//
// - Recibe máximo dos archivos, uno por ranura: imagen_1_file e imagen_2_file.
// - Usa memoria temporal: los archivos solo se escriben en disco después de
//   validar los datos del producto (evita archivos huérfanos por errores de
//   validación).
// - Valida tamaño, MIME type, extensión y la firma real del archivo.

const multer = require("multer");
const path = require("path");

const { EXTENSION_POR_MIME } = require("../storage/imageStorage");

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024; // 5 MB por archivo
const MAX_IMAGENES = 2;

const TIPOS_PERMITIDOS = new Set(Object.keys(EXTENSION_POR_MIME));
const EXTENSIONES_PERMITIDAS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Algunos navegadores declaran JPG como image/jpg.
const ALIAS_MIME = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

const CAMPOS_ARCHIVO = {
  imagen_1_file: "imagen_1",
  imagen_2_file: "imagen_2",
};

// Detecta el tipo real a partir de los primeros bytes (magic numbers).
const detectarMimeReal = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

const subida = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGEN_BYTES,
    files: MAX_IMAGENES,
    fields: 30,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (ALIAS_MIME[file.mimetype]) {
      file.mimetype = ALIAS_MIME[file.mimetype];
    }

    if (
      !TIPOS_PERMITIDOS.has(file.mimetype) ||
      !EXTENSIONES_PERMITIDAS.has(extension)
    ) {
      const error = new Error(
        "Formato no permitido. Solo se aceptan imágenes JPG, JPEG, PNG o WEBP."
      );
      error.status = 400;
      return cb(error);
    }

    cb(null, true);
  },
}).fields([
  { name: "imagen_1_file", maxCount: 1 },
  { name: "imagen_2_file", maxCount: 1 },
]);

const responderError = (res, error) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        ok: false,
        message: `Cada imagen no puede superar los ${MAX_IMAGEN_BYTES / (1024 * 1024)} MB`,
      });
    }

    if (
      error.code === "LIMIT_FILE_COUNT" ||
      error.code === "LIMIT_UNEXPECTED_FILE"
    ) {
      return res.status(400).json({
        ok: false,
        message: "Solo se permiten hasta dos imágenes por producto",
      });
    }
  }

  return res.status(400).json({
    ok: false,
    message: error.message || "No se pudo procesar la imagen",
  });
};

const subirImagenesProducto = (req, res, next) => {
  subida(req, res, (error) => {
    if (error) {
      return responderError(res, error);
    }

    const grupos = req.files || {};

    for (const campo of Object.keys(CAMPOS_ARCHIVO)) {
      const archivos = grupos[campo] || [];

      for (const archivo of archivos) {
        const mimeReal = detectarMimeReal(archivo.buffer);

        if (!mimeReal || mimeReal !== archivo.mimetype) {
          return res.status(400).json({
            ok: false,
            message:
              "El archivo no es una imagen válida o su contenido no coincide con el formato declarado.",
          });
        }
      }
    }

    next();
  });
};

module.exports = {
  subirImagenesProducto,
  MAX_IMAGEN_BYTES,
  MAX_IMAGENES,
  CAMPOS_ARCHIVO,
};
