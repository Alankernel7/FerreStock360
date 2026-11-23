const { getPool, sql } = require("../config/database");
const { validarTarjetaDemo, validarCantidadCarrito, validarItemsCheckout } = require("./checkoutRules");
const { DURACION_RESERVA_MINUTOS } = require("../config/reservas");
const { limpiarReservasVencidas } = require("./reservasService");
const { validarDisponibilidadReserva } = require("./reservasRules");
const { validarFechaRetiro } = require("../config/retiros");
const { randomBytes } = require("node:crypto");

const consultarCarrito = async (executor, idUsuario) => {
  const request = executor instanceof sql.Transaction ? new sql.Request(executor) : executor.request();
  const result = await request.input("id_usuario", sql.Int, idUsuario).query(`
    SELECT c.id_carrito, d.id_producto, d.cantidad, p.nombre, p.codigo, p.precio,
           p.stock_actual, p.estado, p.imagen_1, p.imagen_2,
           COALESCE(r.total_reservado, 0) AS unidades_reservadas,
           COALESCE(propias.cantidad_reservada, 0) AS cantidad_reservada,
           CASE WHEN COALESCE(r.total_reservado, 0) >= p.stock_actual THEN 0
                ELSE p.stock_actual - COALESCE(r.total_reservado, 0) END AS stock_disponible,
           CASE WHEN p.stock_actual - COALESCE(r.total_reservado, 0) + COALESCE(propias.cantidad_reservada, 0) < 0 THEN 0
                ELSE p.stock_actual - COALESCE(r.total_reservado, 0) + COALESCE(propias.cantidad_reservada, 0) END AS maximo_carrito,
           ultima.estado AS estado_reserva, ultima.fecha_expiracion,
           CASE WHEN ultima.estado = N'activa' AND ultima.fecha_expiracion > SYSUTCDATETIME()
                THEN DATEDIFF(SECOND, SYSUTCDATETIME(), ultima.fecha_expiracion) ELSE 0 END AS segundos_restantes
    FROM dbo.carritos c
    LEFT JOIN dbo.carrito_detalles d ON d.id_carrito = c.id_carrito
    LEFT JOIN dbo.productos p ON p.id_producto = d.id_producto
    OUTER APPLY (
      SELECT TOP (1) ri.estado, ri.fecha_expiracion, ri.cantidad
      FROM dbo.reservas_inventario ri
      WHERE ri.id_carrito = c.id_carrito AND ri.id_producto = d.id_producto
      ORDER BY ri.id_reserva DESC
    ) ultima
    OUTER APPLY (
      SELECT SUM(ri.cantidad) AS total_reservado
      FROM dbo.reservas_inventario ri
      WHERE ri.id_producto = d.id_producto AND (
        (ri.estado = N'activa' AND ri.fecha_expiracion > SYSUTCDATETIME()) OR ri.estado = N'confirmada'
      )
    ) r
    OUTER APPLY (
      SELECT SUM(ri.cantidad) AS cantidad_reservada
      FROM dbo.reservas_inventario ri
      WHERE ri.id_producto = d.id_producto AND ri.id_carrito = c.id_carrito
        AND ri.estado = N'activa' AND ri.fecha_expiracion > SYSUTCDATETIME()
    ) propias
    WHERE c.id_usuario = @id_usuario
    ORDER BY d.id_producto
  `);
  return (result.recordset || []).filter((fila) => fila.id_producto != null).map((fila) => ({
    id_producto: fila.id_producto,
    cantidad: fila.cantidad,
    nombre: fila.nombre,
    codigo: fila.codigo,
    precio: Number(fila.precio),
    stock_actual: fila.stock_actual,
    stock_fisico: fila.stock_actual,
    unidades_reservadas: Number(fila.unidades_reservadas),
    stock_disponible: Number(fila.stock_disponible),
    maximo_carrito: Number(fila.maximo_carrito),
    estado: fila.estado,
    imagen: fila.imagen_1 || fila.imagen_2 || null,
    estado_reserva: fila.estado_reserva || "sin_reserva",
    fecha_expiracion: fila.fecha_expiracion,
    segundos_restantes: Number(fila.segundos_restantes || 0),
    duracion_reserva_minutos: DURACION_RESERVA_MINUTOS,
  }));
};

const obtenerCarrito = async (idUsuario) => {
  const pool = await getPool();
  await limpiarReservasVencidas(pool);
  return consultarCarrito(pool, idUsuario);
};

const agregarAlCarrito = async (idUsuario, idProducto, cantidad) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await limpiarReservasVencidas(tx);
    let carrito = await new sql.Request(tx)
      .input("id_usuario", sql.Int, idUsuario)
      .query("SELECT id_carrito FROM dbo.carritos WITH (UPDLOCK, HOLDLOCK) WHERE id_usuario = @id_usuario");
    if (!carrito.recordset.length) {
      carrito = await new sql.Request(tx).input("id_usuario", sql.Int, idUsuario)
        .query("INSERT INTO dbo.carritos (id_usuario) OUTPUT INSERTED.id_carrito VALUES (@id_usuario)");
    }
    const idCarrito = carrito.recordset[0].id_carrito;
    const producto = await new sql.Request(tx)
      .input("id_producto", sql.Int, idProducto)
      .query("SELECT id_producto, stock_actual, estado FROM dbo.productos WITH (UPDLOCK, HOLDLOCK) WHERE id_producto = @id_producto");
    const actual = producto.recordset[0];
    validarCantidadCarrito({ producto: actual, cantidad });

    const reservas = await new sql.Request(tx)
      .input("id_producto", sql.Int, idProducto)
      .input("id_carrito", sql.Int, idCarrito)
      .query(`SELECT COALESCE(SUM(CASE WHEN estado = N'confirmada' OR fecha_expiracion > SYSUTCDATETIME() THEN cantidad ELSE 0 END), 0) AS total_reservado,
                     COALESCE(SUM(CASE WHEN id_carrito = @id_carrito AND estado = N'activa' AND fecha_expiracion > SYSUTCDATETIME() THEN cantidad ELSE 0 END), 0) AS propia
              FROM dbo.reservas_inventario WITH (UPDLOCK, HOLDLOCK)
              WHERE id_producto = @id_producto AND (
                (estado = N'activa' AND fecha_expiracion > SYSUTCDATETIME()) OR estado = N'confirmada'
              )`);
    const { total_reservado: totalReservado, propia } = reservas.recordset[0];
    validarDisponibilidadReserva({ stockFisico: actual.stock_actual, reservasTotales: totalReservado, reservaPropia: propia, cantidad });

    await new sql.Request(tx)
      .input("id_carrito", sql.Int, idCarrito)
      .input("id_producto", sql.Int, idProducto)
      .input("cantidad", sql.Int, cantidad)
      .query(`IF EXISTS (SELECT 1 FROM dbo.carrito_detalles WHERE id_carrito = @id_carrito AND id_producto = @id_producto)
                UPDATE dbo.carrito_detalles SET cantidad = @cantidad, fecha_actualizacion = SYSUTCDATETIME() WHERE id_carrito = @id_carrito AND id_producto = @id_producto;
              ELSE INSERT INTO dbo.carrito_detalles (id_carrito, id_producto, cantidad) VALUES (@id_carrito, @id_producto, @cantidad);`);
    const reservaActiva = await new sql.Request(tx)
      .input("id_carrito", sql.Int, idCarrito)
      .input("id_producto", sql.Int, idProducto)
      .query("SELECT id_reserva FROM dbo.reservas_inventario WITH (UPDLOCK, HOLDLOCK) WHERE id_carrito = @id_carrito AND id_producto = @id_producto AND estado = N'activa'");
    const reservaRequest = new sql.Request(tx)
      .input("id_carrito", sql.Int, idCarrito)
      .input("id_producto", sql.Int, idProducto)
      .input("cantidad", sql.Int, cantidad)
      .input("duracion", sql.Int, DURACION_RESERVA_MINUTOS);
    if (reservaActiva.recordset.length) {
      reservaRequest.input("id_reserva", sql.BigInt, reservaActiva.recordset[0].id_reserva);
      await reservaRequest.query(`UPDATE dbo.reservas_inventario
        SET cantidad = @cantidad, fecha_creacion = SYSUTCDATETIME(),
            fecha_expiracion = DATEADD(MINUTE, @duracion, SYSUTCDATETIME())
        WHERE id_reserva = @id_reserva`);
    } else {
      await reservaRequest.query(`INSERT INTO dbo.reservas_inventario (id_carrito, id_producto, cantidad, fecha_expiracion)
        VALUES (@id_carrito, @id_producto, @cantidad, DATEADD(MINUTE, @duracion, SYSUTCDATETIME()))`);
    }
    // Lee el estado del carrito antes del commit: si la lectura falla, toda la
    // operación se revierte en vez de devolver un falso error después de guardar.
    const carritoActualizado = await consultarCarrito(tx, idUsuario);
    await tx.commit();
    return carritoActualizado;
  } catch (error) {
    if (tx._aborted !== true) await tx.rollback().catch(() => {});
    throw error;
  }
};

const quitarDelCarrito = async (idUsuario, idProducto) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await limpiarReservasVencidas(tx);
    await new sql.Request(tx).input("id_usuario", sql.Int, idUsuario)
      .query("SELECT id_carrito FROM dbo.carritos WITH (UPDLOCK, HOLDLOCK) WHERE id_usuario = @id_usuario");
    await new sql.Request(tx).input("id_usuario", sql.Int, idUsuario).input("id_producto", sql.Int, idProducto)
      .query(`UPDATE ri SET estado = N'liberada'
              FROM dbo.reservas_inventario ri
              INNER JOIN dbo.carritos c ON c.id_carrito = ri.id_carrito
              WHERE c.id_usuario = @id_usuario AND ri.id_producto = @id_producto AND ri.estado = N'activa';
              DELETE d FROM dbo.carrito_detalles d INNER JOIN dbo.carritos c ON c.id_carrito = d.id_carrito
              WHERE c.id_usuario = @id_usuario AND d.id_producto = @id_producto`);
    const carritoActualizado = await consultarCarrito(tx, idUsuario);
    await tx.commit();
    return carritoActualizado;
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }
};

const vaciarCarrito = async (idUsuario) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await limpiarReservasVencidas(tx);
    await new sql.Request(tx).input("id_usuario", sql.Int, idUsuario)
      .query("SELECT id_carrito FROM dbo.carritos WITH (UPDLOCK, HOLDLOCK) WHERE id_usuario = @id_usuario");
    await new sql.Request(tx).input("id_usuario", sql.Int, idUsuario).query(`
      UPDATE ri SET estado = N'liberada'
      FROM dbo.reservas_inventario ri INNER JOIN dbo.carritos c ON c.id_carrito = ri.id_carrito
      WHERE c.id_usuario = @id_usuario AND ri.estado = N'activa';
      DELETE d FROM dbo.carrito_detalles d INNER JOIN dbo.carritos c ON c.id_carrito = d.id_carrito
      WHERE c.id_usuario = @id_usuario
    `);
    await tx.commit();
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }
  return [];
};

const checkout = async ({ idUsuario, metodo, tarjeta, claveIdempotencia, fechaRetiro }) => {
  const metodos = ["efectivo", "tarjeta"];
  if (!metodos.includes(metodo)) throw Object.assign(new Error("Selecciona un método de pago válido"), { status: 400 });
  validarFechaRetiro(fechaRetiro);
  if (!/^[0-9a-f-]{36}$/i.test(claveIdempotencia || "")) throw Object.assign(new Error("La solicitud de compra no es válida"), { status: 400 });
  const resultadoTarjeta = metodo === "tarjeta" ? validarTarjetaDemo(tarjeta) : null;
  if (resultadoTarjeta && !resultadoTarjeta.valida) throw Object.assign(new Error(resultadoTarjeta.error), { status: 400 });

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await limpiarReservasVencidas(tx);
    const previa = await new sql.Request(tx)
      .input("id_usuario", sql.Int, idUsuario)
      .input("clave", sql.UniqueIdentifier, claveIdempotencia)
      .query(`SELECT p.id_pedido, p.codigo_pedido, p.fecha_retiro, p.subtotal, p.total, p.metodo_pago, p.estado_pedido, pg.estado AS estado_pago
              FROM dbo.pedidos p INNER JOIN dbo.pagos pg ON pg.id_pedido = p.id_pedido
              WHERE p.id_usuario = @id_usuario AND p.clave_idempotencia = @clave`);
    if (previa.recordset.length) {
      await tx.commit();
      return { ...previa.recordset[0], duplicado: true };
    }

    const cabecera = await new sql.Request(tx)
      .input("id_usuario", sql.Int, idUsuario)
      .query("SELECT id_carrito FROM dbo.carritos WITH (UPDLOCK, HOLDLOCK) WHERE id_usuario = @id_usuario");
    const carrito = cabecera.recordset[0];
    if (!carrito) throw Object.assign(new Error("El carrito está vacío"), { status: 400 });
    const itemsResult = await new sql.Request(tx).input("id_carrito", sql.Int, carrito.id_carrito).query(`
      SELECT d.id_producto, d.cantidad, p.nombre, p.codigo, p.precio, p.stock_actual,
             p.estado, p.imagen_1, p.imagen_2
      FROM dbo.carrito_detalles d WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN dbo.productos p WITH (UPDLOCK, HOLDLOCK) ON p.id_producto = d.id_producto
      WHERE d.id_carrito = @id_carrito ORDER BY d.id_producto
    `);
    const items = itemsResult.recordset;
    const subtotal = Math.round(validarItemsCheckout(items) * 100) / 100;
    const reservas = await new sql.Request(tx).input("id_carrito", sql.Int, carrito.id_carrito).query(`
      SELECT id_reserva, id_producto, cantidad FROM dbo.reservas_inventario WITH (UPDLOCK, HOLDLOCK)
      WHERE id_carrito = @id_carrito AND estado = N'activa' AND fecha_expiracion > SYSUTCDATETIME()
      ORDER BY id_producto
    `);
    if (reservas.recordset.length !== items.length) {
      throw Object.assign(new Error("Actualiza las reservas de tu carrito antes de confirmar el pedido."), { status: 409 });
    }
    const reservasPorProducto = new Map(reservas.recordset.map((reserva) => [reserva.id_producto, reserva]));
    for (const item of items) {
      const reserva = reservasPorProducto.get(item.id_producto);
      if (!reserva || reserva.cantidad !== item.cantidad) {
        throw Object.assign(new Error(`La reserva de ${item.nombre} venció o cambió. Renúevala desde el carrito.`), { status: 409 });
      }
      item.id_reserva = reserva.id_reserva;
    }
    const tarjetaAprobada = !resultadoTarjeta || resultadoTarjeta.aprobado;
    const confirmarCompra = metodo !== "tarjeta" || tarjetaAprobada;
    const estadoPago = metodo === "tarjeta" ? (tarjetaAprobada ? "aprobado" : "rechazado") : "pendiente";
    const estadoPedido = !tarjetaAprobada && metodo === "tarjeta" ? "rechazado" : metodo === "efectivo" ? "reservado" : "pendiente_retiro";
    const insertado = await new sql.Request(tx)
      .input("id_usuario", sql.Int, idUsuario)
      .input("clave", sql.UniqueIdentifier, claveIdempotencia)
      .input("subtotal", sql.Decimal(10, 2), subtotal)
      .input("fecha_retiro", sql.Date, fechaRetiro)
      .input("metodo", sql.NVarChar(30), metodo)
      .input("estado_pedido", sql.NVarChar(40), estadoPedido)
      .input("estado_pago", sql.NVarChar(40), estadoPago)
      .input("referencia", sql.NVarChar(4), resultadoTarjeta ? resultadoTarjeta.ultimos4 : null)
      .query(`DECLARE @pedido TABLE (id_pedido INT);
              INSERT INTO dbo.pedidos (id_usuario, clave_idempotencia, subtotal, total, metodo_pago, estado_pedido, fecha_retiro)
              OUTPUT INSERTED.id_pedido INTO @pedido
              VALUES (@id_usuario, @clave, @subtotal, @subtotal, @metodo, @estado_pedido, @fecha_retiro);
              DECLARE @id_pedido INT = (SELECT id_pedido FROM @pedido);
              INSERT INTO dbo.pagos (id_pedido, metodo, estado, referencia_demo)
              VALUES (@id_pedido, @metodo, @estado_pago, @referencia);
              SELECT @id_pedido AS id_pedido;`);
    const idPedido = insertado.recordset[0].id_pedido;
    const codigoPedido = `FS-${fechaRetiro.replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
    await new sql.Request(tx).input("id_pedido", sql.Int, idPedido)
      .input("codigo", sql.NVarChar(32), codigoPedido)
      .query("UPDATE dbo.pedidos SET codigo_pedido = @codigo WHERE id_pedido = @id_pedido");
    await new sql.Request(tx).input("id_pedido", sql.Int, idPedido)
      .input("id_usuario", sql.Int, idUsuario)
      .input("estado_pedido", sql.NVarChar(40), estadoPedido)
      .input("estado_pago", sql.NVarChar(40), estadoPago)
      .query(`INSERT INTO dbo.historial_pedidos
        (id_pedido,id_usuario,estado_anterior,estado_nuevo,estado_pago_anterior,estado_pago_nuevo,motivo)
        VALUES (@id_pedido,@id_usuario,NULL,@estado_pedido,NULL,@estado_pago,N'Pedido creado desde checkout')`);
    for (const item of items) {
      await new sql.Request(tx)
        .input("id_pedido", sql.Int, idPedido)
        .input("id_producto", sql.Int, item.id_producto)
        .input("nombre", sql.NVarChar(300), item.nombre)
        .input("codigo", sql.NVarChar(100), item.codigo)
        .input("precio", sql.Decimal(10, 2), item.precio)
        .input("cantidad", sql.Int, item.cantidad)
        .input("imagen", sql.VarChar(sql.MAX), item.imagen_1 || item.imagen_2 || null)
        .input("id_reserva", sql.BigInt, item.id_reserva)
        .query(`INSERT INTO dbo.pedido_detalles (id_pedido, id_producto, nombre_producto, codigo_producto, precio_unitario, cantidad, subtotal, imagen_url)
                VALUES (@id_pedido, @id_producto, @nombre, @codigo, @precio, @cantidad, @precio * @cantidad, @imagen);
                ${confirmarCompra ? "UPDATE dbo.reservas_inventario SET estado = N'confirmada', id_pedido = @id_pedido, fecha_expiracion = NULL WHERE id_reserva = @id_reserva AND estado = N'activa'; IF @@ROWCOUNT = 0 THROW 51002, 'La reserva ya no está activa', 1;" : ""}`);
    }
    if (confirmarCompra) {
      await new sql.Request(tx).input("id_carrito", sql.Int, carrito.id_carrito)
        .query("DELETE FROM dbo.carrito_detalles WHERE id_carrito = @id_carrito");
    }
    await tx.commit();
    const { recordset } = await pool.request().input("id_pedido", sql.Int, idPedido).query("SELECT id_pedido, codigo_pedido, fecha_retiro, subtotal, total, metodo_pago, estado_pedido FROM dbo.pedidos WHERE id_pedido = @id_pedido");
    return { ...recordset[0], estado_pago: estadoPago, aprobado: tarjetaAprobada, mensaje: metodo === "efectivo" ? "Reserva confirmada. El pago queda pendiente hasta el retiro." : tarjetaAprobada ? "Pago de demostración aprobado." : "Pago de demostración rechazado.", duplicado: false };
  } catch (error) {
    await tx.rollback().catch(() => {});
    if (error.number === 2601 || error.number === 2627) {
      const previa = await pool.request().input("id_usuario", sql.Int, idUsuario).input("clave", sql.UniqueIdentifier, claveIdempotencia)
        .query(`SELECT p.id_pedido, p.codigo_pedido, p.fecha_retiro, p.subtotal, p.total, p.metodo_pago, p.estado_pedido, pg.estado AS estado_pago
                FROM dbo.pedidos p INNER JOIN dbo.pagos pg ON pg.id_pedido = p.id_pedido
                WHERE p.id_usuario = @id_usuario AND p.clave_idempotencia = @clave`);
      if (previa.recordset[0]) return { ...previa.recordset[0], duplicado: true };
    }
    throw error;
  }
};

module.exports = { obtenerCarrito, agregarAlCarrito, quitarDelCarrito, vaciarCarrito, checkout };
