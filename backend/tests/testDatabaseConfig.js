// Las pruebas que escriben SQL solo se habilitan contra una base desechable
// configurada aparte. Nunca reutilizar DB_* de backend/.env para estas pruebas.
const confirmed = process.env.TEST_DATABASE_CONFIRMATION === "ISOLATED_NON_PRODUCTION_DATABASE";
const required = ["TEST_DB_SERVER", "TEST_DB_DATABASE", "TEST_DB_USER", "TEST_DB_PASSWORD", "TEST_JWT_SECRET"];
const complete = required.every((name) => Boolean(process.env[name]));
const habilitada = confirmed && complete;

if (habilitada) {
  process.env.DB_SERVER = process.env.TEST_DB_SERVER;
  process.env.DB_DATABASE = process.env.TEST_DB_DATABASE;
  process.env.DB_USER = process.env.TEST_DB_USER;
  process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD;
  process.env.DB_PORT = process.env.TEST_DB_PORT || "1433";
  process.env.DB_TRUST_SERVER_CERTIFICATE = process.env.TEST_DB_TRUST_SERVER_CERTIFICATE || "false";
  process.env.JWT_SECRET = process.env.TEST_JWT_SECRET;
}

module.exports = habilitada;
