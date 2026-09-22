const sql = require("mssql");
require("dotenv").config();

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10) || 1433,

  // Damos tiempo suficiente a Azure SQL para responder,
  // especialmente si la base está reanudándose.
  connectionTimeout: 60000,
  requestTimeout: 30000,

  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },

  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

let pool = null;
let connectingPromise = null;

const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const conectarConReintentos = async (
  maxIntentos = 4
) => {
  let ultimoError;

  for (
    let intento = 1;
    intento <= maxIntentos;
    intento++
  ) {
    try {
      console.log(
        `Conectando a Azure SQL... intento ${intento}/${maxIntentos}`
      );

      const nuevoPool =
        new sql.ConnectionPool(dbConfig);

      nuevoPool.on("error", (error) => {
        console.error(
          "Error en el pool de SQL Server:",
          error.message
        );

        pool = null;
      });

      await nuevoPool.connect();

      console.log(
        "Conectado correctamente a Azure SQL"
      );

      return nuevoPool;
    } catch (error) {
      ultimoError = error;

      console.error(
        `Falló conexión SQL intento ${intento}:`,
        error.message
      );

      if (intento < maxIntentos) {
        const espera = Math.min(
          5000 * Math.pow(2, intento - 1),
          30000
        );

        console.log(
          `Reintentando en ${espera / 1000} segundos...`
        );

        await esperar(espera);
      }
    }
  }

  throw ultimoError;
};

const getPool = async () => {
  if (pool && pool.connected) {
    return pool;
  }

  /*
   * Si varias peticiones llegan mientras Azure está
   * despertando, todas esperan la misma conexión en vez
   * de crear varios pools al mismo tiempo.
   */
  if (!connectingPromise) {
    connectingPromise = conectarConReintentos()
      .then((nuevoPool) => {
        pool = nuevoPool;
        return pool;
      })
      .catch((error) => {
        pool = null;
        throw error;
      })
      .finally(() => {
        connectingPromise = null;
      });
  }

  return connectingPromise;
};

module.exports = {
  sql,
  getPool,
};