// Servicio del dashboard.
// Obtiene estadísticas generales y datos relevantes del inventario.

const { getPool } = require("../config/database");

const obtenerDashboard = async () => {
  const pool = await getPool();

  // Resumen general
  const resumenResult = await pool.request().query(`
    SELECT
      (SELECT COUNT(*)
       FROM productos
       WHERE estado = 1) AS total_productos,

      (SELECT COUNT(*)
       FROM categorias) AS total_categorias,

      (SELECT COUNT(*)
       FROM productos
       WHERE estado = 1
         AND stock_actual <= stock_minimo) AS productos_stock_bajo,

      (SELECT COUNT(*)
       FROM movimientos_inventario) AS total_movimientos
  `);

  // Productos con stock bajo
  const stockBajoResult = await pool.request().query(`
    SELECT TOP 5
      id_producto,
      nombre,
      stock_actual,
      stock_minimo
    FROM productos
    WHERE estado = 1
      AND stock_actual <= stock_minimo
    ORDER BY stock_actual ASC
  `);

  // Movimientos más recientes
  const movimientosResult = await pool.request().query(`
    SELECT TOP 5
      mi.id_movimiento,
      p.nombre AS producto,
      mi.tipo_movimiento,
      mi.cantidad,
      mi.motivo,
      mi.fecha_movimiento,
      u.nombre AS usuario
    FROM movimientos_inventario mi
    INNER JOIN productos p
      ON mi.id_producto = p.id_producto
    INNER JOIN usuarios u
      ON mi.id_usuario = u.id_usuario
    ORDER BY mi.fecha_movimiento DESC
  `);

  return {
    resumen: resumenResult.recordset[0],
    stock_bajo: stockBajoResult.recordset,
    movimientos_recientes: movimientosResult.recordset,
  };
};

module.exports = { obtenerDashboard };