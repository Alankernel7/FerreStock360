// Utilidades compartidas para Firestore.
//
// Este módulo concentra el acceso a datos, la generación de identificadores
// numéricos compatibles con el contrato actual de la API y el manejo de
// fechas. Los servicios no deben usar el SDK de Firestore directamente salvo
// para transacciones que necesiten leer y escribir dentro del mismo contexto.

const crypto = require("node:crypto");
const { obtenerDb } = require("./firebase");

const COLECCIONES = {
  roles: "roles",
  usuarios: "users",
  categorias: "categories",
  productos: "products",
  carritos: "carts",
  carritoDetalles: "cart_items",
  reservas: "reservations",
  pedidos: "orders",
  pedidoDetalles: "order_items",
  pagos: "payments",
  historial: "order_history",
  notificaciones: "notifications",
  movimientos: "inventory_movements",
  alertas: "stock_alerts",
  contadores: "counters",
  unicos: "unique_keys",
  bloqueos: "locks",
  idempotencia: "idempotency_keys",
  reservasSteff: "inventory_holds",
};

const db = () => obtenerDb();

const aFecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (typeof valor === "number") return new Date(valor);
  if (typeof valor === "string") {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
};

const aISO = (valor) => {
  const fecha = aFecha(valor);
  return fecha ? fecha.toISOString() : null;
};

const aFechaISO = (valor) => {
  if (typeof valor === "string") return valor.slice(0, 10);
  const fecha = aFecha(valor);
  return fecha ? fecha.toISOString().slice(0, 10) : null;
};

const aNumero = (valor, defecto = 0) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : defecto;
};

const aBooleano = (valor, defecto = true) => {
  if (typeof valor === "boolean") return valor;
  if (valor === 1 || valor === "1" || valor === "true" || valor === "activo") return true;
  if (valor === 0 || valor === "0" || valor === "false" || valor === "inactivo") return false;
  return defecto;
};

const normalizarTexto = (valor) =>
  String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const hashNumerico = (texto) => {
  const hash = crypto.createHash("sha1").update(String(texto)).digest("hex");
  const numero = Number.parseInt(hash.slice(0, 8), 16);
  return (numero % 2147483646) + 1;
};

// Devuelve el id numérico estable de un documento, priorizando el campo
// explícito (id_producto, id_categoria, id_usuario...). Los documentos creados
// por la app móvil con ids aleatorios reciben un id numérico estable derivado
// del id del documento para no romper el contrato de la API web.
const idNumericoDocumento = (documento, campo) => {
  const data = documento.data() || {};
  const delCampo = Number(data[campo]);
  if (Number.isSafeInteger(delCampo) && delCampo > 0) return delCampo;

  const delDocumento = Number(documento.id);
  if (Number.isSafeInteger(delDocumento) && delDocumento > 0) return delDocumento;

  return hashNumerico(documento.id);
};

const calcularMaximo = async (lector, coleccion, campo) => {
  const snapshot = await lector.get(db().collection(coleccion));
  return snapshot.docs.reduce((maximo, documento) => {
    const valor = idNumericoDocumento(documento, campo);
    return Math.max(maximo, valor);
  }, 0);
};

// Genera un id numérico autoincremental usando la colección counters.
// Los huecos son aceptables: la API nunca reutiliza identificadores.
const siguienteId = async (nombre, coleccion, campo) => {
  const referencia = db().collection(COLECCIONES.contadores).doc(nombre);

  return db().runTransaction(async (tx) => {
    const contador = await tx.get(referencia);
    let actual = contador.exists ? Number(contador.data().valor) || 0 : 0;

    if (!contador.exists) {
      actual = await calcularMaximo(tx, coleccion, campo);
    }

    let nuevo = actual + 1;

    // Evita colisiones con documentos existentes que ya usen ese id.
    for (;;) {
      const candidato = await tx.get(db().collection(coleccion).doc(String(nuevo)));
      if (!candidato.exists) break;
      nuevo += 1;
    }

    tx.set(
      referencia,
      { valor: nuevo, actualizado_en: new Date() },
      { merge: true }
    );

    return nuevo;
  });
};

const coincideId = (documento, campo, id) => {
  const data = documento.data() || {};
  const delCampo = Number(data[campo]);
  if (Number.isSafeInteger(delCampo) && delCampo > 0) return delCampo === Number(id);
  const delDocumento = Number(documento.id);
  if (Number.isSafeInteger(delDocumento) && delDocumento > 0) return delDocumento === Number(id);
  return hashNumerico(documento.id) === Number(id);
};

// Resuelve un documento por id numérico, tolerando documentos heredados con
// id de documento aleatorio (por ejemplo los creados por la app móvil).
const resolverDocumento = async (coleccion, campoId, id) => {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero <= 0) return null;

  const directo = await db().collection(coleccion).doc(String(numero)).get();
  if (directo.exists) {
    const valorCampo = Number(directo.data()?.[campoId]);
    if (!Number.isSafeInteger(valorCampo) || valorCampo === numero) {
      return directo;
    }
  }

  const porCampo = await db()
    .collection(coleccion)
    .where(campoId, "==", numero)
    .limit(1)
    .get();
  if (!porCampo.empty) return porCampo.docs[0];

  const todos = await db().collection(coleccion).get();
  return todos.docs.find((documento) => coincideId(documento, campoId, numero)) || null;
};

const resolverDocumentoEnTransaccion = async (tx, coleccion, campoId, id) => {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero <= 0) return null;

  const directo = await tx.get(db().collection(coleccion).doc(String(numero)));
  if (directo.exists) {
    const valorCampo = Number(directo.data()?.[campoId]);
    if (!Number.isSafeInteger(valorCampo) || valorCampo === numero) {
      return directo;
    }
  }

  const porCampo = await tx.get(
    db().collection(coleccion).where(campoId, "==", numero).limit(1)
  );
  if (!porCampo.empty) return porCampo.docs[0];

  const todos = await tx.get(db().collection(coleccion));
  return todos.docs.find((documento) => coincideId(documento, campoId, numero)) || null;
};

const leerColeccion = async (coleccion) => {
  const snapshot = await db().collection(coleccion).get();
  return snapshot.docs;
};

const leerPorCampo = async (coleccion, campo, valor) => {
  const snapshot = await db().collection(coleccion).where(campo, "==", valor).get();
  return snapshot.docs;
};

const contarPorCampo = async (coleccion, campo, valor) => {
  const snapshot = await db()
    .collection(coleccion)
    .where(campo, "==", valor)
    .count()
    .get();
  return snapshot.data().count;
};

const reservaVigente = (data, ahora = new Date()) => {
  if (data.estado === "confirmada") return true;
  if (data.estado !== "activa") return false;
  const expiracion = aFecha(data.fecha_expiracion);
  return Boolean(expiracion && expiracion.getTime() > ahora.getTime());
};

const adaptarReservasSteff = (holdsDocs, productosDocs, ahora = Date.now()) => {
  const productos = new Map(productosDocs.map((doc) => [doc.id, doc]));
  const reservas = [];
  for (const doc of holdsDocs) {
    const producto = productos.get(doc.id);
    if (!producto || producto.exists === false) continue;
    const idProducto = idNumericoDocumento(producto, "id_producto");
    for (const [propietario, hold] of Object.entries(doc.data().holds || {})) {
      const expira = hold?.expira;
      if (!Number.isFinite(Number(hold?.cantidad)) || Number(hold.cantidad) < 1) continue;
      if (expira !== null && (!Number.isFinite(Number(expira)) || Number(expira) <= ahora)) continue;
      const data = {
        id_producto: idProducto,
        cantidad: Number(hold.cantidad),
        estado: expira === null ? "confirmada" : "activa",
        fecha_expiracion: expira === null ? null : new Date(Number(expira)),
        origen: "inventory_holds",
      };
      reservas.push({ id: `legacy_${doc.id}_${propietario}`, data: () => data });
    }
  }
  return reservas;
};

const leerReservasComprometidas = async () => {
  const [activas, confirmadas, holds] = await Promise.all([
    leerPorCampo(COLECCIONES.reservas, "estado", "activa"),
    leerPorCampo(COLECCIONES.reservas, "estado", "confirmada"),
    leerColeccion(COLECCIONES.reservasSteff),
  ]);
  const productos = holds.length
    ? await db().getAll(...holds.map((doc) => db().collection(COLECCIONES.productos).doc(doc.id)))
    : [];
  const ahora = new Date();
  return [
    ...[...activas, ...confirmadas].filter((documento) => reservaVigente(documento.data(), ahora)),
    ...adaptarReservasSteff(holds, productos),
  ];
};

const leerReservasComprometidasEnTransaccion = async (tx) => {
  const [activas, confirmadas, holds] = await Promise.all([
    tx.get(db().collection(COLECCIONES.reservas).where("estado", "==", "activa")),
    tx.get(db().collection(COLECCIONES.reservas).where("estado", "==", "confirmada")),
    tx.get(db().collection(COLECCIONES.reservasSteff)),
  ]);
  const productos = holds.docs.length
    ? await tx.getAll(...holds.docs.map((doc) => db().collection(COLECCIONES.productos).doc(doc.id)))
    : [];
  const ahora = new Date();
  return [
    ...[...activas.docs, ...confirmadas.docs].filter((documento) => reservaVigente(documento.data(), ahora)),
    ...adaptarReservasSteff(holds.docs, productos),
  ];
};

const sumarReservasPorProducto = (documentos) => {
  const mapa = new Map();
  for (const documento of documentos) {
    const data = documento.data();
    const idProducto = aNumero(data.id_producto);
    mapa.set(idProducto, (mapa.get(idProducto) || 0) + aNumero(data.cantidad));
  }
  return mapa;
};

const claveUnicaId = (clave) =>
  crypto.createHash("sha256").update(String(clave)).digest("hex");

const referenciaClaveUnica = (clave) =>
  db().collection(COLECCIONES.unicos).doc(claveUnicaId(clave));

const existeClaveUnica = async (clave) =>
  (await referenciaClaveUnica(clave).get()).exists;

const reclamarClaveUnica = async (tx, clave, id) => {
  const referencia = referenciaClaveUnica(clave);
  const actual = await tx.get(referencia);
  if (actual.exists) {
    const dueno = Number(actual.data().id);
    if (dueno !== Number(id)) {
      const error = new Error("La clave ya está registrada");
      error.code = "DUPLICADO";
      throw error;
    }
    return;
  }
  tx.set(referencia, {
    clave: normalizarTexto(clave),
    id: Number(id),
    actualizado_en: new Date(),
  });
};

const liberarClaveUnica = async (tx, clave) => {
  tx.delete(referenciaClaveUnica(clave));
};

const asegurarRoles = async () => {
  const roles = await leerColeccion(COLECCIONES.roles);
  const nombres = new Set(roles.map((documento) => documento.data().nombre));
  const lote = db().batch();

  if (!nombres.has("admin")) {
    lote.set(db().collection(COLECCIONES.roles).doc("1"), {
      id_rol: 1,
      nombre: "admin",
      descripcion: "Administrador del sistema",
      actualizado_en: new Date(),
    }, { merge: true });
  }

  if (!nombres.has("cliente")) {
    const idCliente = roles.some((documento) => Number(documento.data().id_rol) === 2)
      ? Math.max(...roles.map((documento) => aNumero(documento.data().id_rol))) + 1
      : 2;
    lote.set(db().collection(COLECCIONES.roles).doc(String(idCliente)), {
      id_rol: idCliente,
      nombre: "cliente",
      descripcion: "Cliente de la tienda en línea",
      actualizado_en: new Date(),
    }, { merge: true });
  }

  await lote.commit();
  return leerColeccion(COLECCIONES.roles);
};

const obtenerRolPorNombre = async (nombre) => {
  const roles = await asegurarRoles();
  const documento = roles.find(
    (item) => normalizarTexto(item.data().nombre) === normalizarTexto(nombre)
  );
  return documento || null;
};

const mapearRol = (documento) => ({
  id_rol: idNumericoDocumento(documento, "id_rol"),
  nombre: documento.data().nombre,
  descripcion: documento.data().descripcion ?? null,
});

const rolVisible = (rol) => {
  const normalizado = normalizarTexto(rol);
  if (normalizado === "admin") return "admin";
  return "cliente";
};

const mapearUsuario = (documento, rolesPorId = null) => {
  const data = documento.data() || {};
  const idUsuario = idNumericoDocumento(documento, "id_usuario");
  const idRolGuardado = Number(data.id_rol);
  const rolGuardado = data.rol;
  let rol = rolGuardado ? rolVisible(rolGuardado) : null;
  let idRol = Number.isSafeInteger(idRolGuardado) && idRolGuardado > 0 ? idRolGuardado : null;

  if (rolesPorId && idRol && rolesPorId.has(idRol)) {
    rol = rolesPorId.get(idRol).nombre;
  }

  if (!idRol && rol) {
    const encontrado = rolesPorId
      ? [...rolesPorId.values()].find((item) => item.nombre === rol)
      : null;
    idRol = encontrado?.id_rol ?? (rol === "admin" ? 1 : 2);
  }

  return {
    id_usuario: idUsuario,
    nombre: data.nombre || "",
    email: data.email || "",
    id_rol: idRol,
    rol: rol || "cliente",
    estado: aBooleano(data.estado, true),
    fecha_creacion: aISO(data.fecha_creacion),
  };
};

const mapaRoles = (documentos) => {
  const mapa = new Map();
  for (const documento of documentos) {
    const rol = mapearRol(documento);
    mapa.set(rol.id_rol, rol);
  }
  return mapa;
};

module.exports = {
  COLECCIONES,
  db,
  aFecha,
  aISO,
  aFechaISO,
  aNumero,
  aBooleano,
  normalizarTexto,
  hashNumerico,
  idNumericoDocumento,
  siguienteId,
  resolverDocumento,
  resolverDocumentoEnTransaccion,
  leerColeccion,
  leerPorCampo,
  contarPorCampo,
  reservaVigente,
  adaptarReservasSteff,
  leerReservasComprometidas,
  leerReservasComprometidasEnTransaccion,
  sumarReservasPorProducto,
  claveUnicaId,
  referenciaClaveUnica,
  existeClaveUnica,
  reclamarClaveUnica,
  liberarClaveUnica,
  asegurarRoles,
  obtenerRolPorNombre,
  mapearRol,
  mapearUsuario,
  mapaRoles,
  rolVisible,
};
