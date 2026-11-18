const jwt = require("jsonwebtoken");
const { getPool, sql } = require("../config/database");

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

// Revalida contra SQL Server para que roles o cuentas desactivadas no
// conserven permisos administrativos hasta que venza el JWT.
const soloAdminActivo = async (req, res, next) => {
  if (!req.usuario || !Number.isInteger(Number(req.usuario.id_usuario))) {
    return res.status(401).json({ ok: false, message: "Sesión no válida" });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id_usuario", sql.Int, Number(req.usuario.id_usuario))
      .query(`
        SELECT u.estado, r.nombre AS rol
        FROM usuarios u
        INNER JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = @id_usuario
      `);

    const actual = result.recordset[0];
    if (!actual || !actual.estado) {
      return res.status(403).json({ ok: false, message: "La cuenta está inactiva" });
    }
    if (actual.rol !== "admin") {
      return res.status(403).json({ ok: false, message: "Solo un administrador puede realizar esta acción" });
    }

    req.usuario.rol = actual.rol;
    next();
  } catch (error) {
    console.error("Error al validar permisos administrativos:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudieron validar los permisos" });
  }
};

module.exports = {
  verificarToken,
  soloAdmin,
  soloAdminActivo,
};
