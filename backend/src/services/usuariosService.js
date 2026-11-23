const { getPool, sql } = require("../config/database");

const listarUsuarios = async ({ q, rol, estado }) => {
  const pool = await getPool();
  const request = pool.request();
  const filtros = ["1 = 1"];
  if (q) {
    request.input("busqueda", sql.NVarChar(150), `%${q}%`);
    filtros.push("(u.nombre LIKE @busqueda OR u.email LIKE @busqueda)");
  }
  if (rol) {
    request.input("id_rol", sql.Int, rol);
    filtros.push("u.id_rol = @id_rol");
  }
  if (estado !== null) {
    request.input("estado", sql.Bit, estado);
    filtros.push("u.estado = @estado");
  }
  const [usuarios, roles] = await Promise.all([
    request.query(`SELECT u.id_usuario, u.nombre, u.email, u.id_rol, r.nombre AS rol,
        u.estado, u.fecha_creacion
      FROM usuarios u INNER JOIN roles r ON r.id_rol = u.id_rol
      WHERE ${filtros.join(" AND ")} ORDER BY u.nombre`),
    pool.request().query("SELECT id_rol, nombre, descripcion FROM roles WHERE nombre IN ('admin','cliente') ORDER BY nombre"),
  ]);
  return { usuarios: usuarios.recordset, roles: roles.recordset };
};

const obtenerRol = async (id) => {
  const pool = await getPool();
  const result = await pool.request().input("id_rol", sql.Int, id)
    .query("SELECT id_rol, nombre FROM roles WHERE id_rol = @id_rol");
  return result.recordset[0];
};

const existeEmail = async (email, excluirId = null) => {
  const pool = await getPool();
  const request = pool.request().input("email", sql.NVarChar(150), email);
  let consulta = "SELECT id_usuario FROM usuarios WHERE email = @email";
  if (excluirId !== null) {
    request.input("id_usuario", sql.Int, excluirId);
    consulta += " AND id_usuario <> @id_usuario";
  }
  return (await request.query(consulta)).recordset.length > 0;
};

const crearUsuarioAdmin = async ({ nombre, email, password, idRol, estado }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("nombre", sql.NVarChar(100), nombre)
    .input("email", sql.NVarChar(150), email)
    .input("password", sql.NVarChar(255), password)
    .input("id_rol", sql.Int, idRol)
    .input("estado", sql.Bit, estado)
    .query(`INSERT INTO usuarios (nombre, email, password, id_rol, estado)
      OUTPUT INSERTED.id_usuario, INSERTED.nombre, INSERTED.email,
        INSERTED.id_rol, INSERTED.estado, INSERTED.fecha_creacion
      VALUES (@nombre, @email, @password, @id_rol, @estado)`);
  return result.recordset[0];
};

const actualizarUsuarioAdmin = async ({ id, idAutenticado, nombre, email, idRol, estado, password }) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await bloquearAdministracionUsuarios(transaction);
    const existente = await obtenerUsuarioBloqueado(transaction, id);
    if (!existente) {
      await transaction.rollback();
      return null;
    }
    if (id === Number(idAutenticado) && Number(idRol) !== Number(existente.id_rol)) {
      throw crearError("No puedes modificar tu propio rol", 409);
    }
    await protegerUltimoAdministrador(transaction, existente, { idRol, estado });
    const request = new sql.Request(transaction)
      .input("id_usuario", sql.Int, id)
      .input("nombre", sql.NVarChar(100), nombre)
      .input("email", sql.NVarChar(150), email)
      .input("id_rol", sql.Int, idRol)
      .input("estado", sql.Bit, estado);
    const passwordSql = password ? (request.input("password", sql.NVarChar(255), password), ", password = @password") : "";
    const result = await request.query(`UPDATE usuarios SET nombre = @nombre, email = @email,
        id_rol = @id_rol, estado = @estado${passwordSql}
        OUTPUT INSERTED.id_usuario, INSERTED.nombre, INSERTED.email,
          INSERTED.id_rol, INSERTED.estado, INSERTED.fecha_creacion
        WHERE id_usuario = @id_usuario`);
    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    if (transaction._aborted !== true) await transaction.rollback().catch(() => {});
    throw error;
  }
};

const crearError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

// Serializa las operaciones administrativas de usuarios entre procesos y
// protege el conteo de administradores hasta confirmar la transacción.
const bloquearAdministracionUsuarios = async (transaction) => {
  const result = await new sql.Request(transaction).query(`
    DECLARE @resultado INT;
    EXEC @resultado = sys.sp_getapplock
      @Resource = 'FerreStock360:administracion-usuarios',
      @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
    SELECT @resultado AS resultado;
  `);
  if (result.recordset[0].resultado < 0) throw crearError("No se pudo bloquear la administración de usuarios", 503);
};

const obtenerUsuarioBloqueado = async (transaction, id) => {
  const result = await new sql.Request(transaction).input("id_usuario", sql.Int, id).query(`
    SELECT u.id_usuario, u.id_rol, u.estado, r.nombre AS rol
    FROM usuarios u INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = @id_usuario;
  `);
  return result.recordset[0];
};

const protegerUltimoAdministrador = async (transaction, existente, cambios) => {
  const dejaDeSerAdmin = existente.rol === "admin" && existente.estado &&
    (Number(cambios.idRol) !== Number(existente.id_rol) || cambios.estado === false);
  if (!dejaDeSerAdmin) return;
  const result = await new sql.Request(transaction).query(`
    SELECT COUNT_BIG(*) AS total
    FROM usuarios u INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.estado = 1 AND r.nombre = 'admin';
  `);
  if (Number(result.recordset[0].total) <= 1) {
    throw crearError("No puedes cambiar el rol ni desactivar al último administrador activo", 409);
  }
};

const actualizarEstadoUsuario = async (id, estado) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await bloquearAdministracionUsuarios(transaction);
    const existente = await obtenerUsuarioBloqueado(transaction, id);
    if (!existente) {
      await transaction.rollback();
      return null;
    }
    await protegerUltimoAdministrador(transaction, existente, { idRol: existente.id_rol, estado });
    const result = await new sql.Request(transaction)
      .input("id_usuario", sql.Int, id)
      .input("estado", sql.Bit, estado)
      .query(`UPDATE usuarios SET estado = @estado
        OUTPUT INSERTED.id_usuario, INSERTED.nombre, INSERTED.email,
          INSERTED.id_rol, INSERTED.estado, INSERTED.fecha_creacion
        WHERE id_usuario = @id_usuario`);
    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    if (transaction._aborted !== true) await transaction.rollback().catch(() => {});
    throw error;
  }
};

const existeUsuario = async (id) => {
  const pool = await getPool();
  return (await pool.request().input("id_usuario", sql.Int, id)
    .query("SELECT id_usuario FROM usuarios WHERE id_usuario = @id_usuario")).recordset.length > 0;
};

module.exports = { listarUsuarios, obtenerRol, existeEmail, crearUsuarioAdmin, actualizarUsuarioAdmin, actualizarEstadoUsuario, existeUsuario };
