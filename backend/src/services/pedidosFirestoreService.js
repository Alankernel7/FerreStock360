const {
  COLECCIONES, db, aFecha, aISO, aNumero, aBooleano,
  idNumericoDocumento, resolverDocumento, resolverDocumentoEnTransaccion,
  leerColeccion,
} = require("../config/firestore");
const { fechasRetiroDisponibles, fechaLocalISO } = require("../config/retiros");
const { crearNotificacion, leerAlertasProducto, aplicarAlertaStock } = require("./notificacionesService");
const { hashNumerico } = require("../config/firestore");

const fallo = (mensaje, status) => Object.assign(new Error(mensaje), { status });
const estadoVisible = (pedido, pago) => {
  if (["cancelado", "vencido", "rechazado"].includes(pedido) || ["cancelado", "rechazado"].includes(pago)) return "cancelado";
  if (["pagado", "pendiente_retiro", "entregado"].includes(pedido) || ["pagado", "aprobado"].includes(pago)) return "pagado";
  return "pendiente";
};
const refId = (coleccion, id) => db().collection(coleccion).doc(String(Number(id)));
const leerPago = async (tx, id) => tx.get(refId(COLECCIONES.pagos, id));
const mapearPedidoLista = (doc, pago) => {
  const p = doc.data();
  const estadoPago = pago?.estado || p.estado_pago || null;
  return {
    id_pedido: idNumericoDocumento(doc, "id_pedido"),
    codigo_pedido: p.codigo_pedido || "",
    fecha_pedido: aISO(p.fecha_pedido),
    fecha_retiro: typeof p.fecha_retiro === "string" ? p.fecha_retiro : aISO(p.fecha_retiro)?.slice(0, 10),
    total: aNumero(p.total), metodo_pago: p.metodo_pago,
    estado_pedido: estadoVisible(p.estado_pedido, estadoPago),
    estado_pago: estadoVisible(p.estado_pedido, estadoPago),
  };
};

const obtenerFechasRetiro = () => fechasRetiroDisponibles();

const listarMisPedidos = async (idUsuario, estado = "todos", firebaseUid = null) => {
  if (!["todos", "pendiente", "pagado", "cancelado"].includes(estado)) throw fallo("Filtro de pedidos no válido.", 400);
  const idNum = Number(idUsuario);
  const [porId, porUid, pagos, detalles] = await Promise.all([
    db().collection(COLECCIONES.pedidos).where("id_usuario", "==", idNum).get(),
    firebaseUid
      ? db().collection(COLECCIONES.pedidos).where("uid", "==", firebaseUid).get()
      : Promise.resolve({ docs: [] }),
    db().collection(COLECCIONES.pagos).where("id_usuario", "==", idNum).get(),
    db().collection(COLECCIONES.pedidoDetalles).where("id_usuario", "==", idNum).get(),
  ]);
  const pagosPorId = new Map(pagos.docs.map((doc) => [Number(doc.data().id_pedido), doc.data()]));
  const detallesPorPedido = new Map();
  for (const doc of detalles.docs) {
    const d = doc.data(); const id = Number(d.id_pedido);
    if (!detallesPorPedido.has(id)) detallesPorPedido.set(id, []);
    detallesPorPedido.get(id).push({ id_producto: Number(d.id_producto), nombre: d.nombre_producto || "", cantidad: aNumero(d.cantidad), subtotal: aNumero(d.subtotal) });
  }
  const pedidos = [...new Map([...porId.docs, ...porUid.docs].map((doc) => [doc.id, doc])).values()];
  return pedidos.map((doc) => {
    const data = doc.data();
    const p = mapearPedidoLista(doc, pagosPorId.get(idNumericoDocumento(doc, "id_pedido")));
    const incrustados = Array.isArray(data.detalles) ? data.detalles.map((d) => ({
      id_producto: Number(d.id_producto), nombre: d.nombre || d.nombre_producto || "",
      cantidad: aNumero(d.cantidad), subtotal: aNumero(d.subtotal),
    })) : [];
    return { ...p, detalles: detallesPorPedido.get(p.id_pedido) || incrustados };
  }).filter((p) => estado === "todos" || p.estado_pedido === estado)
    .sort((a, b) => String(b.fecha_pedido).localeCompare(String(a.fecha_pedido)) || b.id_pedido - a.id_pedido);
};

const obtenerPedido = async ({ idPedido, idUsuario = null, uid = null }) => {
  const doc = await resolverDocumento(COLECCIONES.pedidos, "id_pedido", idPedido);
  if (!doc) return null;
  const data = doc.data(); const id = idNumericoDocumento(doc, "id_pedido");
  if (idUsuario !== null && Number(data.id_usuario) !== Number(idUsuario) && data.uid !== uid) return null;
  const [pagoSnap, usuarioSnap, detallesSnap, historiaSnap, usuarioUidSnap] = await Promise.all([
    refId(COLECCIONES.pagos, id).get(),
    resolverDocumento(COLECCIONES.usuarios, "id_usuario", data.id_usuario),
    db().collection(COLECCIONES.pedidoDetalles).where("id_pedido", "==", id).get(),
    db().collection(COLECCIONES.historial).where("id_pedido", "==", id).get(),
    data.uid ? db().collection(COLECCIONES.usuarios).doc(data.uid).get() : Promise.resolve(null),
  ]);
  const pago = pagoSnap.exists ? pagoSnap.data() : { estado: data.estado_pago };
  const usuario = usuarioSnap?.data() || usuarioUidSnap?.data() || {};
  const rawEstado = data.estado_pedido;
  const rawPago = pago.estado;
  const historialFirestore = historiaSnap.docs.map((h) => {
    const x = h.data();
    return {
      id_historial: hashNumerico(h.id), estado_anterior: x.estado_anterior ? estadoVisible(x.estado_anterior, x.estado_pago_anterior) : null,
      estado_nuevo: estadoVisible(x.estado_nuevo, x.estado_pago_nuevo),
      estado_pago_anterior: x.estado_pago_anterior ? estadoVisible(x.estado_anterior, x.estado_pago_anterior) : null,
      estado_pago_nuevo: estadoVisible(x.estado_nuevo, x.estado_pago_nuevo), motivo: x.motivo || null,
      fecha_cambio: aISO(x.fecha_cambio), usuario: x.id_usuario ? "Usuario" : "Sistema",
    };
  });
  const historialLegacy = Array.isArray(data.historial) ? data.historial.map((h, i) => ({
    id_historial: i + 1,
    estado_anterior: h.estado_anterior || null,
    estado_nuevo: estadoVisible(h.estado_nuevo, h.estado_nuevo),
    estado_pago_anterior: h.estado_anterior || null,
    estado_pago_nuevo: estadoVisible(h.estado_nuevo, h.estado_nuevo),
    motivo: h.motivo || null,
    fecha_cambio: aISO(h.fecha_cambio),
    usuario: h.usuario || "Sistema",
  })) : [];
  const historial = [...historialFirestore, ...historialLegacy]
    .sort((a, b) => String(a.fecha_cambio).localeCompare(String(b.fecha_cambio)));
  return {
    id_pedido: id, codigo_pedido: data.codigo_pedido || "", fecha_pedido: aISO(data.fecha_pedido),
    fecha_retiro: typeof data.fecha_retiro === "string" ? data.fecha_retiro : aISO(data.fecha_retiro)?.slice(0, 10),
    fecha_entrega: aISO(data.fecha_entrega), fecha_cancelacion: aISO(data.fecha_cancelacion),
    motivo_cancelacion: data.motivo_cancelacion || null, nombre_cliente: usuario.nombre || "",
    email_cliente: usuario.email || "", subtotal: aNumero(data.subtotal), total: aNumero(data.total),
    metodo_pago: data.metodo_pago, estado_pedido: estadoVisible(rawEstado, rawPago), estado_pago: estadoVisible(rawEstado, rawPago),
    referencia_demo: pago.referencia_demo || null,
    detalles: detallesSnap.docs.length ? detallesSnap.docs.map((d) => {
      const x = d.data(); return { id_producto: Number(x.id_producto), nombre: x.nombre_producto || "", codigo: x.codigo_producto || "", precio: aNumero(x.precio_unitario), cantidad: aNumero(x.cantidad), subtotal: aNumero(x.subtotal), imagen: x.imagen_url || null };
    }) : (Array.isArray(data.detalles) ? data.detalles.map((x) => ({
      id_producto: Number(x.id_producto), nombre: x.nombre || x.nombre_producto || "",
      codigo: x.codigo || x.codigo_producto || "", precio: aNumero(x.precio),
      cantidad: aNumero(x.cantidad), subtotal: aNumero(x.subtotal), imagen: x.imagen_1 || x.imagen_url || null,
    })) : []).sort((a, b) => a.id_producto - b.id_producto), historial,
  };
};

const listarPedidosAdmin = async (filtros = {}) => {
  const allowed = ["todos", "pendiente", "pagado", "cancelado"];
  if (filtros.estado && !allowed.includes(filtros.estado)) throw fallo("El filtro de estado no es válido.", 400);
  if (filtros.metodo && !["todos", "efectivo", "tarjeta"].includes(filtros.metodo)) throw fallo("El filtro de método no es válido.", 400);
  const [pedidos, pagos, usuarios] = await Promise.all([
    leerColeccion(COLECCIONES.pedidos), leerColeccion(COLECCIONES.pagos), leerColeccion(COLECCIONES.usuarios),
  ]);
  const pagoPorId = new Map(pagos.map((d) => [Number(d.data().id_pedido), d.data()]));
  const usuarioPorId = new Map(usuarios.map((d) => [idNumericoDocumento(d, "id_usuario"), d.data()]));
  const todas = pedidos.map((doc) => {
    const p = doc.data(); const id = idNumericoDocumento(doc, "id_pedido"); const pago = pagoPorId.get(id) || {};
    const usuario = usuarioPorId.get(Number(p.id_usuario)) || usuarios.find((u) => u.id === p.uid)?.data() || {};
    return { ...mapearPedidoLista(doc, pago), nombre_cliente: p.nombre_cliente || usuario.nombre || "", email_cliente: p.email_cliente || usuario.email || "", _fecha: aFecha(p.fecha_pedido) };
  });
  const estadoFiltro = filtros.estado || "todos"; const metodoFiltro = filtros.metodo || "todos"; const q = String(filtros.q || "").toLowerCase();
  const lista = todas.filter((p) => (estadoFiltro === "todos" || p.estado_pedido === estadoFiltro)
    && (metodoFiltro === "todos" || p.metodo_pago === metodoFiltro)
    && (!filtros.desde || String(p.fecha_pedido || "").slice(0, 10) >= filtros.desde)
    && (!filtros.hasta || String(p.fecha_pedido || "").slice(0, 10) <= filtros.hasta)
    && (!q || `${p.codigo_pedido} ${p.nombre_cliente} ${p.email_cliente}`.toLowerCase().includes(q)))
    .sort((a, b) => String(b.fecha_pedido).localeCompare(String(a.fecha_pedido)) || b.id_pedido - a.id_pedido)
    .map(({ _fecha, ...p }) => p);
  const indicadores = { total_pedidos: todas.length, pendientes: 0, pagados: 0, cancelados: 0 };
  for (const p of todas) indicadores[`${p.estado_pedido}s`] += 1;
  return { pedidos: lista, indicadores };
};

const registrarHistoria = (tx, { id, pedido, idUsuario, nuevoPedido, nuevoPago, motivo, fecha }) => {
  const ref = db().collection(COLECCIONES.historial).doc();
  tx.set(ref, { id_pedido: id, id_usuario: idUsuario ?? null, estado_anterior: pedido.estado_pedido || null, estado_nuevo: nuevoPedido, estado_pago_anterior: pedido.estado_pago || null, estado_pago_nuevo: nuevoPago, motivo: motivo || null, fecha_cambio: fecha });
};
const notificarPedido = (tx, pedido, estado, motivo) => {
  const cancelado = estado === "cancelado";
  crearNotificacion(tx, { tipo: `pedido_${estado}`, titulo: cancelado ? "Pedido cancelado" : estado === "pagado" ? "Pago confirmado" : "Estado del pedido actualizado", descripcion: cancelado ? `Tu pedido ${pedido.codigo_pedido} fue cancelado. Motivo: ${motivo}` : estado === "pagado" ? `El pago de tu pedido ${pedido.codigo_pedido} fue confirmado.` : `Tu pedido ${pedido.codigo_pedido} ahora está pendiente.`, id_usuario: pedido.id_usuario, id_pedido: pedido.id_pedido });
};

const cambiarEstadoPedido = async ({ idPedido, idUsuario, accion, motivo, usuario }) => {
  if (!["marcar_pendiente", "confirmar_pago", "entregar", "cancelar"].includes(accion)) throw fallo("La acción solicitada no es válida.", 400);
  if (accion === "cancelar" && (!motivo || !motivo.trim() || motivo.trim().length > 440)) throw fallo("Indica un motivo de cancelación de hasta 440 caracteres.", 400);
  const previo = await resolverDocumento(COLECCIONES.pedidos, "id_pedido", idPedido);
  if (previo?.data().uid && previo.data().id_usuario === undefined) {
    const { cambiarPedido } = require("./firebaseCompras");
    return cambiarPedido(usuario || { uid: previo.data().uid, nombre: previo.data().nombre_cliente || "Administrador" }, idPedido, accion, motivo);
  }
  const ref = refId(COLECCIONES.pedidos, idPedido);
  await db().runTransaction(async (tx) => {
    const orderDoc = await resolverDocumentoEnTransaccion(tx, COLECCIONES.pedidos, "id_pedido", idPedido);
    if (!orderDoc) throw fallo("No se encontró el pedido.", 404);
    const pedido = { ...orderDoc.data() }; const id = idNumericoDocumento(orderDoc, "id_pedido");
    const pagoRef = refId(COLECCIONES.pagos, id); const pagoDoc = await tx.get(pagoRef);
    if (!pagoDoc.exists) throw fallo("No se encontró el pago del pedido.", 409);
    const pago = pagoDoc.data(); pedido.estado_pago = pago.estado;
    let nextOrder = pedido.estado_pedido; let nextPayment = pago.estado;
    let detalles = []; let reservas = [];

    if (accion === "marcar_pendiente" && pedido.estado_pedido === "reservado" && pago.estado === "pendiente") return;
    if (accion === "marcar_pendiente") {
      if (pedido.metodo_pago !== "efectivo" || pedido.estado_pedido !== "pendiente_retiro" || pago.estado !== "aprobado") throw fallo("Solo se puede volver a pendiente un pago en efectivo aún no retirado.", 409);
      nextOrder = "reservado"; nextPayment = "pendiente";
    } else if (accion === "confirmar_pago") {
      if (pedido.metodo_pago !== "efectivo" || pedido.estado_pedido !== "reservado" || pago.estado !== "pendiente") throw fallo("Este pedido no tiene un pago en efectivo pendiente de confirmar.", 409);
      const fechaRetiro = typeof pedido.fecha_retiro === "string" ? pedido.fecha_retiro : aISO(pedido.fecha_retiro)?.slice(0, 10);
      if (fechaRetiro < fechaLocalISO()) throw fallo("La fecha límite de pago y retiro ya venció.", 409);
      [detalles, reservas] = await Promise.all([
        tx.get(db().collection(COLECCIONES.pedidoDetalles).where("id_pedido", "==", id)),
        tx.get(db().collection(COLECCIONES.reservas).where("id_pedido", "==", id).where("estado", "==", "confirmada")),
      ]);
      const holds = new Map(reservas.docs.map((d) => [Number(d.data().id_producto), Number(d.data().cantidad)]));
      if (detalles.empty || reservas.size !== detalles.size || detalles.docs.some((d) => holds.get(Number(d.data().id_producto)) !== Number(d.data().cantidad))) throw fallo("La reserva de inventario no está completa para confirmar el pago.", 409);
      nextOrder = "pendiente_retiro"; nextPayment = "aprobado";
    } else if (accion === "entregar") {
      if (pedido.estado_pedido !== "pendiente_retiro" || pago.estado !== "aprobado") throw fallo("Solo se puede entregar un pedido pagado que esté pendiente de retiro.", 409);
      [detalles, reservas] = await Promise.all([
        tx.get(db().collection(COLECCIONES.pedidoDetalles).where("id_pedido", "==", id)),
        tx.get(db().collection(COLECCIONES.reservas).where("id_pedido", "==", id).where("estado", "==", "confirmada")),
      ]);
      if (detalles.empty || reservas.size !== detalles.size) throw fallo("El compromiso de inventario no coincide con los productos del pedido.", 409);
      const holds = new Map(reservas.docs.map((d) => [Number(d.data().id_producto), d.data()]));
      const productos = [];
      for (const detalle of detalles.docs) {
        const d = detalle.data(); const pid = Number(d.id_producto); const hold = holds.get(pid);
        if (!hold || Number(hold.cantidad) !== Number(d.cantidad)) throw fallo("El compromiso de inventario no coincide con los productos del pedido.", 409);
        const productoDoc = await resolverDocumentoEnTransaccion(tx, COLECCIONES.productos, "id_producto", pid);
        if (!productoDoc || aNumero(productoDoc.data().stock_actual) < Number(d.cantidad)) throw fallo(`No hay existencias físicas suficientes para entregar ${d.nombre_producto}.`, 409);
        const alertas = await leerAlertasProducto(tx, pid);
        productos.push({ detalle: d, detalleRef: detalle.ref, reservaRef: reservas.docs.find((x) => Number(x.data().id_producto) === pid).ref, doc: productoDoc, data: productoDoc.data(), alertas });
      }
      nextOrder = "entregado";
      const fecha = new Date();
      for (const item of productos) {
        const stock = aNumero(item.data.stock_actual) - aNumero(item.detalle.cantidad);
        const idMovimiento = hashNumerico(`${id}:${item.detalle.id_producto}:${fecha.getTime()}`);
        const movimientoRef = db().collection(COLECCIONES.movimientos).doc();
        tx.update(item.doc.ref, { stock_actual: stock, actualizado_en: fecha });
        tx.update(item.reservaRef, { estado: "consumida", actualizado_en: fecha });
        tx.set(movimientoRef, { id_movimiento: idMovimiento, id_producto: Number(item.detalle.id_producto), id_usuario: Number(idUsuario), tipo_movimiento: "salida", cantidad: Number(item.detalle.cantidad), motivo: `Entrega pedido ${pedido.codigo_pedido}`, fecha_movimiento: fecha });
        crearNotificacion(tx, { tipo: "salida_inventario", titulo: "Pedido entregado", descripcion: `Salida de ${item.detalle.cantidad} unidad(es) por entrega del pedido ${pedido.codigo_pedido}.`, id_producto: Number(item.detalle.id_producto), id_movimiento: idMovimiento });
        aplicarAlertaStock(tx, { id_producto: Number(item.detalle.id_producto), nombre: item.data.nombre, codigo: item.data.codigo, stock_actual: stock, stock_minimo: aNumero(item.data.stock_minimo) }, item.alertas);
      }
      pedido.fecha_entrega = fecha;
    } else {
      if (["entregado", "cancelado", "vencido", "rechazado"].includes(pedido.estado_pedido)) throw fallo("El estado actual del pedido no permite cancelarlo.", 409);
      reservas = await tx.get(db().collection(COLECCIONES.reservas).where("id_pedido", "==", id).where("estado", "==", "confirmada"));
      for (const r of reservas.docs) tx.update(r.ref, { estado: "cancelada", actualizado_en: new Date() });
      nextOrder = "cancelado"; nextPayment = "cancelado"; pedido.fecha_cancelacion = new Date(); pedido.motivo_cancelacion = motivo.trim();
    }

    const fecha = new Date();
    if (accion !== "entregar") tx.update(pagoRef, { estado: nextPayment, fecha_operacion: fecha });
    tx.update(orderDoc.ref, { estado_pedido: nextOrder, ...(accion === "entregar" ? { fecha_entrega: fecha } : {}), ...(accion === "cancelar" ? { fecha_cancelacion: fecha, motivo_cancelacion: motivo.trim() } : {}), actualizado_en: fecha });
    const estado = estadoVisible(nextOrder, nextPayment);
    const razon = accion === "cancelar" ? motivo.trim() : accion === "confirmar_pago" ? "Pago en efectivo recibido en el establecimiento" : accion === "entregar" ? "Entrega registrada" : "Pago en efectivo pendiente de confirmación";
    registrarHistoria(tx, { id, pedido, idUsuario, nuevoPedido: nextOrder, nuevoPago: nextPayment, motivo: razon, fecha });
    if (accion !== "entregar") notificarPedido(tx, { ...pedido, id_pedido: id }, estado, accion === "cancelar" ? motivo.trim() : null);
  });
  return obtenerPedido({ idPedido });
};

const vencerReservasEfectivo = async () => {
  const [pedidos, pagos] = await Promise.all([
    db().collection(COLECCIONES.pedidos).where("metodo_pago", "==", "efectivo").get(),
    db().collection(COLECCIONES.pagos).get(),
  ]);
  const pagosPorId = new Map(pagos.docs.map((p) => [Number(p.data().id_pedido), p.data()]));
  const vencidos = pedidos.docs.filter((doc) => {
    const p = doc.data(); const fecha = typeof p.fecha_retiro === "string" ? p.fecha_retiro : aISO(p.fecha_retiro)?.slice(0, 10);
    return ["reservado", "pendiente_retiro"].includes(p.estado_pedido) && ["pendiente", "aprobado"].includes(pagosPorId.get(idNumericoDocumento(doc, "id_pedido"))?.estado) && fecha < fechaLocalISO();
  });
  let cambios = 0;
  for (const candidate of vencidos) {
    await db().runTransaction(async (tx) => {
      const order = await tx.get(candidate.ref); if (!order.exists) return;
      const data = order.data(); const id = idNumericoDocumento(order, "id_pedido");
      const pagoRef = refId(COLECCIONES.pagos, id); const pago = await tx.get(pagoRef);
      if (!pago.exists || !["reservado", "pendiente_retiro"].includes(data.estado_pedido) || !["pendiente", "aprobado"].includes(pago.data().estado)) return;
      const reservas = await tx.get(db().collection(COLECCIONES.reservas).where("id_pedido", "==", id).where("estado", "==", "confirmada"));
      const fecha = new Date(); const pagoAnterior = pago.data().estado; const nuevoPago = pagoAnterior === "pendiente" ? "cancelado" : pagoAnterior;
      for (const r of reservas.docs) tx.update(r.ref, { estado: "vencida", actualizado_en: fecha });
      tx.update(order.ref, { estado_pedido: "vencido", actualizado_en: fecha });
      if (nuevoPago !== pagoAnterior) tx.update(pagoRef, { estado: nuevoPago, fecha_operacion: fecha });
      registrarHistoria(tx, { id, pedido: data, idUsuario: null, nuevoPedido: "vencido", nuevoPago, motivo: "Vencimiento automático de reserva en efectivo", fecha });
      cambios += 1;
    });
  }
  return cambios;
};

module.exports = { obtenerFechasRetiro, listarMisPedidos, obtenerPedido, listarPedidosAdmin, cambiarEstadoPedido, vencerReservasEfectivo };
