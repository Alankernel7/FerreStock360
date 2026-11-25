const {
  COLECCIONES,
  db,
  normalizarTexto,
  siguienteId,
  resolverDocumento,
  resolverDocumentoEnTransaccion,
  reclamarClaveUnica,
  liberarClaveUnica,
  referenciaClaveUnica,
  idNumericoDocumento,
} = require("../config/firestore");

const mapearCategoria = (documento) => {
  const data = documento.data();
  return {
    id_categoria: idNumericoDocumento(documento, "id_categoria"),
    nombre: data.nombre || "",
    descripcion: data.descripcion ?? null,
  };
};

const obtenerCategorias = async () => {
  const snapshot = await db().collection(COLECCIONES.categorias).get();
  return snapshot.docs
    .map(mapearCategoria)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
};

const obtenerCategoriaPorId = async (id) => {
  const documento = await resolverDocumento(
    COLECCIONES.categorias,
    "id_categoria",
    id
  );
  return documento ? mapearCategoria(documento) : undefined;
};

const existeCategoriaPorNombre = async (nombre, excluirId = null) => {
  const normalizado = normalizarTexto(nombre);
  const snapshot = await db()
    .collection(COLECCIONES.categorias)
    .where("nombre_normalizado", "==", normalizado)
    .get();

  const coincide = (documento) => {
    if (excluirId === null || excluirId === undefined) return true;
    return idNumericoDocumento(documento, "id_categoria") !== Number(excluirId);
  };

  if (snapshot.docs.some(coincide)) return true;

  const todos = await db().collection(COLECCIONES.categorias).get();
  return todos.docs.some(
    (documento) =>
      normalizarTexto(documento.data().nombre) === normalizado && coincide(documento)
  );
};

const contarProductosPorCategoria = async (id) => {
  const [porId, porAlias] = await Promise.all([
    db().collection(COLECCIONES.productos).where("id_categoria", "==", Number(id)).get(),
    db().collection(COLECCIONES.productos).where("categoria_id", "==", Number(id)).get(),
  ]);
  return new Set([...porId.docs, ...porAlias.docs].map((documento) => documento.id)).size;
};

const crearCategoria = async (datos) => {
  const normalizado = normalizarTexto(datos.nombre);
  const idCategoria = await siguienteId(
    "categorias",
    COLECCIONES.categorias,
    "id_categoria"
  );

  await db().runTransaction(async (tx) => {
    await reclamarClaveUnica(tx, `categoria_nombre:${normalizado}`, idCategoria);
    tx.set(db().collection(COLECCIONES.categorias).doc(String(idCategoria)), {
      id_categoria: idCategoria,
      nombre: datos.nombre,
      nombre_normalizado: normalizado,
      descripcion: datos.descripcion || null,
      fecha_creacion: new Date(),
      actualizado_en: new Date(),
    });
  });

  return {
    id_categoria: idCategoria,
    nombre: datos.nombre,
    descripcion: datos.descripcion || null,
  };
};

const actualizarCategoria = async (id, datos) => {
  const normalizado = normalizarTexto(datos.nombre);
  let actualizada = null;

  await db().runTransaction(async (tx) => {
    const documento = await resolverDocumentoEnTransaccion(
      tx,
      COLECCIONES.categorias,
      "id_categoria",
      id
    );
    if (!documento) return;

    const anterior = documento.data();
    const normalizadoAnterior = normalizarTexto(anterior.nombre);
    const refAnterior = referenciaClaveUnica(`categoria_nombre:${normalizadoAnterior}`);
    const refNueva = referenciaClaveUnica(`categoria_nombre:${normalizado}`);
    const [claveAnterior, claveNueva] = await Promise.all([
      tx.get(refAnterior),
      tx.get(refNueva),
    ]);

    if (
      claveNueva.exists &&
      Number(claveNueva.data().id) !== Number(idNumericoDocumento(documento, "id_categoria"))
    ) {
      const error = new Error("La clave ya est� registrada");
      error.code = "DUPLICADO";
      throw error;
    }

    if (normalizadoAnterior !== normalizado) {
      if (claveAnterior.exists) tx.delete(refAnterior);
      tx.set(refNueva, {
        clave: normalizado,
        id: Number(idNumericoDocumento(documento, "id_categoria")),
        actualizado_en: new Date(),
      });
    }

    tx.set(
      documento.ref,
      {
        id_categoria: idNumericoDocumento(documento, "id_categoria"),
        nombre: datos.nombre,
        nombre_normalizado: normalizado,
        descripcion: datos.descripcion || null,
        actualizado_en: new Date(),
      },
      { merge: true }
    );

    actualizada = {
      id_categoria: idNumericoDocumento(documento, "id_categoria"),
      nombre: datos.nombre,
      descripcion: datos.descripcion || null,
    };
  });

  return actualizada;
};

const eliminarCategoria = async (id) => {
  let eliminada = false;

  await db().runTransaction(async (tx) => {
    const documento = await resolverDocumentoEnTransaccion(
      tx,
      COLECCIONES.categorias,
      "id_categoria",
      id
    );
    if (!documento) return;

    const data = documento.data();
    await liberarClaveUnica(
      tx,
      `categoria_nombre:${normalizarTexto(data.nombre)}`
    );
    tx.delete(documento.ref);
    eliminada = true;
  });

  return eliminada ? 1 : 0;
};

module.exports = {
  obtenerCategorias,
  obtenerCategoriaPorId,
  existeCategoriaPorNombre,
  contarProductosPorCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  mapearCategoria,
};
