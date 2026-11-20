const servicio = require("../services/carritoService");

const usuarioId = (req) => Number(req.usuario && req.usuario.id_usuario);
const cuerpoError = (message, error) => {
  const body = { ok: false, message };
  if (process.env.NODE_ENV !== "production") {
    body.diagnostico = { code: error.code || null, number: error.number || null, original: error.message };
  }
  return body;
};
const responderError = (res, error) => {
  if (error.status) return res.status(error.status).json({ ok: false, message: error.message });
  console.error("Error en carrito/checkout:", { code: error.code, number: error.number, message: error.message });
  if (error.number === 208) return res.status(503).json(cuerpoError("La tabla de reservas de inventario no est? disponible. Contacta al administrador.", error));
  if (error.number === 1205) return res.status(409).json(cuerpoError("Otra operaci?n actualiz? el inventario al mismo tiempo. Int?ntalo de nuevo.", error));
  if ([2601, 2627, 547].includes(error.number)) return res.status(409).json(cuerpoError("El carrito o el inventario cambi?. Actualiza el carrito e int?ntalo de nuevo.", error));
  if (["ESOCKET", "ETIMEOUT", "ECONNCLOSED", "ENOTOPEN"].includes(error.code)) return res.status(503).json(cuerpoError("No se pudo conectar con la base de datos. Int?ntalo nuevamente en unos momentos.", error));
  return res.status(500).json(cuerpoError("No se pudo actualizar el carrito. Int?ntalo nuevamente; si contin?a, contacta al administrador.", error));
};

const getCarrito = async (req, res) => {
  try { return res.json({ ok: true, data: await servicio.obtenerCarrito(usuarioId(req)) }); }
  catch (error) { return responderError(res, error); }
};

const postItem = async (req, res) => {
  const idProducto = Number(req.body.id_producto);
  const cantidad = Number(req.body.cantidad);
  if (!Number.isSafeInteger(idProducto) || idProducto < 1 || !Number.isSafeInteger(cantidad) || cantidad < 1) {
    return res.status(400).json({ ok: false, message: "Producto o cantidad no válidos" });
  }
  try { return res.json({ ok: true, data: await servicio.agregarAlCarrito(usuarioId(req), idProducto, cantidad) }); }
  catch (error) { return responderError(res, error); }
};

const deleteItem = async (req, res) => {
  const idProducto = Number(req.params.id);
  if (!Number.isSafeInteger(idProducto) || idProducto < 1) return res.status(400).json({ ok: false, message: "Producto no válido" });
  try { return res.json({ ok: true, data: await servicio.quitarDelCarrito(usuarioId(req), idProducto) }); }
  catch (error) { return responderError(res, error); }
};

const deleteCarrito = async (req, res) => {
  try { return res.json({ ok: true, data: await servicio.vaciarCarrito(usuarioId(req)) }); }
  catch (error) { return responderError(res, error); }
};

const postCheckout = async (req, res) => {
  try {
    const pedido = await servicio.checkout({
      idUsuario: usuarioId(req),
      metodo: req.body.metodo,
      tarjeta: req.body.tarjeta,
      fechaRetiro: req.body.fecha_retiro,
      claveIdempotencia: req.body.clave_idempotencia,
    });
    return res.status(201).json({ ok: true, data: pedido });
  } catch (error) { return responderError(res, error); }
};

module.exports = { getCarrito, postItem, deleteItem, deleteCarrito, postCheckout };
