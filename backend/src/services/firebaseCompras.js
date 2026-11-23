const {
  db,
  fallo,
  numero,
  producto,
  documentoProducto,
  ahora,
} = require("./firebaseStore");
const {
  validarCantidadCarrito,
  validarItemsCheckout,
  validarTarjetaDemo,
} = require("./checkoutRules");
const { validarFechaRetiro } = require("../config/retiros");
const { DURACION_RESERVA_MINUTOS } = require("../config/reservas");

const CART = "carts",
  STOCK = "inventory_holds",
  ORDERS = "orders";
const vigentes = (holds) =>
  Object.fromEntries(
    Object.entries(holds ?? {}).filter(
      ([, r]) => r.expira === null || r.expira > Date.now(),
    ),
  );
const reservado = (holds) =>
  Object.values(vigentes(holds)).reduce((s, r) => s + r.cantidad, 0);
const refStock = (id) => db().collection(STOCK).doc(id);
const refCart = (uid) => db().collection(CART).doc(uid);
const dueno = (uid) => "u" + numero(uid);
async function disponibles() {
  const s = await db().collection(STOCK).get();
  return new Map(s.docs.map((d) => [d.id, reservado(d.data().holds)]));
}
async function leerCarrito(uid) {
  const ids = (await refCart(uid).get()).data()?.productos ?? [];
  return (
    await Promise.all(
      ids.map(async (id) => {
        const [ps, hs] = await Promise.all([
          db().collection("products").doc(id).get(),
          refStock(id).get(),
        ]);
        const holds = vigentes(hs.data()?.holds),
          r = holds[dueno(uid)];
        if (!r || !ps.exists) return null;
        const p = producto(ps),
          disponibles = Math.max(0, p.stock_actual - reservado(holds));
        return {
          ...p,
          imagen: p.imagen_1,
          cantidad: r.cantidad,
          stock_disponible: disponibles,
          stock_fisico: p.stock_actual,
          maximo_carrito: disponibles + r.cantidad,
          estado_reserva: "activa",
          fecha_expiracion: new Date(r.expira).toISOString(),
          segundos_restantes: Math.max(
            0,
            Math.ceil((r.expira - Date.now()) / 1000),
          ),
        };
      }),
    )
  ).filter(Boolean);
}
async function modificarCarrito(uid, id, cantidad) {
  const ref = await documentoProducto(id);
  await db().runTransaction(async (tx) => {
    const [ps, hs, cs] = await tx.getAll(ref, refStock(ref.id), refCart(uid));
    if (!ps.exists) throw fallo(404, "Producto inexistente.");
    const holds = vigentes(hs.data()?.holds),
      ids = new Set(cs.data()?.productos ?? []);
    delete holds[dueno(uid)];
    if (cantidad !== 0) {
      const p = producto(ps);
      validarCantidadCarrito({
        producto: { ...p, stock_actual: p.stock_actual - reservado(holds) },
        cantidad,
      });
      if (!ids.has(ref.id) && ids.size >= 100)
        throw fallo(400, "Máximo 100 productos por carrito.");
      holds[dueno(uid)] = {
        cantidad,
        expira: Date.now() + DURACION_RESERVA_MINUTOS * 60000,
      };
      ids.add(ref.id);
    } else ids.delete(ref.id);
    tx.set(refStock(ref.id), { holds });
    tx.set(refCart(uid), { productos: [...ids] });
  });
  return leerCarrito(uid);
}
async function vaciar(uid) {
  await db().runTransaction(async (tx) => {
    const ids = (await tx.get(refCart(uid))).data()?.productos ?? [];
    const snaps = ids.length ? await tx.getAll(...ids.map(refStock)) : [];
    for (const s of snaps) {
      const holds = vigentes(s.data()?.holds);
      delete holds[dueno(uid)];
      tx.set(s.ref, { holds });
    }
    tx.set(refCart(uid), { productos: [] });
  });
  return [];
}
function aviso(tx, uid, p, titulo) {
  const ref = db().collection("notifications").doc();
  tx.create(ref, {
    uid,
    id_notificacion: numero(ref.id),
    titulo,
    descripcion: p.codigo_pedido || p.nombre,
    fecha_creacion: ahora(),
    tipo:
      p.estado_pedido === "pagado"
        ? "pedido_pagado"
        : p.estado_pedido === "cancelado"
          ? "pedido_cancelado"
          : "pedido_pendiente",
    id_pedido: p.id_pedido ?? null,
    leida: false,
  });
}
async function checkout(u, b) {
  if (!/^[0-9a-f-]{36}$/i.test(b.clave_idempotencia || ""))
    throw fallo(400, "Clave de compra inválida.");
  const ref = db()
    .collection(ORDERS)
    .doc(u.uid + "_" + b.clave_idempotencia);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (prev.exists) return prev.data();
    validarFechaRetiro(b.fecha_retiro);
    if (!["efectivo", "tarjeta"].includes(b.metodo))
      throw fallo(400, "Método de pago inválido.");
    const tarjeta =
      b.metodo === "tarjeta" ? validarTarjetaDemo(b.tarjeta) : null;
    if (tarjeta && !tarjeta.valida) throw fallo(400, tarjeta.error);
    const ids = (await tx.get(refCart(u.uid))).data()?.productos ?? [];
    if (!ids.length) throw fallo(400, "Carrito vacío.");
    const productos = await tx.getAll(
      ...ids.map((id) => db().collection("products").doc(id)),
    );
    const stocks = await tx.getAll(...ids.map(refStock));
    const detalles = productos
      .map((s, i) => {
        if (!s.exists) throw fallo(409, "Un producto ya no existe.");
        const p = producto(s),
          holds = vigentes(stocks[i].data()?.holds),
          r = holds[dueno(u.uid)];
        if (!r) return null;
        delete holds[dueno(u.uid)];
        return {
          ...p,
          stock_actual: p.stock_actual - reservado(holds),
          cantidad: r.cantidad,
          subtotal: Math.round(p.precio * r.cantidad * 100) / 100,
        };
      })
      .filter(Boolean);
    const total = Math.round(validarItemsCheckout(detalles) * 100) / 100,
      aprobado = tarjeta?.aprobado ?? true;
    const id = numero(ref.id),
      estado = !aprobado ? "cancelado" : tarjeta ? "pagado" : "pendiente";
    const pedido = {
      uid: u.uid,
      id_pedido: id,
      codigo_pedido: "FS-" + id,
      nombre_cliente: u.nombre,
      email_cliente: u.email,
      total,
      subtotal: total,
      fecha_pedido: ahora(),
      fecha_retiro: b.fecha_retiro,
      fecha_entrega: null,
      metodo_pago: b.metodo,
      estado_pedido: estado,
      estado_pago: estado,
      aprobado,
      mensaje: aprobado
        ? "Pedido registrado."
        : "Pago de demostración rechazado.",
      detalles,
      historial: [],
    };
    tx.create(ref, pedido);
    if (aprobado) {
      stocks.forEach((s) => {
        const holds = vigentes(s.data()?.holds);
        delete holds[dueno(u.uid)];
        const detalle = detalles.find((d) => d.firestore_id === s.id);
        if (detalle)
          holds["p" + id] = { cantidad: detalle.cantidad, expira: null };
        tx.set(s.ref, { holds });
      });
      tx.set(refCart(u.uid), { productos: [] });
    }
    aviso(tx, u.uid, pedido, pedido.mensaje);
    aviso(tx, "@admin", pedido, pedido.mensaje);
    return pedido;
  });
}
async function cambiarPedido(usuario, id, accion, motivo) {
  const docs = await db()
    .collection(ORDERS)
    .where("id_pedido", "==", Number(id))
    .limit(2)
    .get();
  if (docs.size !== 1) throw fallo(404, "Pedido inexistente.");
  const ref = docs.docs[0].ref;
  return db().runTransaction(async (tx) => {
    const p = (await tx.get(ref)).data();
    if (p.fecha_entrega || p.estado_pedido === "cancelado")
      throw fallo(409, "Pedido cerrado.");
    const anterior = p.estado_pedido;
    if (
      accion === "confirmar_pago" &&
      anterior === "pendiente" &&
      p.metodo_pago === "efectivo"
    )
      p.estado_pago = p.estado_pedido = "pagado";
    else if (
      accion === "marcar_pendiente" &&
      anterior === "pagado" &&
      p.metodo_pago === "efectivo"
    )
      p.estado_pago = p.estado_pedido = "pendiente";
    else if (accion === "entregar" || accion === "cancelar") {
      if (accion === "entregar" && anterior !== "pagado")
        throw fallo(409, "El pedido debe estar pagado.");
      if (accion === "cancelar" && (!motivo?.trim() || motivo.length > 440))
        throw fallo(400, "Escribe el motivo de cancelación.");
      const stocks = await tx.getAll(
        ...p.detalles.map((d) => refStock(d.firestore_id)),
      );
      const productos = await tx.getAll(
        ...p.detalles.map((d) =>
          db().collection("products").doc(d.firestore_id),
        ),
      );
      for (let i = 0; i < stocks.length; i++) {
        const h = vigentes(stocks[i].data()?.holds),
          d = p.detalles[i];
        if (accion === "entregar") {
          const stock = productos[i].data()?.stock_actual;
          if (
            !Number.isFinite(stock) ||
            stock < d.cantidad ||
            h["p" + p.id_pedido]?.cantidad !== d.cantidad
          )
            throw fallo(409, "Revisa las existencias reservadas.");
          tx.update(productos[i].ref, { stock_actual: stock - d.cantidad });
          const m = db().collection("inventory_movements").doc();
          tx.create(m, {
            id_movimiento: numero(m.id),
            producto: d.nombre,
            tipo_movimiento: "salida",
            cantidad: d.cantidad,
            fecha_movimiento: ahora(),
            usuario: usuario.nombre,
            id_producto: d.id_producto,
            motivo: "Retiro " + p.codigo_pedido,
          });
        }
        delete h["p" + p.id_pedido];
        tx.set(stocks[i].ref, { holds: h });
      }
      if (accion === "entregar") p.fecha_entrega = ahora();
      else {
        p.estado_pago = p.estado_pedido = "cancelado";
        p.motivo_cancelacion = motivo.trim();
      }
    } else throw fallo(409, "Transición de pedido inválida.");
    p.historial.push({
      id_historial: p.historial.length + 1,
      estado_anterior: anterior,
      estado_nuevo: p.estado_pedido,
      fecha_cambio: ahora(),
      usuario: usuario.nombre,
      motivo: motivo || accion,
    });
    tx.set(ref, p);
    aviso(tx, p.uid, p, "Pedido actualizado");
    return p;
  });
}
module.exports = {
  disponibles,
  leerCarrito,
  modificarCarrito,
  vaciar,
  checkout,
  cambiarPedido,
  refStock,
  reservado,
};
