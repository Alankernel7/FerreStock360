const crypto = require("node:crypto");
const {
  COLECCIONES,
  db,
  aFecha,
  aNumero,
  aBooleano,
  idNumericoDocumento,
  resolverDocumento,
  resolverDocumentoEnTransaccion,
  leerReservasComprometidas,
  leerReservasComprometidasEnTransaccion,
  sumarReservasPorProducto,
  siguienteId,
} = require("../config/firestore");
const { validarTarjetaDemo, validarCantidadCarrito, validarItemsCheckout } = require("./checkoutRules");
const { DURACION_RESERVA_MINUTOS } = require("../config/reservas");
const { limpiarReservasVencidas } = require("./reservasService");
const { validarDisponibilidadReserva } = require("./reservasRules");
const { validarFechaRetiro } = require("../config/retiros");

const falla = (message, status) => Object.assign(new Error(message), { status });
const idCarrito = (idUsuario) => Number(idUsuario);
const claveDocumento = (a, b) => `${Number(a)}_${Number(b)}`;
const refId = (coleccion, id) => db().collection(coleccion).doc(String(Number(id)));
const idempotenciaRef = (uid, clave) => db().collection(COLECCIONES.idempotencia)
  .doc(crypto.createHash("sha256").update(`${uid}:${clave}`).digest("hex"));

const mapearCarrito = (idUsuario, items, productos, reservas) => {
  const uid = Number(idUsuario);
  const id = idCarrito(uid);
  const reservasPorProducto = sumarReservasPorProducto(reservas);
  const productosPorId = new Map(productos.map((doc) => [idNumericoDocumento(doc, "id_producto"), doc]));
  const reservasPropias = new Map(reservas
    .filter((doc) => Number(doc.data().id_usuario) === uid && Number(doc.data().id_carrito) === id)
    .map((doc) => [Number(doc.data().id_producto), doc.data()]));

  return items.map((doc) => {
    const item = doc.data();
    const productId = Number(item.id_producto);
    const productoDoc = productosPorId.get(productId);
    if (!productoDoc) return null;
    const producto = productoDoc.data();
    const stock = aNumero(producto.stock_actual);
    const propia = reservasPropias.get(productId);
    const reservadas = aNumero(reservasPorProducto.get(productId));
    const disponible = Math.max(0, stock - reservadas);
    const fechaExpira = propia?.estado === "activa" ? aFecha(propia.fecha_expiracion) : null;
    return {
      id_producto: productId,
      cantidad: aNumero(item.cantidad),
      nombre: producto.nombre || "",
      codigo: producto.codigo || "",
      precio: aNumero(producto.precio),
      stock_actual: stock,
      stock_fisico: stock,
      unidades_reservadas: reservadas,
      stock_disponible: disponible,
      maximo_carrito: Math.max(0, stock - (reservadas - aNumero(propia?.cantidad))),
      estado: aBooleano(producto.estado, true),
      imagen: producto.imagen_1 || producto.imagen_2 || producto.imagen_url || null,
      estado_reserva: propia?.estado || "sin_reserva",
      fecha_expiracion: fechaExpira?.toISOString() || null,
      segundos_restantes: fechaExpira ? Math.max(0, Math.floor((fechaExpira.getTime() - Date.now()) / 1000)) : 0,
      duracion_reserva_minutos: DURACION_RESERVA_MINUTOS,
    };
  }).filter(Boolean).sort((a, b) => a.id_producto - b.id_producto);
};

const obtenerCarrito = async (idUsuario) => {
  await limpiarReservasVencidas();
  const [items, productos, reservas] = await Promise.all([
    db().collection(COLECCIONES.carritoDetalles).where("id_usuario", "==", Number(idUsuario)).get(),
    db().collection(COLECCIONES.productos).get(),
    leerReservasComprometidas(),
  ]);
  return mapearCarrito(idUsuario, items.docs, productos.docs, reservas);
};

const agregarAlCarrito = async (idUsuario, idProducto, cantidad) => {
  const uid = Number(idUsuario);
  const pid = Number(idProducto);
  if (!Number.isSafeInteger(uid) || uid <= 0) throw falla("El usuario no es válido", 400);
  return db().runTransaction(async (tx) => {
    const carritoRef = db().collection(COLECCIONES.carritos).doc(String(uid));
    const itemRef = db().collection(COLECCIONES.carritoDetalles).doc(claveDocumento(uid, pid));
    const reservaRef = db().collection(COLECCIONES.reservas).doc(claveDocumento(uid, pid));
    const [carrito, item, productoDoc, reservas] = await Promise.all([
      tx.get(carritoRef),
      tx.get(itemRef),
      resolverDocumentoEnTransaccion(tx, COLECCIONES.productos, "id_producto", pid),
      leerReservasComprometidasEnTransaccion(tx),
    ]);
    const producto = productoDoc?.data();
    const actual = producto && { ...producto, estado: aBooleano(producto.estado, true), stock_actual: aNumero(producto.stock_actual) };
    validarCantidadCarrito({ producto: actual, cantidad });
    const propia = reservas.find((doc) => doc.id === reservaRef.id);
    const total = sumarReservasPorProducto(reservas).get(pid) || 0;
    validarDisponibilidadReserva({ stockFisico: actual.stock_actual, reservasTotales: total, reservaPropia: aNumero(propia?.data().cantidad), cantidad });

    const ahora = new Date();
    const id = idCarrito(uid);
    const expira = new Date(ahora.getTime() + DURACION_RESERVA_MINUTOS * 60_000);
    if (!carrito.exists) tx.set(carritoRef, { id_carrito: id, id_usuario: uid, fecha_creacion: ahora, actualizado_en: ahora });
    tx.set(itemRef, { id_usuario: uid, id_carrito: id, id_producto: pid, cantidad, fecha_actualizacion: ahora });
    tx.set(reservaRef, { id_reserva: Number(uid) * 1000000 + (pid % 1000000), id_usuario: uid, id_carrito: id, id_producto: pid, cantidad, estado: "activa", fecha_creacion: ahora, fecha_expiracion: expira, actualizado_en: ahora });
    return { id_producto: pid, cantidad, fecha_expiracion: expira.toISOString() };
  }).then(() => obtenerCarrito(uid));
};

const quitarDelCarrito = async (idUsuario, idProducto) => {
  const uid = Number(idUsuario); const pid = Number(idProducto);
  await db().runTransaction(async (tx) => {
    const itemRef = db().collection(COLECCIONES.carritoDetalles).doc(claveDocumento(uid, pid));
    const reservaRef = db().collection(COLECCIONES.reservas).doc(claveDocumento(uid, pid));
    const [item, reserva] = await Promise.all([tx.get(itemRef), tx.get(reservaRef)]);
    if (reserva.exists && reserva.data().estado === "activa") tx.update(reservaRef, { estado: "liberada", actualizado_en: new Date() });
    if (item.exists) tx.delete(itemRef);
  });
  return obtenerCarrito(uid);
};

const vaciarCarrito = async (idUsuario) => {
  const uid = Number(idUsuario); const id = idCarrito(uid);
  await db().runTransaction(async (tx) => {
    const [items, reservas] = await Promise.all([
      tx.get(db().collection(COLECCIONES.carritoDetalles).where("id_usuario", "==", uid)),
      tx.get(db().collection(COLECCIONES.reservas).where("id_carrito", "==", id)),
    ]);
    for (const item of items.docs) tx.delete(item.ref);
    for (const reserva of reservas.docs) if (reserva.data().estado === "activa") tx.update(reserva.ref, { estado: "liberada", actualizado_en: new Date() });
  });
  return [];
};

const checkout = async ({ idUsuario, metodo, tarjeta, claveIdempotencia, fechaRetiro }) => {
  if (!["efectivo", "tarjeta"].includes(metodo)) throw falla("Selecciona un método de pago válido", 400);
  validarFechaRetiro(fechaRetiro);
  if (!/^[0-9a-f-]{36}$/i.test(claveIdempotencia || "")) throw falla("La solicitud de compra no es válida", 400);
  const tarjetaResultado = metodo === "tarjeta" ? validarTarjetaDemo(tarjeta) : null;
  if (tarjetaResultado && !tarjetaResultado.valida) throw falla(tarjetaResultado.error, 400);
  const uid = Number(idUsuario); const carritoId = idCarrito(uid);
  const idPedido = await siguienteId("pedidos", COLECCIONES.pedidos, "id_pedido");
  const idempotencia = idempotenciaRef(uid, claveIdempotencia);
  const pedidoRef = db().collection(COLECCIONES.pedidos).doc(String(idPedido));

  const resultado = await db().runTransaction(async (tx) => {
    const repetida = await tx.get(idempotencia);
    if (repetida.exists) return { id_pedido: Number(repetida.data().id_pedido), duplicado: true };
    const [itemsSnap, reservas] = await Promise.all([
      tx.get(db().collection(COLECCIONES.carritoDetalles).where("id_usuario", "==", uid)),
      leerReservasComprometidasEnTransaccion(tx),
    ]);
    const items = [];
    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data();
      const productoDoc = await resolverDocumentoEnTransaccion(tx, COLECCIONES.productos, "id_producto", item.id_producto);
      if (productoDoc) items.push({ ...productoDoc.data(), id_producto: idNumericoDocumento(productoDoc, "id_producto"), cantidad: aNumero(item.cantidad), _ref: productoDoc.ref, _cartRef: itemDoc.ref });
    }
    const subtotal = Math.round(validarItemsCheckout(items.map((item) => ({ ...item, estado: aBooleano(item.estado, true), stock_actual: aNumero(item.stock_actual), precio: aNumero(item.precio) }))) * 100) / 100;
    const reservasPropias = reservas.filter((doc) => Number(doc.data().id_usuario) === uid && Number(doc.data().id_carrito) === carritoId && doc.data().estado === "activa" && aFecha(doc.data().fecha_expiracion)?.getTime() > Date.now());
    if (reservasPropias.length !== items.length || items.some((item) => !reservasPropias.some((r) => Number(r.data().id_producto) === item.id_producto && Number(r.data().cantidad) === item.cantidad))) throw falla("Actualiza las reservas de tu carrito antes de confirmar el pedido.", 409);

    const aprobado = !tarjetaResultado || tarjetaResultado.aprobado;
    const confirmar = metodo !== "tarjeta" || aprobado;
    const estadoPago = metodo === "tarjeta" ? (aprobado ? "aprobado" : "rechazado") : "pendiente";
    const estadoPedido = metodo === "tarjeta" ? (aprobado ? "pendiente_retiro" : "rechazado") : "reservado";
    const fecha = new Date();
    const codigo = `FS-${fechaRetiro.replaceAll("-", "")}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    const pagoRef = db().collection(COLECCIONES.pagos).doc(String(idPedido));
    const historiaRef = db().collection(COLECCIONES.historial).doc();
    const salida = { id_pedido: idPedido, codigo_pedido: codigo, id_usuario: uid, fecha_pedido: fecha, fecha_retiro: fechaRetiro, subtotal, total: subtotal, metodo_pago: metodo, estado_pedido: estadoPedido, estado_pago: estadoPago, fecha_entrega: null, fecha_cancelacion: null, motivo_cancelacion: null };
    tx.set(pedidoRef, salida);
    tx.set(pagoRef, { id_pedido: idPedido, id_usuario: uid, metodo, estado: estadoPago, referencia_demo: tarjetaResultado?.ultimos4 || null, fecha_operacion: fecha });
    tx.set(idempotencia, { id_usuario: uid, id_pedido: idPedido, clave_idempotencia: claveIdempotencia, creado_en: fecha });
    tx.set(historiaRef, { id_pedido: idPedido, id_usuario: uid, estado_anterior: null, estado_nuevo: estadoPedido, estado_pago_anterior: null, estado_pago_nuevo: estadoPago, motivo: "Pedido creado desde checkout", fecha_cambio: fecha });
    for (let i = 0; i < items.length; i++) {
      const item = items[i]; const reserva = reservasPropias.find((r) => Number(r.data().id_producto) === item.id_producto);
      const detalleRef = db().collection(COLECCIONES.pedidoDetalles).doc(`${idPedido}_${item.id_producto}`);
      tx.set(detalleRef, { id_pedido: idPedido, id_usuario: uid, id_producto: item.id_producto, nombre_producto: item.nombre, codigo_producto: item.codigo || "", precio_unitario: aNumero(item.precio), cantidad: item.cantidad, subtotal: Math.round(aNumero(item.precio) * item.cantidad * 100) / 100, imagen_url: item.imagen_1 || item.imagen_2 || item.imagen_url || null });
      if (confirmar) tx.update(reserva.ref, { estado: "confirmada", id_pedido: idPedido, fecha_expiracion: null, actualizado_en: fecha });
      if (confirmar) tx.delete(item._cartRef);
    }
    return { ...salida, referencia_demo: tarjetaResultado?.ultimos4 || null, aprobado, mensaje: metodo === "efectivo" ? "Reserva confirmada. El pago queda pendiente hasta el retiro." : aprobado ? "Pago de demostración aprobado." : "Pago de demostración rechazado.", duplicado: false };
  });

  if (resultado.duplicado) {
    const documento = await resolverDocumento(COLECCIONES.pedidos, "id_pedido", resultado.id_pedido);
    if (!documento) return resultado;
    const id = idNumericoDocumento(documento, "id_pedido");
    const pago = await refId(COLECCIONES.pagos, id).get();
    return { ...documento.data(), estado_pago: pago.exists ? pago.data().estado : null, referencia_demo: pago.exists ? pago.data().referencia_demo || null : null, duplicado: true };
  }
  return resultado;
};

module.exports = { obtenerCarrito, agregarAlCarrito, quitarDelCarrito, vaciarCarrito, checkout };
