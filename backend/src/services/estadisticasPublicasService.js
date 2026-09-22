const { getPool } = require("../config/database");

const obtenerEstadisticasPublicas = async () => {
  const pool = await getPool();

  const result = await pool.request().query(`
    SELECT
      (
        SELECT COUNT(*)
        FROM productos
        WHERE estado = 1
      ) AS total_productos,

      (
        SELECT COUNT(*)
        FROM categorias
      ) AS total_categorias
  `);

  return result.recordset[0];
};

module.exports = {
  obtenerEstadisticasPublicas,
};