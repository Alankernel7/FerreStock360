const { principal } = require("../services/firebaseStore");

const responderError = (res, error) => {
  const status = Number.isInteger(error.status) ? error.status : 503;
  return res.status(status).json({
    ok: false,
    message: status >= 500 ? "No se pudo validar la sesión." : error.message,
  });
};

// Todas las rutas privadas validan Firebase ID tokens y vuelven a leer el rol
// y el estado desde Firestore en cada solicitud.
const verificarToken = async (req, res, next) => {
  try {
    req.usuario = await principal(req);
    next();
  } catch (error) {
    responderError(res, error);
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== "admin") {
    return res.status(403).json({ ok: false, message: "No tienes permisos para realizar esta acción" });
  }
  next();
};

const soloAdminActivo = (req, res, next) => soloAdmin(req, res, next);

// En rutas públicas, un token ausente o inválido nunca concede permisos.
const tokenOpcional = async (req, _res, next) => {
  if (!req.headers.authorization?.startsWith("Bearer ")) return next();
  try {
    req.usuario = await principal(req);
  } catch {
    req.usuario = null;
  }
  next();
};

module.exports = { verificarToken, tokenOpcional, soloAdmin, soloAdminActivo };
