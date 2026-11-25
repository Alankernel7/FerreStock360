const {
  COLECCIONES,
  db,
  aISO,
  aNumero,
  aBooleano,
  hashNumerico,
  idNumericoDocumento,
} = require("../config/firestore");

// La sincronización de alertas se apoya en transacciones de Firestore.
// Se conserva la función por compatibilidad con los servicios que la invocan.
const bloquearNotificaciones = async () => {};

const TIPOS_STOCK = new Set(["stock_bajo", "producto_agotado"]);

const tipoAlerta = (producto) =>
  Number(producto.stock_actual) === 0
    ? "producto_agotado"
    : Number(producto.stock_actual) <= Number(producto.stock_minimo)
      ? "stock_bajo"
      : null;

const nuevaNotificacion = (datos) => {
  const referencia = db().collection(COLECCIONES.notificaciones).doc();
  return {
    referencia,
    datos: {
      id_notificacion: hashNumerico(referencia.id),
      ...datos,
      leida: false,
      fecha_creacion: new Date(),
      fecha_lectura: null,
    },
  };
};

const crearNotificacion = (tx, datos) => {
  const nueva = nuevaNotificacion({
    id_movimiento: null,
    id_pedido: null,
    id_usuario: null,
    estado_stock: null,
    ...datos,
  });
  tx.set(nueva.referencia, nueva.datos);
  return nueva.datos;
};

const leerAlertasProducto = async (tx, idProducto) => {
  const snapshot = await tx.get(
    db()
      .collection(COLECCIONES.notificaciones)
      .where("id_producto", "==", Number(idProducto))
  );

  return snapshot.docs.filter((documento) => {
    const data = documento.data();
    return data.estado_stock === "activa" && TIPOS_STOCK.has(data.tipo);
  });
};

const aplicarAlertaStock = (tx, producto, activas) => {
  const tipoActual = tipoAlerta(producto);

  if (activas.length === 1 && activas[0].data().tipo === tipoActual) return;
  if (!tipoActual && activas.length === 0) return;

  for (const documento of activas) {
    tx.update(documento.ref, {
      estado_stock: "resuelta",
      actualizado_en: new Date(),
    });
  }

  if (!tipoActual) return;

  const agotado = tipoActual === "producto_agotado";
  const nueva = nuevaNotificacion({
    tipo: tipoActual,
    titulo: agotado ? "Producto agotado" : "Stock bajo",
    descripcion: agotado
      ? `${producto.nombre} (${producto.codigo}) quedó sin existencias.`
      : `${producto.nombre} (${producto.codigo}) tiene ${producto.stock_actual} unidades; mínimo ${producto.stock_minimo}.`,
    id_producto: Number(producto.id_producto),
    id_movimiento: null,
    id_pedido: null,
    id_usuario: null,
    estado_stock: "activa",
  });
  tx.set(nueva.referencia, nueva.datos);
};

const sincronizarAlertaStock = async (tx, producto) => {
  const activas = await leerAlertasProducto(tx, producto.id_producto);
  aplicarAlertaStock(tx, producto, activas);
};

const reconciliarAlertasStock = async (tx) => {
  const [productos, notificaciones] = await Promise.all([
    tx.get(db().collection(COLECCIONES.productos)),
    tx.get(
      db()
        .collection(COLECCIONES.notificaciones)
        .where("estado_stock", "==", "activa")
    ),
  ]);

  const productosActivos = productos.docs.filter(
    (documento) => aBooleano(documento.data().estado, true)
  );
  const activasPorProducto = new Map();

  for (const documento of notificaciones.docs) {
    const data = documento.data();
    if (!TIPOS_STOCK.has(data.tipo)) continue;
    const idProducto = aNumero(data.id_producto);
    if (!activasPorProducto.has(idProducto)) activasPorProducto.set(idProducto, []);
    activasPorProducto.get(idProducto).push(documento);
  }

  const productosPorId = new Map();
  for (const documento of productosActivos) {
    productosPorId.set(
      idNumericoDocumento(documento, "id_producto"),
      documento.data()
    );
  }

  for (const [idProducto, documentos] of activasPorProducto) {
    const producto = productosPorId.get(idProducto);
    const esperado = producto ? tipoAlerta(producto) : null;

    for (const documento of documentos) {
      if (documento.data().tipo !== esperado) {
        tx.update(documento.ref, {
          estado_stock: "resuelta",
          actualizado_en: new Date(),
        });
      }
    }
  }

  for (const documento of productosActivos) {
    const data = documento.data();
    const idProducto = idNumericoDocumento(documento, "id_producto");
    const esperado = tipoAlerta(data);
    if (!esperado) continue;

    const existentes = (activasPorProducto.get(idProducto) || []).filter(
      (item) => item.data().tipo === esperado
    );
    if (existentes.length > 0) continue;

    const agotado = esperado === "producto_agotado";
    const nueva = nuevaNotificacion({
      tipo: esperado,
      titulo: agotado ? "Producto agotado" : "Stock bajo",
      descripcion: agotado
        ? `${data.nombre} (${data.codigo}) está agotado.`
        : `${data.nombre} (${data.codigo}) tiene ${data.stock_actual} unidades; mínimo ${data.stock_minimo}.`,
      id_producto: idProducto,
      id_movimiento: null,
      id_pedido: null,
      id_usuario: null,
      estado_stock: "activa",
    });
    tx.set(nueva.referencia, nueva.datos);
  }
};

const mapearNotificacion = (documento, productosPorId = new Map()) => {
  const data = documento.data() || {};
  const idProducto = data.id_producto === null || data.id_producto === undefined
    ? null
    : aNumero(data.id_producto);
  return {
    id_notificacion:
      aNumero(data.id_notificacion) ||
      idNumericoDocumento(documento, "id_notificacion"),
    tipo: data.tipo,
    titulo: data.titulo || "",
    descripcion: data.descripcion || "",
    id_producto: idProducto,
    producto: idProducto ? productosPorId.get(idProducto) || null : null,
    id_movimiento: data.id_movimiento === null || data.id_movimiento === undefined
      ? null
      : aNumero(data.id_movimiento),
    id_pedido: data.id_pedido === null || data.id_pedido === undefined
      ? null
      : aNumero(data.id_pedido),
    leida: aBooleano(data.leida, false),
    fecha_creacion: aISO(data.fecha_creacion),
    estado_stock: data.estado_stock ?? null,
  };
};

const productosPorId = async () => {
  const productos = await db().collection(COLECCIONES.productos).get();
  const mapa = new Map();
  for (const documento of productos.docs) {
    mapa.set(
      idNumericoDocumento(documento, "id_producto"),
      documento.data().nombre || ""
    );
  }
  return mapa;
};

const ordenarNotificaciones = (lista) =>
  lista.sort((a, b) => {
    const fechaA = a.fecha_creacion ? Date.parse(a.fecha_creacion) : 0;
    const fechaB = b.fecha_creacion ? Date.parse(b.fecha_creacion) : 0;
    return fechaB - fechaA || b.id_notificacion - a.id_notificacion;
  });

const listarNotificaciones = async () => {
  await db().runTransaction((tx) => reconciliarAlertasStock(tx));

  const [documentos, productos] = await Promise.all([
    db().collection(COLECCIONES.notificaciones).get(),
    productosPorId(),
  ]);

  const notificaciones = ordenarNotificaciones(
    documentos.docs
      .filter((documento) => {
        const data = documento.data();
        return (data.id_usuario === null || data.id_usuario === undefined) && (!data.uid || data.uid === "@admin");
      })
      .map((documento) => mapearNotificacion(documento, productos))
  ).slice(0, 50);

  const noLeidas = documentos.docs.filter(
      (documento) => {
        const data = documento.data();
        return (data.id_usuario === null || data.id_usuario === undefined) && (!data.uid || data.uid === "@admin") && !aBooleano(data.leida, false);
      }
  ).length;

  return { notificaciones, no_leidas: noLeidas };
};

const buscarNotificacion = async (id, idUsuario = null, firebaseUid = null) => {
  const snapshot = await db()
    .collection(COLECCIONES.notificaciones)
    .where("id_notificacion", "==", Number(id))
    .get();

  return snapshot.docs.find((documento) => {
    const data = documento.data();
    if (idUsuario === null) {
      return (data.id_usuario === null || data.id_usuario === undefined) && (!data.uid || data.uid === "@admin");
    }
    return Number(data.id_usuario) === Number(idUsuario) || data.uid === firebaseUid;
  }) || null;
};

const marcarNotificacionLeida = async (id) => {
  const documento = await buscarNotificacion(id);
  if (!documento) return null;
  await documento.ref.update({
    leida: true,
    fecha_lectura: new Date(),
    actualizado_en: new Date(),
  });
  return { id_notificacion: Number(id) };
};

const marcarTodasLeidas = async () => {
  const snapshot = await db()
    .collection(COLECCIONES.notificaciones)
    .where("leida", "==", false)
    .get();
  const lote = db().batch();
  let cambios = 0;

  for (const documento of snapshot.docs) {
    const data = documento.data();
    if ((data.id_usuario !== null && data.id_usuario !== undefined) || (data.uid && data.uid !== "@admin")) continue;
    lote.update(documento.ref, {
      leida: true,
      fecha_lectura: new Date(),
      actualizado_en: new Date(),
    });
    cambios += 1;
  }

  if (cambios > 0) await lote.commit();
};

const listarNotificacionesCliente = async (idUsuario, firebaseUid = null) => {
  const [documentos, productos] = await Promise.all([
    db().collection(COLECCIONES.notificaciones).get(),
    productosPorId(),
  ]);

  const propias = documentos.docs.filter(
    (documento) => Number(documento.data().id_usuario) === Number(idUsuario) || documento.data().uid === firebaseUid
  );

  const notificaciones = ordenarNotificaciones(
    propias.map((documento) => mapearNotificacion(documento, productos))
  ).slice(0, 50);

  return {
    notificaciones,
    no_leidas: propias.filter(
      (documento) => !aBooleano(documento.data().leida, false)
    ).length,
  };
};

const marcarNotificacionClienteLeida = async (idUsuario, id, firebaseUid = null) => {
  const documento = await buscarNotificacion(id, idUsuario, firebaseUid);
  if (!documento) return null;
  await documento.ref.update({
    leida: true,
    fecha_lectura: new Date(),
    actualizado_en: new Date(),
  });
  return { id_notificacion: Number(id) };
};

const marcarTodasClienteLeidas = async (idUsuario, firebaseUid = null) => {
  const snapshot = await db().collection(COLECCIONES.notificaciones).where("leida", "==", false).get();
  const lote = db().batch();
  let cambios = 0;
  for (const documento of snapshot.docs) {
    const data = documento.data();
    if (Number(data.id_usuario) !== Number(idUsuario) && data.uid !== firebaseUid) continue;
    lote.update(documento.ref, {
      leida: true,
      fecha_lectura: new Date(),
      actualizado_en: new Date(),
    });
    cambios += 1;
  }
  if (cambios) await lote.commit();
};

module.exports = {
  bloquearNotificaciones,
  crearNotificacion,
  leerAlertasProducto,
  aplicarAlertaStock,
  sincronizarAlertaStock,
  reconciliarAlertasStock,
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  listarNotificacionesCliente,
  marcarNotificacionClienteLeida,
  marcarTodasClienteLeidas,
};
