const {
  COLECCIONES,
  db,
  aISO,
  aFecha,
  aNumero,
  idNumericoDocumento,
} = require("../config/firestore");

const inicioDia = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) {
    const fecha = new Date(valor);
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }
  const fecha = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const listarMovimientos = async ({ busqueda, tipo, desde, hasta, direccion }) => {
  const [movimientos, productos, usuarios] = await Promise.all([
    db().collection(COLECCIONES.movimientos).get(),
    db().collection(COLECCIONES.productos).get(),
    db().collection(COLECCIONES.usuarios).get(),
  ]);

  const productosPorId = new Map();
  for (const documento of productos.docs) {
    productosPorId.set(idNumericoDocumento(documento, "id_producto"), documento.data());
  }

  const usuariosPorId = new Map();
  for (const documento of usuarios.docs) {
    usuariosPorId.set(idNumericoDocumento(documento, "id_usuario"), documento.data());
  }

  const termino = busqueda ? String(busqueda).toLowerCase() : null;
  const desdeFecha = inicioDia(desde);
  const hastaFecha = inicioDia(hasta);
  if (hastaFecha) hastaFecha.setDate(hastaFecha.getDate() + 1);

  const filas = [];

  for (const documento of movimientos.docs) {
    const data = documento.data();
    const idProducto = aNumero(data.id_producto);
    const idUsuario = aNumero(data.id_usuario);
    const producto = productosPorId.get(idProducto) || null;
    const usuario = usuariosPorId.get(idUsuario) || null;
    const fecha = aFecha(data.fecha_movimiento);

    if (tipo && tipo !== "todos" && data.tipo_movimiento !== tipo) continue;
    if (desdeFecha && (!fecha || fecha < desdeFecha)) continue;
    if (hastaFecha && (!fecha || fecha >= hastaFecha)) continue;

    if (termino) {
      const texto = [
        producto?.nombre,
        producto?.codigo,
        usuario?.nombre,
        data.motivo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!texto.includes(termino)) continue;
    }

    filas.push({
      id_movimiento:
        aNumero(data.id_movimiento) ||
        idNumericoDocumento(documento, "id_movimiento"),
      id_producto: idProducto,
      producto: producto?.nombre ?? null,
      codigo_producto: producto?.codigo ?? null,
      tipo_movimiento: data.tipo_movimiento,
      cantidad: aNumero(data.cantidad),
      motivo: data.motivo ?? null,
      fecha_movimiento: aISO(data.fecha_movimiento),
      id_usuario: idUsuario,
      usuario: usuario?.nombre ?? null,
    });
  }

  const sentido = direccion === "asc" ? 1 : -1;
  filas.sort((a, b) => {
    const fechaA = a.fecha_movimiento ? Date.parse(a.fecha_movimiento) : 0;
    const fechaB = b.fecha_movimiento ? Date.parse(b.fecha_movimiento) : 0;
    return (fechaA - fechaB) * sentido || (a.id_movimiento - b.id_movimiento) * sentido;
  });

  return filas;
};

module.exports = { listarMovimientos };
