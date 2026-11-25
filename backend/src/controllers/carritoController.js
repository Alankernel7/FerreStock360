const servicio = require("../services/carritoFirestoreService");
const servicioSteff = require("../services/firebaseCompras");
const { db } = require("../config/firestore");

const usuarioId = (req) => Number(req.usuario && req.usuario.id_usuario);
const usarCarritoSteff = async (req) => {
  const uid = req.usuario.uid;
  const carrito = (await db().collection("carts").doc(uid).get()).data();
  if (!Array.isArray(carrito?.productos) || carrito.productos.length === 0) return false;
  const local = await db().collection("cart_items").where("id_usuario", "==", usuarioId(req)).limit(1).get();
  if (!local.empty) {
    const error = new Error("Hay datos de carrito en los dos formatos; solicita conciliación antes de continuar.");
    error.status = 409;
    throw error;
  }
  return true;
};
const cuerpoError = (message, error) => {
  const body = { ok: false, message };
  if (process.env.NODE_ENV !== "production") {
    body.diagnostico = { code: error.code || null, original: error.message };
  }
  return body;
};
const responderError = (res, error) => {
  if (error.status) return res.status(error.status).json({ ok: false, message: error.message });
  console.error("Error en carrito/checkout:", { code: error.code, number: error.number, message: error.message });
  if (["unavailable", "deadline-exceeded", "resource-exhausted"].includes(error.code)) return res.status(503).json(cuerpoError("No se pudo conectar con Firestore. Inténtalo nuevamente en unos momentos.", error));
  if (["aborted", "already-exists", "failed-precondition"].includes(error.code)) return res.status(409).json(cuerpoError("El carrito o el inventario cambió. Actualiza el carrito e inténtalo de nuevo.", error));
  return res.status(500).json(cuerpoError("No se pudo actualizar el carrito. Int?ntalo nuevamente; si contin?a, contacta al administrador.", error));
};

const getCarrito = async (req, res) => {
  try { return res.json({ ok: true, data: await (await usarCarritoSteff(req) ? servicioSteff.leerCarrito(req.usuario.uid) : servicio.obtenerCarrito(usuarioId(req))) }); }
  catch (error) { return responderError(res, error); }
};

const postItem = async (req, res) => {
  const idProducto = Number(req.body.id_producto);
  const cantidad = Number(req.body.cantidad);
  if (!Number.isSafeInteger(idProducto) || idProducto < 1 || !Number.isSafeInteger(cantidad) || cantidad < 1) {
    return res.status(400).json({ ok: false, message: "Producto o cantidad no válidos" });
  }
  try {
    const data = await (await usarCarritoSteff(req)
      ? servicioSteff.modificarCarrito(req.usuario.uid, idProducto, cantidad)
      : servicio.agregarAlCarrito(usuarioId(req), idProducto, cantidad));
    return res.json({ ok: true, data });
  }
  catch (error) { return responderError(res, error); }
};

const deleteItem = async (req, res) => {
  const idProducto = Number(req.params.id);
  if (!Number.isSafeInteger(idProducto) || idProducto < 1) return res.status(400).json({ ok: false, message: "Producto no válido" });
  try {
    const data = await (await usarCarritoSteff(req)
      ? servicioSteff.modificarCarrito(req.usuario.uid, idProducto, 0)
      : servicio.quitarDelCarrito(usuarioId(req), idProducto));
    return res.json({ ok: true, data });
  }
  catch (error) { return responderError(res, error); }
};

const deleteCarrito = async (req, res) => {
  try {
    const data = await (await usarCarritoSteff(req)
      ? servicioSteff.vaciar(req.usuario.uid)
      : servicio.vaciarCarrito(usuarioId(req)));
    return res.json({ ok: true, data });
  }
  catch (error) { return responderError(res, error); }
};

const postCheckout = async (req, res) => {
  try {
    const datos = {
      idUsuario: usuarioId(req),
      metodo: req.body.metodo,
      tarjeta: req.body.tarjeta,
      fechaRetiro: req.body.fecha_retiro,
      claveIdempotencia: req.body.clave_idempotencia,
    };
    const pedido = await (await usarCarritoSteff(req)
      ? servicioSteff.checkout(req.usuario, req.body)
      : servicio.checkout(datos));
    return res.status(201).json({ ok: true, data: pedido });
  } catch (error) { return responderError(res, error); }
};

module.exports = { getCarrito, postItem, deleteItem, deleteCarrito, postCheckout };
