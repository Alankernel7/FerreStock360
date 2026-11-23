const obtenerStockDisponible = (stockFisico, unidadesReservadas) =>
  Math.max(0, Number(stockFisico) - Number(unidadesReservadas));

const obtenerMaximoCarrito = (stockFisico, reservasDeOtrosCarritos) =>
  obtenerStockDisponible(stockFisico, reservasDeOtrosCarritos);

const reservaVigente = (estado, fechaExpiracion, ahora = Date.now()) =>
  estado === "activa" && Boolean(fechaExpiracion) && new Date(fechaExpiracion).getTime() > ahora;

const validarDisponibilidadReserva = ({ stockFisico, reservasTotales, reservaPropia, cantidad }) => {
  const maximo = obtenerMaximoCarrito(stockFisico, reservasTotales - reservaPropia);
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) {
    throw Object.assign(new Error("La cantidad debe ser un entero mayor que cero"), { status: 400 });
  }
  if (cantidad > maximo) {
    throw Object.assign(new Error(`Solo quedan ${maximo} unidad(es) disponibles para este carrito`), { status: 409 });
  }
  return maximo;
};

module.exports = { obtenerStockDisponible, obtenerMaximoCarrito, validarDisponibilidadReserva, reservaVigente };
