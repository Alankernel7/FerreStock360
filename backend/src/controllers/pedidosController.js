const service = require("../services/pedidosFirestoreService");

const idUsuario = (req) => Number(req.usuario.id_usuario);
const fechaValida = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && (() => { try { return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; } catch { return false; } })();
const errorResponse = (res, error) => {
  if (error.status) return res.status(error.status).json({ ok: false, message: error.message });
  console.error("Error de pedidos:", { number: error.number, code: error.code, message: error.message });
  return res.status(500).json({ ok: false, message: "No se pudo completar la operación de pedidos." });
};

const fechasRetiro = (_req, res) => res.json({ ok: true, data: service.obtenerFechasRetiro() });

const listarMios = async (req, res) => {
  try { return res.json({ ok: true, data: await service.listarMisPedidos(idUsuario(req), String(req.query.estado || "todos"), req.usuario.uid) }); }
  catch (error) { return errorResponse(res, error); }
};

const detalleMio = async (req, res) => {
  const idPedido = Number(req.params.id);
  if (!Number.isSafeInteger(idPedido) || idPedido < 1) return res.status(400).json({ ok: false, message: "Pedido no válido." });
  try {
    const pedido = await service.obtenerPedido({ idPedido, idUsuario: idUsuario(req), uid: req.usuario.uid });
    return pedido ? res.json({ ok: true, data: pedido }) : res.status(404).json({ ok: false, message: "No se encontró el pedido." });
  } catch (error) { return errorResponse(res, error); }
};

const fechaQueryValida = (value) => value === undefined || fechaValida(value);
const listarAdmin = async (req, res) => {
  const filtros = {
    estado: String(req.query.estado || "todos"), metodo: String(req.query.metodo || "todos"),
    desde: req.query.desde, hasta: req.query.hasta, q: typeof req.query.q === "string" ? req.query.q.trim() : "",
  };
  if (!fechaQueryValida(filtros.desde) || !fechaQueryValida(filtros.hasta) || filtros.q.length > 300
      || (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta)) {
    return res.status(400).json({ ok: false, message: "Los filtros de fecha o búsqueda no son válidos." });
  }
  try { return res.json({ ok: true, data: await service.listarPedidosAdmin(filtros) }); }
  catch (error) { return errorResponse(res, error); }
};

const detalleAdmin = async (req, res) => {
  const idPedido = Number(req.params.id);
  if (!Number.isSafeInteger(idPedido) || idPedido < 1) return res.status(400).json({ ok: false, message: "Pedido no válido." });
  try {
    const pedido = await service.obtenerPedido({ idPedido });
    return pedido ? res.json({ ok: true, data: pedido }) : res.status(404).json({ ok: false, message: "No se encontró el pedido." });
  } catch (error) { return errorResponse(res, error); }
};

const cambiarEstado = async (req, res) => {
  const idPedido = Number(req.params.id);
  if (!Number.isSafeInteger(idPedido) || idPedido < 1) return res.status(400).json({ ok: false, message: "Pedido no válido." });
  try {
    const pedido = await service.cambiarEstadoPedido({ idPedido, idUsuario: idUsuario(req), uid: req.usuario.uid, usuario: req.usuario, accion: req.body.accion, motivo: req.body.motivo });
    return res.json({ ok: true, data: pedido });
  } catch (error) { return errorResponse(res, error); }
};

module.exports = { fechasRetiro, listarMios, detalleMio, listarAdmin, detalleAdmin, cambiarEstado };
