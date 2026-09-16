// Configuración de conexión a SQL Server.
// Lee las variables de entorno desde .env y crea el pool de conexiones.

const sql = require("mssql");
require("dotenv").config();

// Configuración del pool de conexiones
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Pool de conexiones reutilizable.
// Se crea bajo demanda y se reutiliza en toda la aplicación.
let pool = null;

const getPool = async () => {
  if (!pool) {
    pool = await new sql.ConnectionPool(dbConfig).connect();
    console.log("Conectado a SQL Server");
  }
  return pool;
};

module.exports = { sql, getPool };
