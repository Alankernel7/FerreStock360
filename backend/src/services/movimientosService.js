const { getPool, sql } = require("../config/database");

const listarMovimientos = async ({ busqueda, tipo, desde, hasta, direccion }) => {
  const pool = await getPool();
  const request = pool.request();
  const filtros = ["1 = 1"];

  if (busqueda) {
    request.input("busqueda", sql.NVarChar(150), `%${busqueda}%`);
    filtros.push(`(
      p.nombre LIKE @busqueda OR p.codigo LIKE @busqueda OR
      u.nombre LIKE @busqueda OR mi.motivo LIKE @busqueda
    )`);
  }
  if (tipo !== "todos") {
    request.input("tipo_movimiento", sql.NVarChar(20), tipo);
    filtros.push("mi.tipo_movimiento = @tipo_movimiento");
  }
  if (desde) {
    request.input("desde", sql.Date, desde);
    filtros.push("mi.fecha_movimiento >= @desde");
  }
  if (hasta) {
    request.input("hasta", sql.Date, hasta);
    filtros.push("mi.fecha_movimiento < DATEADD(day, 1, @hasta)");
  }

  const sentido = direccion === "asc" ? "ASC" : "DESC";
  const result = await request.query(`
    SELECT mi.id_movimiento, mi.id_producto, p.nombre AS producto,
      p.codigo AS codigo_producto, mi.tipo_movimiento, mi.cantidad,
      mi.motivo, mi.fecha_movimiento, mi.id_usuario, u.nombre AS usuario
    FROM movimientos_inventario mi
    INNER JOIN productos p ON p.id_producto = mi.id_producto
    INNER JOIN usuarios u ON u.id_usuario = mi.id_usuario
    WHERE ${filtros.join(" AND ")}
    ORDER BY mi.fecha_movimiento ${sentido}, mi.id_movimiento ${sentido}
  `);

  return result.recordset;
};

module.exports = { listarMovimientos };
