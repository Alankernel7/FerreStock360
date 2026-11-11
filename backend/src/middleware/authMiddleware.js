const jwt = require("jsonwebtoken");

// Comprueba que la solicitud incluya un JWT válido.
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "No autorizado. Se requiere iniciar sesión.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET no está configurado");

    return res.status(500).json({
      ok: false,
      message: "Error de configuración del servidor",
    });
  }

  try {
    const usuario = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.usuario = usuario;

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: "Token inválido o expirado",
    });
  }
};


// Comprueba que el usuario autenticado sea administrador.
const soloAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== "admin") {
    return res.status(403).json({
      ok: false,
      message: "No tienes permisos para realizar esta acción",
    });
  }

  next();
};

module.exports = {
  verificarToken,
  soloAdmin,
};