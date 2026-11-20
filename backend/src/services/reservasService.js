const { getPool, sql } = require("../config/database");
const { INTERVALO_LIMPIEZA_RESERVAS_MS } = require("../config/reservas");

const crearSolicitud = (executor) => executor instanceof sql.Transaction
  ? new sql.Request(executor)
  : executor.request();

const limpiarReservasVencidas = async (executor = null) => {
  const db = executor || await getPool();
  const result = await crearSolicitud(db).query(`
    IF OBJECT_ID(N'dbo.reservas_inventario', N'U') IS NOT NULL
    BEGIN
      UPDATE dbo.reservas_inventario WITH (ROWLOCK)
      SET estado = N'vencida'
      WHERE estado = N'activa' AND fecha_expiracion <= SYSUTCDATETIME();
    END
  `);
  return result.rowsAffected?.reduce((total, amount) => total + amount, 0) || 0;
};

let temporizador = null;
const iniciarLimpiezaPeriodica = () => {
  if (temporizador) return;
  temporizador = setInterval(async () => {
    try {
      await limpiarReservasVencidas();
      await require("./pedidosService").vencerReservasEfectivo();
    } catch (error) {
      console.error("No se pudieron limpiar reservas vencidas:", error.message);
    }
  }, INTERVALO_LIMPIEZA_RESERVAS_MS);
  temporizador.unref();
};

module.exports = { limpiarReservasVencidas, iniciarLimpiezaPeriodica };
