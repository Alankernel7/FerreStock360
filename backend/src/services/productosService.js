const {
  COLECCIONES,
  db,
  aISO,
  aNumero,
  aBooleano,
  normalizarTexto,
  siguienteId,
  resolverDocumento,
  resolverDocumentoEnTransaccion,
  leerReservasComprometidas,
  leerReservasComprometidasEnTransaccion,
  sumarReservasPorProducto,
  reclamarClaveUnica,
  liberarClaveUnica,
  referenciaClaveUnica,
  idNumericoDocumento,
} = require("../config/firestore");
const { limpiarReservasVencidas } = require("./reservasService");

const mapearProducto = (documento, reservasPorProducto = new Map()) => {
  const data = documento.data() || {};
  const idProducto = idNumericoDocumento(documento, "id_producto");
  const stockActual = aNumero(data.stock_actual);
  const reservadas = aNumero(reservasPorProducto.get(idProducto));
  const imagen1 = data.imagen_1 ?? data.imagen_url ?? null;
  const imagen2 = data.imagen_2 ?? null;

  return {
    id_producto: idProducto,
    nombre: data.nombre || "",
    descripcion: data.descripcion ?? null,
    codigo: data.codigo || "",
    precio: aNumero(data.precio),
    imagen_1: imagen1,
    imagen_2: imagen2,
    imagen_url: imagen1 || imagen2 || null,
    stock_actual: stockActual,
    stock_disponible: Math.max(0, stockActual - reservadas),
    stock_minimo: aNumero(data.stock_minimo, 5),
    id_categoria: aNumero(data.id_categoria ?? data.categoria_id),
    estado: aBooleano(data.estado, true),
    fecha_creacion: aISO(data.fecha_creacion),
  };
};

const obtenerProductos = async ({ soloActivos = false } = {}) => {
  await limpiarReservasVencidas();
  const [productos, reservas] = await Promise.all([
    db().collection(COLECCIONES.productos).get(),
    leerReservasComprometidas(),
  ]);
  const reservasPorProducto = sumarReservasPorProducto(reservas);

  const lista = productos.docs
    .map((documento) => mapearProducto(documento, reservasPorProducto))
    .filter((producto) => (soloActivos ? producto.estado : true));

  if (soloActivos) {
    lista.sort((a, b) => {
      const fechaA = a.fecha_creacion ? Date.parse(a.fecha_creacion) : 0;
      const fechaB = b.fecha_creacion ? Date.parse(b.fecha_creacion) : 0;
      return fechaB - fechaA;
    });
  }

  return lista;
};

const obtenerProductoPorId = async (id) => {
  await limpiarReservasVencidas();
  const documento = await resolverDocumento(
    COLECCIONES.productos,
    "id_producto",
    id
  );
  if (!documento) return undefined;

  const reservas = await leerReservasComprometidas();
  return mapearProducto(documento, sumarReservasPorProducto(reservas));
};

const existeProductoPorCodigo = async (codigo, excluirId = null) => {
  const normalizado = normalizarTexto(codigo);
  const snapshot = await db()
    .collection(COLECCIONES.productos)
    .where("codigo_normalizado", "==", normalizado)
    .get();

  const coincide = (documento) => {
    if (excluirId === null || excluirId === undefined) return true;
    return idNumericoDocumento(documento, "id_producto") !== Number(excluirId);
  };

  if (snapshot.docs.some(coincide)) return true;

  const todos = await db().collection(COLECCIONES.productos).get();
  return todos.docs.some(
    (documento) =>
      normalizarTexto(documento.data().codigo) === normalizado && coincide(documento)
  );
};

const existeCategoriaPorId = async (id) =>
  Boolean(
    await resolverDocumento(COLECCIONES.categorias, "id_categoria", id)
  );

const contarMovimientosPorProducto = async (id) => {
  const snapshot = await db()
    .collection(COLECCIONES.movimientos)
    .where("id_producto", "==", Number(id))
    .count()
    .get();
  return snapshot.data().count;
};

const contarAlertasPorProducto = async (id) => {
  const snapshot = await db()
    .collection(COLECCIONES.alertas)
    .where("id_producto", "==", Number(id))
    .count()
    .get();
  return snapshot.data().count;
};

const estaImagenEnUso = async (ruta) => {
  if (!ruta) return false;

  const [porImagen1, porImagen2, porImagenUrl] = await Promise.all([
    db().collection(COLECCIONES.productos).where("imagen_1", "==", ruta).get(),
    db().collection(COLECCIONES.productos).where("imagen_2", "==", ruta).get(),
    db().collection(COLECCIONES.productos).where("imagen_url", "==", ruta).get(),
  ]);

  return new Set(
    [...porImagen1.docs, ...porImagen2.docs, ...porImagenUrl.docs].map(
      (documento) => documento.id
    )
  ).size > 0;
};

const documentoProducto = (id, datos) => ({
  id_producto: id,
  nombre: datos.nombre,
  descripcion: datos.descripcion || null,
  codigo: datos.codigo,
  codigo_normalizado: normalizarTexto(datos.codigo),
  precio: datos.precio,
  imagen_1: datos.imagen_1 || null,
  imagen_2: datos.imagen_2 || null,
  imagen_url: datos.imagen_1 || datos.imagen_2 || null,
  stock_actual: datos.stock_actual,
  stock_minimo: datos.stock_minimo,
  id_categoria: Number(datos.id_categoria),
  // Alias que usa la app móvil.
  categoria_id: Number(datos.id_categoria),
  estado: datos.estado,
  fecha_creacion: new Date(),
  actualizado_en: new Date(),
});

const crearProducto = async (datos) => {
  const normalizado = normalizarTexto(datos.codigo);
  const idProducto = await siguienteId(
    "productos",
    COLECCIONES.productos,
    "id_producto"
  );

  await db().runTransaction(async (tx) => {
    await reclamarClaveUnica(tx, `producto_codigo:${normalizado}`, idProducto);
    tx.set(
      db().collection(COLECCIONES.productos).doc(String(idProducto)),
      documentoProducto(idProducto, datos)
    );
  });

  return mapearProducto(
    await resolverDocumento(COLECCIONES.productos, "id_producto", idProducto)
  );
};

const actualizarProducto = async (id, datos) => {
  const normalizado = normalizarTexto(datos.codigo);
  let actualizado = null;

  await db().runTransaction(async (tx) => {
    const documento = await resolverDocumentoEnTransaccion(
      tx,
      COLECCIONES.productos,
      "id_producto",
      id
    );
    if (!documento) {
      const error = new Error("El producto no existe");
      error.status = 404;
      throw error;
    }

    const idReal = idNumericoDocumento(documento, "id_producto");
    const reservas = await leerReservasComprometidasEnTransaccion(tx);
    const reservadas = sumarReservasPorProducto(reservas).get(idReal) || 0;

    if (datos.stock_actual < reservadas) {
      const error = new Error(
        `El stock físico no puede quedar por debajo de las ${reservadas} unidades reservadas`
      );
      error.status = 409;
      throw error;
    }

    const anterior = documento.data();
    const normalizadoAnterior = normalizarTexto(anterior.codigo);
    const refAnterior = referenciaClaveUnica(`producto_codigo:${normalizadoAnterior}`);
    const refNueva = referenciaClaveUnica(`producto_codigo:${normalizado}`);
    const [claveAnterior, claveNueva] = await Promise.all([
      tx.get(refAnterior),
      tx.get(refNueva),
    ]);

    if (
      claveNueva.exists &&
      Number(claveNueva.data().id) !== Number(idReal)
    ) {
      const error = new Error("La clave ya est� registrada");
      error.code = "DUPLICADO";
      throw error;
    }

    if (normalizadoAnterior !== normalizado) {
      if (claveAnterior.exists) tx.delete(refAnterior);
      tx.set(refNueva, {
        clave: normalizado,
        id: Number(idReal),
        actualizado_en: new Date(),
      });
    }

    const cambios = {
      ...documentoProducto(idReal, datos),
      fecha_creacion: anterior.fecha_creacion || new Date(),
    };

    tx.set(documento.ref, cambios, { merge: true });
    actualizado = mapearProducto(
      {
        id: documento.id,
        data: () => ({ ...anterior, ...cambios }),
      },
      new Map([[idReal, reservadas]])
    );
  });

  return actualizado;
};

const eliminarProducto = async (id) => {
  let eliminado = false;

  await db().runTransaction(async (tx) => {
    const documento = await resolverDocumentoEnTransaccion(
      tx,
      COLECCIONES.productos,
      "id_producto",
      id
    );
    if (!documento) return;

    const data = documento.data();
    await liberarClaveUnica(
      tx,
      `producto_codigo:${normalizarTexto(data.codigo)}`
    );
    tx.delete(documento.ref);
    eliminado = true;
  });

  return eliminado ? 1 : 0;
};

module.exports = {
  obtenerProductos,
  obtenerProductoPorId,
  estaImagenEnUso,
  existeProductoPorCodigo,
  existeCategoriaPorId,
  contarMovimientosPorProducto,
  contarAlertasPorProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  mapearProducto,
};
