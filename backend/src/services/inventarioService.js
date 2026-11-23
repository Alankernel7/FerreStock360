const { getPool, sql } = require("../config/database");
const { bloquearNotificaciones, sincronizarAlertaStock } = require("./notificacionesService");
const { limpiarReservasVencidas } = require("./reservasService");

const listarInventario = async ({ busqueda, categoria, stock, orden, direccion }) => {
  const pool = await getPool();
  await limpiarReservasVencidas(pool);
  const request = pool.request();
  const filtros = ["1 = 1"];

  if (busqueda) {
    request.input("busqueda", sql.NVarChar(150), `%${busqueda}%`);
    filtros.push("(p.nombre LIKE @busqueda OR p.codigo LIKE @busqueda)");
  }
  if (categoria) {
    request.input("id_categoria", sql.Int, categoria);
    filtros.push("p.id_categoria = @id_categoria");
  }
  if (stock === "bajo") filtros.push("p.stock_actual - COALESCE(r.unidades_reservadas, 0) > 0 AND p.stock_actual - COALESCE(r.unidades_reservadas, 0) <= p.stock_minimo");
  if (stock === "agotado") filtros.push("p.stock_actual - COALESCE(r.unidades_reservadas, 0) <= 0");

  const columnasOrden = { nombre: "p.nombre", cantidad: "stock_disponible" };
  const por = columnasOrden[orden] || "p.nombre";
  const sentido = direccion === "desc" ? "DESC" : "ASC";
  const result = await request.query(`
    SELECT p.id_producto, p.codigo, p.nombre, p.imagen_1, p.imagen_2,
      p.stock_actual, p.stock_actual AS stock_fisico,
      COALESCE(r.unidades_reservadas, 0) AS unidades_reservadas,
      CASE WHEN p.stock_actual - COALESCE(r.unidades_reservadas, 0) < 0 THEN 0
           ELSE p.stock_actual - COALESCE(r.unidades_reservadas, 0) END AS stock_disponible,
      p.stock_minimo, p.id_categoria, p.estado,
      c.nombre AS categoria,
      CASE WHEN p.stock_actual - COALESCE(r.unidades_reservadas, 0) <= 0 THEN 'agotado'
           WHEN p.stock_actual - COALESCE(r.unidades_reservadas, 0) <= p.stock_minimo THEN 'bajo'
           ELSE 'normal' END AS estado_inventario
    FROM productos p
    INNER JOIN categorias c ON c.id_categoria = p.id_categoria
    OUTER APPLY (
      SELECT SUM(ri.cantidad) AS unidades_reservadas
      FROM dbo.reservas_inventario ri
      WHERE ri.id_producto = p.id_producto AND (
        (ri.estado = N'activa' AND ri.fecha_expiracion > SYSUTCDATETIME()) OR ri.estado = N'confirmada'
      )
    ) r
    WHERE p.estado = 1 AND ${filtros.join(" AND ")}
    ORDER BY ${por} ${sentido}, p.id_producto ASC
  `);

  const estadisticas = await pool.request().query(`
    SELECT COALESCE(SUM(p.stock_actual), 0) AS unidades_fisicas,
      COALESCE(SUM(COALESCE(r.unidades_reservadas, 0)), 0) AS unidades_reservadas,
      COALESCE(SUM(CASE WHEN p.stock_actual > COALESCE(r.unidades_reservadas, 0)
                        THEN p.stock_actual - COALESCE(r.unidades_reservadas, 0) ELSE 0 END), 0) AS unidades_disponibles,
      COUNT(*) AS total_productos,
      COALESCE(SUM(CASE WHEN p.stock_actual > COALESCE(r.unidades_reservadas, 0) THEN 1 ELSE 0 END), 0) AS con_stock,
      COALESCE(SUM(CASE WHEN p.stock_actual > COALESCE(r.unidades_reservadas, 0)
                        AND p.stock_actual - COALESCE(r.unidades_reservadas, 0) <= p.stock_minimo THEN 1 ELSE 0 END), 0) AS stock_bajo,
      COALESCE(SUM(CASE WHEN p.stock_actual <= COALESCE(r.unidades_reservadas, 0) THEN 1 ELSE 0 END), 0) AS agotados
    FROM productos p
    OUTER APPLY (
      SELECT SUM(ri.cantidad) AS unidades_reservadas
      FROM dbo.reservas_inventario ri
      WHERE ri.id_producto = p.id_producto AND (
        (ri.estado = N'activa' AND ri.fecha_expiracion > SYSUTCDATETIME()) OR ri.estado = N'confirmada'
      )
    ) r WHERE p.estado = 1
  `);
  return { productos: result.recordset, estadisticas: estadisticas.recordset[0] };
};

const registrarMovimiento = async ({ idProducto, idUsuario, tipo, cantidad, motivo }) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await limpiarReservasVencidas(transaction);
    await bloquearNotificaciones(transaction);
    const request = new sql.Request(transaction).input("id_producto", sql.Int, idProducto);
    const productoResult = await request.query(`
      SELECT id_producto, codigo, nombre, stock_actual, stock_minimo FROM productos WITH (UPDLOCK, HOLDLOCK)
      WHERE id_producto = @id_producto AND estado = 1
    `);
    const producto = productoResult.recordset[0];
    if (!producto) {
      const error = new Error("El producto no existe o está inactivo");
      error.status = 404;
      throw error;
    }

    const reservas = await new sql.Request(transaction).input("id_producto", sql.Int, idProducto).query(`
      SELECT COALESCE(SUM(cantidad), 0) AS total
      FROM dbo.reservas_inventario WITH (UPDLOCK, HOLDLOCK)
      WHERE id_producto = @id_producto AND (
        (estado = N'activa' AND fecha_expiracion > SYSUTCDATETIME()) OR estado = N'confirmada'
      )
    `);
    const unidadesReservadas = reservas.recordset[0].total;

    const stockNuevo = tipo === "entrada"
      ? producto.stock_actual + cantidad
      : producto.stock_actual - cantidad;
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
      const error = new Error(`No se puede reducir el inventario a ${stockNuevo}; hay ${unidadesReservadas} unidad(es) reservadas`);
      error.status = 409;
      throw error;
    }

    await new sql.Request(transaction)
      .input("id_producto", sql.Int, idProducto)
      .input("stock_actual", sql.Int, stockNuevo)
      .query("UPDATE productos SET stock_actual = @stock_actual WHERE id_producto = @id_producto");

    const movimientoResult = await new sql.Request(transaction)
      .input("id_producto", sql.Int, idProducto)
      .input("id_usuario", sql.Int, idUsuario)
      .input("tipo_movimiento", sql.NVarChar(20), tipo)
      .input("cantidad", sql.Int, cantidad)
      .input("motivo", sql.NVarChar(300), motivo || null)
      .query(`
        INSERT INTO movimientos_inventario (id_producto, id_usuario, tipo_movimiento, cantidad, motivo)
        OUTPUT INSERTED.id_movimiento, INSERTED.id_producto, INSERTED.id_usuario,
          INSERTED.tipo_movimiento, INSERTED.cantidad, INSERTED.motivo, INSERTED.fecha_movimiento
        VALUES (@id_producto, @id_usuario, @tipo_movimiento, @cantidad, @motivo)
      `);

    const movimiento = movimientoResult.recordset[0];
    await sincronizarAlertaStock(transaction, { ...producto, stock_actual: stockNuevo });
    await new sql.Request(transaction)
      .input("tipo", sql.NVarChar(40), tipo === "entrada" ? "entrada_inventario" : "salida_inventario")
      .input("titulo", sql.NVarChar(150), tipo === "entrada" ? "Entrada de inventario" : "Salida de inventario")
      .input("descripcion", sql.NVarChar(500), `${tipo === "entrada" ? "Entrada" : "Salida"} de ${cantidad} unidades de ${producto.nombre} (${producto.codigo}).`)
      .input("id_producto", sql.Int, idProducto)
      .input("id_movimiento", sql.Int, movimiento.id_movimiento)
      .query(`INSERT INTO dbo.notificaciones (tipo, titulo, descripcion, id_producto, id_movimiento)
        VALUES (@tipo, @titulo, @descripcion, @id_producto, @id_movimiento)`);

    await transaction.commit();
    return { movimiento, stock_actual: stockNuevo };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { listarInventario, registrarMovimiento };
