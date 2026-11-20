const { sql, getPool } = require("../config/database");

const obtenerUsuarioPorEmail = async (email) => {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("email", sql.NVarChar(150), email)
    .query(`
      SELECT
        u.id_usuario,
        u.nombre,
        u.email,
        u.password,
        u.estado,
        r.nombre AS rol
      FROM usuarios u
      INNER JOIN roles r
        ON u.id_rol = r.id_rol
      WHERE u.email = @email
    `);

  return result.recordset[0];
};

const crearUsuario = async ({
  nombre,
  email,
  password,
}) => {
  const pool = await getPool();

  // El registro público solo crea clientes y nunca acepta un id de rol del navegador.
  const rolResult = await pool
    .request()
    .input("nombreRol", sql.NVarChar(50), "cliente")
    .query(`
      SELECT id_rol
      FROM roles
      WHERE nombre = @nombreRol
    `);

  if (rolResult.recordset.length === 0) {
    throw new Error("El rol cliente no existe. Ejecuta backend/database/rol_cliente.sql antes de habilitar el registro público.");
  }

  const idRolCliente =
    rolResult.recordset[0].id_rol;

  const result = await pool
    .request()
    .input("nombre", sql.NVarChar(100), nombre)
    .input("email", sql.NVarChar(150), email)
    .input("password", sql.NVarChar(255), password)
    .input("id_rol", sql.Int, idRolCliente)
    .query(`
      INSERT INTO usuarios (
        nombre,
        email,
        password,
        id_rol,
        estado
      )
      OUTPUT
        INSERTED.id_usuario,
        INSERTED.nombre,
        INSERTED.email,
        INSERTED.estado,
        INSERTED.fecha_creacion
      VALUES (
        @nombre,
        @email,
        @password,
        @id_rol,
        1
      )
    `);

  return {
    ...result.recordset[0],
    rol: "cliente",
  };
};

module.exports = {
  obtenerUsuarioPorEmail,
  crearUsuario,
};
