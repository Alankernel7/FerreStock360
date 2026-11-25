const {
  COLECCIONES,
  db,
  aISO,
  aFecha,
  aNumero,
  aBooleano,
  idNumericoDocumento,
} = require("../config/firestore");

const obtenerDashboard = async () => {
  const [productos, categorias, movimientos, usuarios] = await Promise.all([
    db().collection(COLECCIONES.productos).get(),
    db().collection(COLECCIONES.categorias).get(),
    db().collection(COLECCIONES.movimientos).get(),
    db().collection(COLECCIONES.usuarios).get(),
  ]);

  const productosPorId = new Map();
  const usuariosPorId = new Map();

  for (const documento of productos.docs) {
    productosPorId.set(idNumericoDocumento(documento, "id_producto"), documento.data());
  }
  for (const documento of usuarios.docs) {
    usuariosPorId.set(idNumericoDocumento(documento, "id_usuario"), documento.data());
  }

  const activos = productos.docs
    .filter((documento) => aBooleano(documento.data().estado, true))
    .map((documento) => ({
      id_producto: idNumericoDocumento(documento, "id_producto"),
      ...documento.data(),
    }));

  const stockBajo = activos
    .filter((producto) => aNumero(producto.stock_actual) <= aNumero(producto.stock_minimo))
    .sort((a, b) => aNumero(a.stock_actual) - aNumero(b.stock_actual))
    .slice(0, 5)
    .map((producto) => ({
      id_producto: producto.id_producto,
      codigo: producto.codigo || "",
      nombre: producto.nombre || "",
      stock_actual: aNumero(producto.stock_actual),
      stock_minimo: aNumero(producto.stock_minimo),
      estado_inventario: aNumero(producto.stock_actual) === 0 ? "agotado" : "bajo",
    }));

  const recientes = movimientos.docs
    .map((documento) => {
      const data = documento.data();
      const producto = productosPorId.get(aNumero(data.id_producto));
      const usuario = usuariosPorId.get(aNumero(data.id_usuario));
      return {
        id_movimiento:
          aNumero(data.id_movimiento) ||
          idNumericoDocumento(documento, "id_movimiento"),
        producto: producto?.nombre ?? null,
        tipo_movimiento: data.tipo_movimiento,
        cantidad: aNumero(data.cantidad),
        motivo: data.motivo ?? null,
        fecha_movimiento: aISO(data.fecha_movimiento),
        fecha: aFecha(data.fecha_movimiento),
        usuario: usuario?.nombre ?? null,
      };
    })
    .sort((a, b) => {
      const fechaA = a.fecha ? a.fecha.getTime() : 0;
      const fechaB = b.fecha ? b.fecha.getTime() : 0;
      return fechaB - fechaA;
    })
    .slice(0, 5)
    .map(({ fecha, ...resto }) => resto);

  return {
    resumen: {
      total_productos: activos.length,
      total_categorias: categorias.size,
      productos_stock_bajo: activos.filter(
        (producto) => aNumero(producto.stock_actual) <= aNumero(producto.stock_minimo)
      ).length,
      total_movimientos: movimientos.size,
    },
    stock_bajo: stockBajo,
    movimientos_recientes: recientes,
  };
};

module.exports = { obtenerDashboard };
