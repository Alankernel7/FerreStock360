// Servicio de prueba de conexión a la base de datos.
// Ejecuta una consulta simple para verificar que SQL Server responde.

const { getPool } = require("../config/database");

const testConnection = async () => {
  const pool = await getPool();
  const result = await pool.request().query("SELECT 1 AS conectado");
  return result.recordset[0];
};

module.exports = { testConnection };
