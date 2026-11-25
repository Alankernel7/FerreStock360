const {
  COLECCIONES,
  db,
  aNumero,
  aBooleano,
  hashNumerico,
  idNumericoDocumento,
  resolverDocumentoEnTransaccion,
  leerReservasComprometidas,
  leerReservasComprometidasEnTransaccion,
  sumarReservasPorProducto,
} = require("../config/firestore");
const {
  crearNotificacion,
  leerAlertasProducto,
  aplicarAlertaStock,
} = require("./notificacionesService");
const { limpiarReservasVencidas } = require("./reservasService");

const listarInventario = async ({ busqueda, categoria, stock, orden, direccion }) => {
  await limpiarReservasVencidas();

  const [productos, categorias, reservas] = await Promise.all([
    db().collection(COLECCIONES.productos).get(),
    db().collection(COLECCIONES.categorias).get(),
    leerReservasComprometidas(),
  ]);

  const reservasPorProducto = sumarReservasPorProducto(reservas);
  const categoriasPorId = new Map();
  for (const documento of categorias.docs) {
    categoriasPorId.set(
      idNumericoDocumento(documento, "id_categoria"),
      documento.data().nombre || ""
    );
  }

  const termino = busqueda ? String(busqueda).toLowerCase() : null;
  const idCategoria = categoria ? Number(categoria) : null;

  const filas = productos.docs
    .filter((documento) => aBooleano(documento.data().estado, true))
    .map((documento) => {
      const data = documento.data();
      const idProducto = idNumericoDocumento(documento, "id_producto");
      const stockFisico = aNumero(data.stock_actual);
      const reservadas = aNumero(reservasPorProducto.get(idProducto));
      const disponible = Math.max(0, stockFisico - reservadas);
      const minimo = aNumero(data.stock_minimo);
      const estadoInventario =
        disponible <= 0 ? "agotado" : disponible <= minimo ? "bajo" : "normal";

      return {
        id_producto: idProducto,
        codigo: data.codigo || "",
        nombre: data.nombre || "",
        imagen_1: data.imagen_1 ?? null,
        imagen_2: data.imagen_2 ?? null,
        stock_actual: stockFisico,
        stock_fisico: stockFisico,
        unidades_reservadas: reservadas,
        stock_disponible: disponible,
        stock_minimo: minimo,
        id_categoria: Number(data.id_categoria ?? data.categoria_id) || null,
        categoria: categoriasPorId.get(Number(data.id_categoria ?? data.categoria_id)) || null,
        estado: aBooleano(data.estado, true),
        estado_inventario: estadoInventario,
      };
    })
    .filter((fila) => {
      if (termino) {
        const texto = `${fila.nombre} ${fila.codigo}`.toLowerCase();
        if (!texto.includes(termino)) return false;
      }
      if (idCategoria && fila.id_categoria !== idCategoria) return false;
      if (stock === "bajo") {
        if (!(fila.stock_disponible > 0 && fila.stock_disponible <= fila.stock_minimo)) {
          return false;
        }
      }
      if (stock === "agotado" && fila.stock_disponible > 0) return false;
      return true;
    });

  const sentido = direccion === "desc" ? -1 : 1;
  const criterio = orden === "cantidad" ? "stock_disponible" : "nombre";
  filas.sort((a, b) => {
    if (criterio === "cantidad") {
      return (a.stock_disponible - b.stock_disponible) * sentido || a.id_producto - b.id_producto;
    }
    return a.nombre.localeCompare(b.nombre, "es") * sentido || a.id_producto - b.id_producto;
  });

  const estadisticas = {
    unidades_fisicas: 0,
    unidades_reservadas: 0,
    unidades_disponibles: 0,
    total_productos: 0,
    con_stock: 0,
    stock_bajo: 0,
    agotados: 0,
  };

  for (const documento of productos.docs) {
    if (!aBooleano(documento.data().estado, true)) continue;
    const data = documento.data();
    const idProducto = idNumericoDocumento(documento, "id_producto");
    const fisico = aNumero(data.stock_actual);
    const reservadas = aNumero(reservasPorProducto.get(idProducto));
    const disponible = Math.max(0, fisico - reservadas);
    const minimo = aNumero(data.stock_minimo);

    estadisticas.unidades_fisicas += fisico;
    estadisticas.unidades_reservadas += reservadas;
    estadisticas.unidades_disponibles += disponible;
    estadisticas.total_productos += 1;
    if (disponible > 0) estadisticas.con_stock += 1;
    if (disponible > 0 && disponible <= minimo) estadisticas.stock_bajo += 1;
    if (disponible <= 0) estadisticas.agotados += 1;
  }

  return { productos: filas, estadisticas };
};

const registrarMovimiento = async ({ idProducto, idUsuario, tipo, cantidad, motivo }) => {
  const idProductoNumero = Number(idProducto);
  const idUsuarioNumero = Number(idUsuario);
  const cantidadNumero = Number(cantidad);

  if (!Number.isSafeInteger(idProductoNumero) || idProductoNumero <= 0) {
    const error = new Error("El producto no es válido");
    error.status = 400;
    throw error;
  }
  if (!Number.isSafeInteger(cantidadNumero) || cantidadNumero <= 0) {
    const error = new Error("La cantidad debe ser un entero positivo");
    error.status = 400;
    throw error;
  }
  if (tipo !== "entrada" && tipo !== "salida") {
    const error = new Error("El tipo de movimiento no es válido");
    error.status = 400;
    throw error;
  }

  return db().runTransaction(async (tx) => {
    const documento = await resolverDocumentoEnTransaccion(
      tx,
      COLECCIONES.productos,
      "id_producto",
      idProductoNumero
    );

    if (!documento || !aBooleano(documento.data().estado, true)) {
      const error = new Error("El producto no existe o está inactivo");
      error.status = 404;
      throw error;
    }

    const data = documento.data();
    const reservas = await leerReservasComprometidasEnTransaccion(tx);
    const unidadesReservadas = sumarReservasPorProducto(reservas).get(idProductoNumero) || 0;
    const alertas = await leerAlertasProducto(tx, idProductoNumero);

    const stockActual = aNumero(data.stock_actual);
    const stockNuevo =
      tipo === "entrada" ? stockActual + cantidadNumero : stockActual - cantidadNumero;

    if (stockNuevo > 2147483647) {
      const error = new Error("La cantidad supera el límite permitido");
      error.status = 400;
      throw error;
    }
    if (stockNuevo < 0) {
      const error = new Error("No hay existencias suficientes para esta salida");
      error.status = 409;
      throw error;
    }
    if (tipo === "salida" && stockNuevo < unidadesReservadas) {
      const error = new Error(
        `No se puede reducir el inventario a ${stockNuevo}; hay ${unidadesReservadas} unidad(es) reservadas`
      );
      error.status = 409;
      throw error;
    }

    const movimientoRef = db().collection(COLECCIONES.movimientos).doc();
    const idMovimiento = hashNumerico(movimientoRef.id);
    const fechaMovimiento = new Date();

    tx.update(documento.ref, {
      stock_actual: stockNuevo,
      actualizado_en: fechaMovimiento,
    });

    tx.set(movimientoRef, {
      id_movimiento: idMovimiento,
      id_producto: idProductoNumero,
      id_usuario: idUsuarioNumero,
      tipo_movimiento: tipo,
      cantidad: cantidadNumero,
      motivo: motivo || null,
      fecha_movimiento: fechaMovimiento,
    });

    crearNotificacion(tx, {
      tipo: tipo === "entrada" ? "entrada_inventario" : "salida_inventario",
      titulo: tipo === "entrada" ? "Entrada de inventario" : "Salida de inventario",
      descripcion: `${tipo === "entrada" ? "Entrada" : "Salida"} de ${cantidadNumero} unidades de ${data.nombre} (${data.codigo}).`,
      id_producto: idProductoNumero,
      id_movimiento: idMovimiento,
    });

    aplicarAlertaStock(tx, {
      id_producto: idProductoNumero,
      nombre: data.nombre,
      codigo: data.codigo,
      stock_actual: stockNuevo,
      stock_minimo: aNumero(data.stock_minimo),
    }, alertas);

    return {
      movimiento: {
        id_movimiento: idMovimiento,
        id_producto: idProductoNumero,
        id_usuario: idUsuarioNumero,
        tipo_movimiento: tipo,
        cantidad: cantidadNumero,
        motivo: motivo || null,
        fecha_movimiento: fechaMovimiento.toISOString(),
      },
      stock_actual: stockNuevo,
    };
  });
};

module.exports = { listarInventario, registrarMovimiento };
