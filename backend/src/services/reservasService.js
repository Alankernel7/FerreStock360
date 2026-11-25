const {
  COLECCIONES,
  db,
  aFecha,
} = require("../config/firestore");
const { INTERVALO_LIMPIEZA_RESERVAS_MS } = require("../config/reservas");

const esTransaccion = (executor) =>
  Boolean(
    executor &&
      typeof executor.get === "function" &&
      typeof executor.update === "function" &&
      typeof executor.runTransaction !== "function"
  );

const vencerEnLector = async (lector) => {
  const snapshot = await lector.get(
    db().collection(COLECCIONES.reservas).where("estado", "==", "activa")
  );
  const ahora = new Date();
  let total = 0;

  for (const documento of snapshot.docs) {
    const data = documento.data();
    const expiracion = aFecha(data.fecha_expiracion);
    if (!expiracion || expiracion.getTime() > ahora.getTime()) continue;

    if (esTransaccion(lector)) {
      lector.update(documento.ref, {
        estado: "vencida",
        actualizado_en: ahora,
      });
    } else {
      lector.update(documento.ref, {
        estado: "vencida",
        actualizado_en: ahora,
      });
    }
    total += 1;
  }

  return total;
};

const limpiarReservasVencidas = async (executor = null) => {
  if (esTransaccion(executor)) {
    return vencerEnLector(executor);
  }

  return db().runTransaction(async (tx) => vencerEnLector(tx));
};

let temporizador = null;
const iniciarLimpiezaPeriodica = () => {
  if (temporizador) return;
  temporizador = setInterval(async () => {
    try {
      await limpiarReservasVencidas();
      await require("./pedidosFirestoreService").vencerReservasEfectivo();
    } catch (error) {
      console.error("No se pudieron limpiar reservas vencidas:", error.message);
    }
  }, INTERVALO_LIMPIEZA_RESERVAS_MS);
  temporizador.unref();
};

module.exports = { limpiarReservasVencidas, iniciarLimpiezaPeriodica };
