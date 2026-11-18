const { getPool, sql } = require("../config/database");

const bloquearNotificaciones = async (transaction) => {
  const result = await new sql.Request(transaction).query(`
    DECLARE @resultado INT;
    EXEC @resultado = sys.sp_getapplock
      @Resource = 'FerreStock360:notificaciones',
      @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
    SELECT @resultado AS resultado;
  `);
  if (result.recordset[0].resultado < 0) {
    const error = new Error("No se pudo sincronizar el estado de notificaciones");
    error.status = 503;
    throw error;
  }
};

const sincronizarAlertaStock = async (transaction, producto) => {
  const tipoActual = producto.stock_actual === 0
    ? "producto_agotado"
    : producto.stock_actual <= producto.stock_minimo ? "stock_bajo" : null;
  const actuales = await new sql.Request(transaction)
    .input("id_producto", sql.Int, producto.id_producto)
    .query(`SELECT id_notificacion, tipo FROM dbo.notificaciones WITH (UPDLOCK, HOLDLOCK)
      WHERE id_producto = @id_producto AND estado_stock = 'activa'`);

  if (actuales.recordset.length === 1 && actuales.recordset[0].tipo === tipoActual) return;
  if (actuales.recordset.length) {
    await new sql.Request(transaction).input("id_producto", sql.Int, producto.id_producto)
      .query("UPDATE dbo.notificaciones SET estado_stock = 'resuelta' WHERE id_producto = @id_producto AND estado_stock = 'activa'");
  }
  if (!tipoActual) return;

  const agotado = tipoActual === "producto_agotado";
  await new sql.Request(transaction)
    .input("tipo", sql.NVarChar(40), tipoActual)
    .input("titulo", sql.NVarChar(150), agotado ? "Producto agotado" : "Stock bajo")
    .input("descripcion", sql.NVarChar(500), agotado
      ? `${producto.nombre} (${producto.codigo}) quedó sin existencias.`
      : `${producto.nombre} (${producto.codigo}) tiene ${producto.stock_actual} unidades; mínimo ${producto.stock_minimo}.`)
    .input("id_producto", sql.Int, producto.id_producto)
    .query(`INSERT INTO dbo.notificaciones (tipo, titulo, descripcion, id_producto, estado_stock)
      VALUES (@tipo, @titulo, @descripcion, @id_producto, 'activa')`);
};

const reconciliarAlertasStock = async (transaction) => {
  await new sql.Request(transaction).query(`
    UPDATE n SET estado_stock = 'resuelta'
    FROM dbo.notificaciones n
    LEFT JOIN dbo.productos p ON p.id_producto = n.id_producto
    WHERE n.estado_stock = 'activa'
      AND (p.id_producto IS NULL OR p.estado = 0
        OR (n.tipo = 'stock_bajo' AND (p.stock_actual = 0 OR p.stock_actual > p.stock_minimo))
        OR (n.tipo = 'producto_agotado' AND p.stock_actual <> 0));

    INSERT INTO dbo.notificaciones (tipo, titulo, descripcion, id_producto, estado_stock)
    SELECT CASE WHEN p.stock_actual = 0 THEN 'producto_agotado' ELSE 'stock_bajo' END,
      CASE WHEN p.stock_actual = 0 THEN N'Producto agotado' ELSE N'Stock bajo' END,
      CASE WHEN p.stock_actual = 0
        THEN CONCAT(p.nombre, N' (', p.codigo, N') está agotado.')
        ELSE CONCAT(p.nombre, N' (', p.codigo, N') tiene ', p.stock_actual, N' unidades; mínimo ', p.stock_minimo, N'.')
      END,
      p.id_producto, 'activa'
    FROM dbo.productos p
    WHERE p.estado = 1 AND p.stock_actual <= p.stock_minimo
      AND NOT EXISTS (
        SELECT 1 FROM dbo.notificaciones n
        WHERE n.id_producto = p.id_producto AND n.estado_stock = 'activa'
          AND n.tipo = CASE WHEN p.stock_actual = 0 THEN 'producto_agotado' ELSE 'stock_bajo' END
      );
  `);
};

const listarNotificaciones = async () => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await bloquearNotificaciones(transaction);
    await reconciliarAlertasStock(transaction);
    const result = await new sql.Request(transaction).query(`
      SELECT TOP (50) n.id_notificacion, n.tipo, n.titulo, n.descripcion,
        n.id_producto, p.nombre AS producto, n.id_movimiento,
        n.leida, n.fecha_creacion, n.estado_stock
      FROM dbo.notificaciones n
      LEFT JOIN dbo.productos p ON p.id_producto = n.id_producto
      ORDER BY n.fecha_creacion DESC, n.id_notificacion DESC;
    `);
    const unread = await new sql.Request(transaction).query("SELECT COUNT_BIG(*) AS total FROM dbo.notificaciones WHERE leida = 0");
    await transaction.commit();
    return { notificaciones: result.recordset, no_leidas: Number(unread.recordset[0].total) };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
};

const marcarNotificacionLeida = async (id) => {
  const pool = await getPool();
  const result = await pool.request().input("id_notificacion", sql.BigInt, id).query(`
    UPDATE dbo.notificaciones SET leida = 1, fecha_lectura = COALESCE(fecha_lectura, SYSDATETIME())
    OUTPUT INSERTED.id_notificacion WHERE id_notificacion = @id_notificacion;
  `);
  return result.recordset[0];
};

const marcarTodasLeidas = async () => {
  const pool = await getPool();
  await pool.request().query(`
    UPDATE dbo.notificaciones SET leida = 1, fecha_lectura = SYSDATETIME() WHERE leida = 0;
  `);
};

module.exports = { bloquearNotificaciones, sincronizarAlertaStock, listarNotificaciones, marcarNotificacionLeida, marcarTodasLeidas };
