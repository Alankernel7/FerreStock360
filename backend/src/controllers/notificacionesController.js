const {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  listarNotificacionesCliente,
  marcarNotificacionClienteLeida,
  marcarTodasClienteLeidas,
} = require("../services/notificacionesService");

const getNotificaciones = async (_req, res) => {
  try {
    return res.json({ ok: true, data: await listarNotificaciones() });
  } catch (error) {
    console.error("Error al consultar notificaciones:", error.message);
    return res.status(error.status || 500).json({ ok: false, message: "No se pudieron consultar las notificaciones" });
  }
};

const patchNotificacionLeida = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ ok: false, message: "El identificador de notificación no es válido" });
  try {
    const data = await marcarNotificacionLeida(id);
    if (!data) return res.status(404).json({ ok: false, message: "Notificación no encontrada" });
    return res.json({ ok: true, message: "Notificación marcada como leída" });
  } catch (error) {
    console.error("Error al actualizar notificación:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudo actualizar la notificación" });
  }
};

const patchTodasLeidas = async (_req, res) => {
  try {
    await marcarTodasLeidas();
    return res.json({ ok: true, message: "Notificaciones marcadas como leídas" });
  } catch (error) {
    console.error("Error al marcar notificaciones como leídas:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudieron actualizar las notificaciones" });
  }
};

const clienteRequerido = (req, res) => {
  if (req.usuario?.rol === "cliente" && Number.isSafeInteger(Number(req.usuario.id_usuario))) return true;
  res.status(403).json({ ok: false, message: "Solo un cliente autenticado puede consultar sus notificaciones." });
  return false;
};

const getNotificacionesCliente = async (req, res) => {
  if (!clienteRequerido(req, res)) return;
  try { return res.json({ ok: true, data: await listarNotificacionesCliente(Number(req.usuario.id_usuario)) }); }
  catch (error) { console.error("Error al consultar notificaciones del cliente:", error.message); return res.status(500).json({ ok: false, message: "No se pudieron consultar las notificaciones" }); }
};

const patchNotificacionClienteLeida = async (req, res) => {
  if (!clienteRequerido(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ ok: false, message: "El identificador de notificación no es válido" });
  try {
    const data = await marcarNotificacionClienteLeida(Number(req.usuario.id_usuario), id);
    if (!data) return res.status(404).json({ ok: false, message: "Notificación no encontrada" });
    return res.json({ ok: true, message: "Notificación marcada como leída" });
  } catch (error) { console.error("Error al actualizar notificación:", error.message); return res.status(500).json({ ok: false, message: "No se pudo actualizar la notificación" }); }
};

const patchTodasNotificacionesClienteLeidas = async (req, res) => {
  if (!clienteRequerido(req, res)) return;
  try { await marcarTodasClienteLeidas(Number(req.usuario.id_usuario)); return res.json({ ok: true, message: "Notificaciones marcadas como leídas" }); }
  catch (error) { console.error("Error al marcar notificaciones:", error.message); return res.status(500).json({ ok: false, message: "No se pudieron actualizar las notificaciones" }); }
};

module.exports = { getNotificaciones, patchNotificacionLeida, patchTodasLeidas, getNotificacionesCliente, patchNotificacionClienteLeida, patchTodasNotificacionesClienteLeidas };
