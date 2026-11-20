const { getPool, sql } = require("../config/database");
const { bloquearNotificaciones, sincronizarAlertaStock } = require("./notificacionesService");
const { fechasRetiroDisponibles, fechaLocalISO } = require("../config/retiros");

const crearSolicitud = (tx) => new sql.Request(tx);

const obtenerFechasRetiro = () => fechasRetiroDisponibles();
const estadoVisible = (pedido, pago) => {
  if (["cancelado", "vencido", "rechazado"].includes(pedido) || ["cancelado", "rechazado"].includes(pago)) return "cancelado";
  if (["pendiente_retiro", "entregado"].includes(pedido) || pago === "aprobado") return "pagado";
  return "pendiente";
};
const ESTADO_SQL = `CASE
  WHEN p.estado_pedido IN (N'cancelado',N'vencido',N'rechazado') OR pg.estado IN (N'cancelado',N'rechazado') THEN N'cancelado'
  WHEN p.estado_pedido IN (N'pendiente_retiro',N'entregado') OR pg.estado=N'aprobado' THEN N'pagado'
  ELSE N'pendiente' END`;

const listarMisPedidos = async (idUsuario, estado = "todos") => {
  if (!["todos", "pendiente", "pagado", "cancelado"].includes(estado)) throw Object.assign(new Error("Filtro de pedidos no válido."), { status: 400 });
  const pool = await getPool();
  const request = pool.request().input("id_usuario", sql.Int, idUsuario);
  let filtro = "";
  if (estado !== "todos") { request.input("estado", sql.NVarChar(12), estado); filtro = `AND ${ESTADO_SQL}=@estado`; }
  const result = await request.query(`SELECT p.id_pedido,p.codigo_pedido,p.fecha_pedido,p.fecha_retiro,p.total,
      p.metodo_pago,${ESTADO_SQL} AS estado_pedido,${ESTADO_SQL} AS estado_pago,
      d.id_producto,d.nombre_producto,d.cantidad,d.subtotal AS subtotal_detalle
    FROM dbo.pedidos p INNER JOIN dbo.pagos pg ON pg.id_pedido=p.id_pedido
    LEFT JOIN dbo.pedido_detalles d ON d.id_pedido=p.id_pedido
    WHERE p.id_usuario=@id_usuario ${filtro}
    ORDER BY p.fecha_pedido DESC,p.id_pedido DESC,d.id_detalle`);
  const pedidos = new Map();
  for (const row of result.recordset) {
    if (!pedidos.has(row.id_pedido)) pedidos.set(row.id_pedido, { ...row, total: Number(row.total), detalles: [] });
    if (row.id_producto !== null) pedidos.get(row.id_pedido).detalles.push({ id_producto: row.id_producto, nombre: row.nombre_producto, cantidad: row.cantidad, subtotal: Number(row.subtotal_detalle) });
  }
  return [...pedidos.values()].map(({ id_producto, nombre_producto, cantidad, subtotal_detalle, ...pedido }) => pedido);
};
const mapearDetalle = (rows) => {
  const first = rows[0];
  if (!first) return null;
  return {
    id_pedido: first.id_pedido,
    codigo_pedido: first.codigo_pedido,
    fecha_pedido: first.fecha_pedido,
    fecha_retiro: first.fecha_retiro,
    fecha_entrega: first.fecha_entrega,
    fecha_cancelacion: first.fecha_cancelacion,
    motivo_cancelacion: first.motivo_cancelacion,
    nombre_cliente: first.nombre_cliente,
    email_cliente: first.email_cliente,
    subtotal: Number(first.subtotal),
    total: Number(first.total),
    metodo_pago: first.metodo_pago,
    estado_pedido: estadoVisible(first.estado_pedido, first.estado_pago),
    estado_pago: estadoVisible(first.estado_pedido, first.estado_pago),
    referencia_demo: first.referencia_demo,
    detalles: rows.filter((row) => row.id_producto !== null).map((row) => ({
      id_producto: row.id_producto,
      nombre: row.nombre_producto,
      codigo: row.codigo_producto,
      precio: Number(row.precio_unitario),
      cantidad: row.cantidad,
      subtotal: Number(row.subtotal_detalle),
      imagen: row.imagen_url,
    })),
    historial: first.historial || [],
  };
};

const obtenerPedido = async ({ idPedido, idUsuario = null }) => {
  const pool = await getPool();
  const request = pool.request().input("id_pedido", sql.Int, idPedido);
  const restriccion = idUsuario === null ? "" : (request.input("id_usuario", sql.Int, idUsuario), "AND p.id_usuario=@id_usuario");
  const result = await request.query(`SELECT p.id_pedido,p.codigo_pedido,p.fecha_pedido,p.fecha_retiro,p.fecha_entrega,
      p.fecha_cancelacion,p.motivo_cancelacion,p.subtotal,p.total,p.metodo_pago,p.estado_pedido,
      pg.estado AS estado_pago,pg.referencia_demo,u.nombre AS nombre_cliente,u.email AS email_cliente,
      d.id_producto,d.nombre_producto,d.codigo_producto,d.precio_unitario,d.cantidad,
      d.subtotal AS subtotal_detalle,d.imagen_url
    FROM dbo.pedidos p INNER JOIN dbo.pagos pg ON pg.id_pedido=p.id_pedido
    INNER JOIN dbo.usuarios u ON u.id_usuario=p.id_usuario
    LEFT JOIN dbo.pedido_detalles d ON d.id_pedido=p.id_pedido
    WHERE p.id_pedido=@id_pedido ${restriccion} ORDER BY d.id_detalle`);
  if (!result.recordset.length) return null;
  const history = await pool.request().input("id_pedido", sql.Int, idPedido).query(`
    SELECT h.id_historial,h.estado_anterior,h.estado_nuevo,h.estado_pago_anterior,h.estado_pago_nuevo,
      h.motivo,h.fecha_cambio,COALESCE(u.nombre,N'Sistema') AS usuario
    FROM dbo.historial_pedidos h LEFT JOIN dbo.usuarios u ON u.id_usuario=h.id_usuario
    WHERE h.id_pedido=@id_pedido ORDER BY h.fecha_cambio,h.id_historial`);
  const pedido = mapearDetalle(result.recordset);
  pedido.historial = history.recordset.map((item) => ({ ...item,
    estado_anterior: item.estado_anterior ? estadoVisible(item.estado_anterior, item.estado_pago_anterior) : null,
    estado_nuevo: estadoVisible(item.estado_nuevo, item.estado_pago_nuevo),
    estado_pago_anterior: item.estado_pago_anterior ? estadoVisible(item.estado_anterior, item.estado_pago_anterior) : null,
    estado_pago_nuevo: estadoVisible(item.estado_nuevo, item.estado_pago_nuevo),
  }));
  return pedido;
};

const listarPedidosAdmin = async (filtros = {}) => {
  const pool = await getPool();
  const request = pool.request();
  const where = ["1=1"];
  const allowed = ["todos", "pendiente", "pagado", "cancelado"];
  if (filtros.estado && filtros.estado !== "todos") {
    if (!allowed.includes(filtros.estado)) throw Object.assign(new Error("El filtro de estado no es válido."), { status: 400 });
    request.input("estado", sql.NVarChar(12), filtros.estado); where.push(`${ESTADO_SQL}=@estado`);
  }
  if (filtros.metodo && filtros.metodo !== "todos") {
    if (!["efectivo", "tarjeta"].includes(filtros.metodo)) throw Object.assign(new Error("El filtro de método no es válido."), { status: 400 });
    request.input("metodo", sql.NVarChar(30), filtros.metodo); where.push("p.metodo_pago=@metodo");
  }
  if (filtros.desde) { request.input("desde", sql.Date, filtros.desde); where.push("p.fecha_pedido>=@desde"); }
  if (filtros.hasta) { request.input("hasta", sql.Date, filtros.hasta); where.push("p.fecha_pedido<DATEADD(day,1,@hasta)"); }
  if (filtros.q) { request.input("q", sql.NVarChar(300), `%${filtros.q}%`); where.push("(p.codigo_pedido LIKE @q OR u.nombre LIKE @q OR u.email LIKE @q)"); }
  const result = await request.query(`SELECT p.id_pedido,p.codigo_pedido,p.fecha_pedido,p.fecha_retiro,
      p.total,p.metodo_pago,${ESTADO_SQL} AS estado_pedido,${ESTADO_SQL} AS estado_pago,u.nombre AS nombre_cliente,u.email AS email_cliente
    FROM dbo.pedidos p INNER JOIN dbo.pagos pg ON pg.id_pedido=p.id_pedido
    INNER JOIN dbo.usuarios u ON u.id_usuario=p.id_usuario WHERE ${where.join(" AND ")}
    ORDER BY p.fecha_pedido DESC,p.id_pedido DESC`);
  const stats = await pool.request().query(`SELECT COUNT_BIG(*) AS total_pedidos,
      SUM(CASE WHEN ${ESTADO_SQL}=N'pendiente' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN ${ESTADO_SQL}=N'pagado' THEN 1 ELSE 0 END) AS pagados,
      SUM(CASE WHEN ${ESTADO_SQL}=N'cancelado' THEN 1 ELSE 0 END) AS cancelados
    FROM dbo.pedidos p INNER JOIN dbo.pagos pg ON pg.id_pedido=p.id_pedido`);
  return {
    pedidos: result.recordset.map((row) => ({ ...row, total: Number(row.total) })),
    indicadores: Object.fromEntries(Object.entries(stats.recordset[0]).map(([key, value]) => [key, Number(value || 0)])),
  };
};

const registrarCambio = async (tx, { pedido, pago, idUsuario, estadoPedido, estadoPago, motivo }) => {
  await crearSolicitud(tx).input("id_pedido", sql.Int, pedido.id_pedido)
    .input("id_usuario", sql.Int, idUsuario)
    .input("estado_anterior", sql.NVarChar(40), pedido.estado_pedido)
    .input("estado_nuevo", sql.NVarChar(40), estadoPedido)
    .input("pago_anterior", sql.NVarChar(40), pago.estado)
    .input("pago_nuevo", sql.NVarChar(40), estadoPago)
    .input("motivo", sql.NVarChar(500), motivo || null)
    .query(`INSERT INTO dbo.historial_pedidos
      (id_pedido,id_usuario,estado_anterior,estado_nuevo,estado_pago_anterior,estado_pago_nuevo,motivo)
      VALUES (@id_pedido,@id_usuario,@estado_anterior,@estado_nuevo,@pago_anterior,@pago_nuevo,@motivo)`);
};

const notificarCambioPedido = async (tx, { pedido, estado, motivo }) => {
  const tipo = `pedido_${estado}`;
  const titulo = estado === "cancelado" ? "Pedido cancelado" : estado === "pagado" ? "Pago confirmado" : "Estado del pedido actualizado";
  const descripcion = estado === "cancelado"
    ? `Tu pedido ${pedido.codigo_pedido} fue cancelado. Motivo: ${motivo}`
    : estado === "pagado" ? `El pago de tu pedido ${pedido.codigo_pedido} fue confirmado.`
      : `Tu pedido ${pedido.codigo_pedido} ahora está pendiente.`;
  await crearSolicitud(tx).input("tipo", sql.NVarChar(40), tipo)
    .input("titulo", sql.NVarChar(150), titulo)
    .input("descripcion", sql.NVarChar(500), descripcion)
    .input("id_usuario", sql.Int, pedido.id_usuario)
    .input("id_pedido", sql.Int, pedido.id_pedido)
    .query(`INSERT INTO dbo.notificaciones (tipo,titulo,descripcion,id_usuario,id_pedido)
      VALUES (@tipo,@titulo,@descripcion,@id_usuario,@id_pedido)`);
};

const cambiarEstadoPedido = async ({ idPedido, idUsuario, accion, motivo }) => {
  if (!new Set(["marcar_pendiente", "confirmar_pago", "entregar", "cancelar"]).has(accion)) {
    throw Object.assign(new Error("La acción solicitada no es válida."), { status: 400 });
  }
  if (accion === "cancelar" && (!motivo || !motivo.trim() || motivo.trim().length > 440)) {
    throw Object.assign(new Error("Indica un motivo de cancelación de hasta 440 caracteres."), { status: 400 });
  }
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const found = await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido).query(`
      SELECT p.id_pedido,p.id_usuario,p.codigo_pedido,p.metodo_pago,p.estado_pedido,p.fecha_retiro,
        pg.estado AS estado_pago FROM dbo.pedidos p WITH (UPDLOCK,HOLDLOCK)
      INNER JOIN dbo.pagos pg WITH (UPDLOCK,HOLDLOCK) ON pg.id_pedido=p.id_pedido WHERE p.id_pedido=@id_pedido`);
    const pedido = found.recordset[0];
    if (!pedido) throw Object.assign(new Error("No se encontró el pedido."), { status: 404 });
    const pago = { estado: pedido.estado_pago };
    let nextOrder = pedido.estado_pedido;
    let nextPayment = pedido.estado_pago;
    if (accion === "marcar_pendiente") {
      if (pedido.estado_pedido === "reservado" && pedido.estado_pago === "pendiente") {
        await tx.commit();
        return obtenerPedido({ idPedido });
      }
      if (pedido.metodo_pago !== "efectivo" || pedido.estado_pedido !== "pendiente_retiro" || pedido.estado_pago !== "aprobado") {
        throw Object.assign(new Error("Solo se puede volver a pendiente un pago en efectivo aún no retirado."), { status: 409 });
      }
      nextOrder = "reservado"; nextPayment = "pendiente";
      await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido)
        .query("UPDATE dbo.pagos SET estado=N'pendiente',fecha_operacion=SYSUTCDATETIME() WHERE id_pedido=@id_pedido; UPDATE dbo.pedidos SET estado_pedido=N'reservado' WHERE id_pedido=@id_pedido");
    } else if (accion === "confirmar_pago") {
      if (pedido.metodo_pago !== "efectivo" || pedido.estado_pedido !== "reservado" || pedido.estado_pago !== "pendiente") {
        throw Object.assign(new Error("Este pedido no tiene un pago en efectivo pendiente de confirmar."), { status: 409 });
      }
      const fechaRetiro = new Date(pedido.fecha_retiro).toISOString().slice(0, 10);
      if (fechaRetiro < fechaLocalISO()) throw Object.assign(new Error("La fecha límite de pago y retiro ya venció."), { status: 409 });
      const holds = await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido).query(`
        SELECT
          (SELECT COUNT(*) FROM dbo.pedido_detalles WHERE id_pedido=@id_pedido) AS lineas_pedido,
          (SELECT COUNT(*) FROM dbo.reservas_inventario WITH (UPDLOCK,HOLDLOCK)
            WHERE id_pedido=@id_pedido AND estado=N'confirmada') AS lineas_reserva,
          (SELECT COUNT(*) FROM dbo.pedido_detalles d
            LEFT JOIN dbo.reservas_inventario r WITH (UPDLOCK,HOLDLOCK)
              ON r.id_pedido=d.id_pedido AND r.id_producto=d.id_producto AND r.estado=N'confirmada'
            WHERE d.id_pedido=@id_pedido AND (r.id_reserva IS NULL OR r.cantidad<>d.cantidad)) AS lineas_inconsistentes`);
      const cantidades = holds.recordset[0];
      if (!cantidades.lineas_pedido || cantidades.lineas_reserva !== cantidades.lineas_pedido || cantidades.lineas_inconsistentes > 0) {
        throw Object.assign(new Error("La reserva de inventario no está completa para confirmar el pago."), { status: 409 });
      }
      nextOrder = "pendiente_retiro"; nextPayment = "aprobado";
      await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido)
        .query("UPDATE dbo.pagos SET estado=N'aprobado',fecha_operacion=SYSUTCDATETIME() WHERE id_pedido=@id_pedido");
    } else if (accion === "entregar") {
      if (pedido.estado_pedido !== "pendiente_retiro" || pedido.estado_pago !== "aprobado") {
        throw Object.assign(new Error("Solo se puede entregar un pedido pagado que esté pendiente de retiro."), { status: 409 });
      }
      await bloquearNotificaciones(tx);
      const details = await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido).query(`
        SELECT d.id_producto,d.cantidad,p.codigo,p.nombre,p.stock_actual,p.stock_minimo
        FROM dbo.pedido_detalles d INNER JOIN dbo.productos p WITH (UPDLOCK,HOLDLOCK) ON p.id_producto=d.id_producto
        WHERE d.id_pedido=@id_pedido ORDER BY d.id_producto`);
      const holds = await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido).query(`
        SELECT id_producto,cantidad FROM dbo.reservas_inventario WITH (UPDLOCK,HOLDLOCK)
        WHERE id_pedido=@id_pedido AND estado=N'confirmada' ORDER BY id_producto`);
      const holdMap = new Map(holds.recordset.map((row) => [row.id_producto, row.cantidad]));
      if (!details.recordset.length || holds.recordset.length !== details.recordset.length || details.recordset.some((row) => holdMap.get(row.id_producto) !== row.cantidad)) {
        throw Object.assign(new Error("El compromiso de inventario no coincide con los productos del pedido."), { status: 409 });
      }
      for (const item of details.recordset) {
        const changed = await crearSolicitud(tx).input("id_producto", sql.Int, item.id_producto)
          .input("cantidad", sql.Int, item.cantidad)
          .query("UPDATE dbo.productos SET stock_actual=stock_actual-@cantidad WHERE id_producto=@id_producto AND stock_actual>=@cantidad");
        if (!changed.rowsAffected[0]) throw Object.assign(new Error(`No hay existencias físicas suficientes para entregar ${item.nombre}.`), { status: 409 });
        const movimiento = await crearSolicitud(tx).input("id_producto", sql.Int, item.id_producto)
          .input("id_usuario", sql.Int, idUsuario).input("cantidad", sql.Int, item.cantidad)
          .input("motivo", sql.NVarChar(300), `Entrega pedido ${pedido.codigo_pedido}`)
          .query(`INSERT INTO dbo.movimientos_inventario (id_producto,id_usuario,tipo_movimiento,cantidad,motivo)
            OUTPUT INSERTED.id_movimiento VALUES (@id_producto,@id_usuario,N'salida',@cantidad,@motivo)`);
        const stockActual = item.stock_actual - item.cantidad;
        await sincronizarAlertaStock(tx, { ...item, stock_actual: stockActual });
        await crearSolicitud(tx).input("id_movimiento", sql.Int, movimiento.recordset[0].id_movimiento)
          .input("id_producto", sql.Int, item.id_producto)
          .input("descripcion", sql.NVarChar(500), `Salida de ${item.cantidad} unidad(es) por entrega del pedido ${pedido.codigo_pedido}.`)
          .query(`INSERT INTO dbo.notificaciones (tipo,titulo,descripcion,id_producto,id_movimiento)
            VALUES (N'salida_inventario',N'Pedido entregado',@descripcion,@id_producto,@id_movimiento)`);
      }
      await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido)
        .query("UPDATE dbo.reservas_inventario SET estado=N'consumida' WHERE id_pedido=@id_pedido AND estado=N'confirmada'");
      nextOrder = "entregado";
      await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido)
        .query("UPDATE dbo.pedidos SET estado_pedido=N'entregado',fecha_entrega=SYSUTCDATETIME() WHERE id_pedido=@id_pedido");
    } else {
      if (["entregado", "cancelado", "vencido", "rechazado"].includes(pedido.estado_pedido)) {
        throw Object.assign(new Error("El estado actual del pedido no permite cancelarlo."), { status: 409 });
      }
      nextOrder = "cancelado"; nextPayment = "cancelado";
      await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido)
        .input("motivo", sql.NVarChar(500), motivo.trim())
        .query(`UPDATE dbo.pedidos SET estado_pedido=N'cancelado',fecha_cancelacion=SYSUTCDATETIME(),motivo_cancelacion=@motivo WHERE id_pedido=@id_pedido;
          UPDATE dbo.reservas_inventario SET estado=N'cancelada' WHERE id_pedido=@id_pedido AND estado=N'confirmada';
          UPDATE dbo.pagos SET estado=N'cancelado',fecha_operacion=SYSUTCDATETIME() WHERE id_pedido=@id_pedido AND estado IN (N'aprobado',N'pendiente')`);
    }
    if (accion === "confirmar_pago") await crearSolicitud(tx).input("id_pedido", sql.Int, idPedido)
      .query("UPDATE dbo.pedidos SET estado_pedido=N'pendiente_retiro' WHERE id_pedido=@id_pedido");
    if (accion !== "entregar") await registrarCambio(tx, { pedido, pago, idUsuario, estadoPedido: nextOrder, estadoPago: nextPayment, motivo: accion === "cancelar" ? motivo.trim() : accion === "confirmar_pago" ? "Pago en efectivo recibido en el establecimiento" : "Pago en efectivo pendiente de confirmación" });
    else await registrarCambio(tx, { pedido, pago, idUsuario, estadoPedido: nextOrder, estadoPago: nextPayment, motivo: "Entrega registrada" });
    if (accion !== "entregar") await notificarCambioPedido(tx, { pedido, estado: estadoVisible(nextOrder, nextPayment), motivo: accion === "cancelar" ? motivo.trim() : null });
    await tx.commit();
    return obtenerPedido({ idPedido });
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
};

const vencerReservasEfectivo = async () => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const expired = await crearSolicitud(tx).input("hoy", sql.Date, fechaLocalISO()).query(`
      SELECT p.id_pedido,p.estado_pedido,pg.estado AS estado_pago FROM dbo.pedidos p WITH (UPDLOCK,HOLDLOCK)
      INNER JOIN dbo.pagos pg WITH (UPDLOCK,HOLDLOCK) ON pg.id_pedido=p.id_pedido
      WHERE p.metodo_pago=N'efectivo' AND p.estado_pedido IN (N'reservado',N'pendiente_retiro')
        AND pg.estado IN (N'pendiente',N'aprobado')
        AND p.fecha_retiro<@hoy ORDER BY p.id_pedido`);
    for (const pedido of expired.recordset) {
      const pagoNuevo = pedido.estado_pago === "pendiente" ? "cancelado" : pedido.estado_pago;
      await crearSolicitud(tx).input("id_pedido", sql.Int, pedido.id_pedido).query(`
        UPDATE dbo.pedidos SET estado_pedido=N'vencido' WHERE id_pedido=@id_pedido;
        UPDATE dbo.reservas_inventario SET estado=N'vencida' WHERE id_pedido=@id_pedido AND estado=N'confirmada';
        UPDATE dbo.pagos SET estado=N'cancelado',fecha_operacion=SYSUTCDATETIME() WHERE id_pedido=@id_pedido AND estado=N'pendiente'`);
      await crearSolicitud(tx).input("id_pedido", sql.Int, pedido.id_pedido)
        .input("anterior", sql.NVarChar(40), pedido.estado_pedido)
        .input("pago_anterior", sql.NVarChar(40), pedido.estado_pago)
        .input("pago_nuevo", sql.NVarChar(40), pagoNuevo)
        .query(`INSERT INTO dbo.historial_pedidos
          (id_pedido,id_usuario,estado_anterior,estado_nuevo,estado_pago_anterior,estado_pago_nuevo,motivo)
          VALUES (@id_pedido,NULL,@anterior,N'vencido',@pago_anterior,@pago_nuevo,N'Vencimiento automático de reserva en efectivo')`);
    }
    await tx.commit();
    return expired.recordset.length;
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }
};

module.exports = { obtenerFechasRetiro, listarMisPedidos, obtenerPedido, listarPedidosAdmin, cambiarEstadoPedido, vencerReservasEfectivo };
