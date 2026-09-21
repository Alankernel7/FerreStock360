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

module.exports = {
  obtenerUsuarioPorEmail,
};