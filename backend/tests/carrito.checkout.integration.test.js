// Requiere una base desechable configurada con TEST_DB_* y
// TEST_DATABASE_CONFIRMATION=ISOLATED_NON_PRODUCTION_DATABASE. Crea compras
// temporales Ãºnicamente ahÃ­ y limpia todos sus registros en finally.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { test } = require("node:test");
const basePruebasHabilitada = require("./testDatabaseConfig");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const jwt = require("jsonwebtoken");
const { getPool, sql } = require("../src/config/database");

const habilitada = basePruebasHabilitada && process.env.RUN_CARRITO_DB_INTEGRATION === "true";
const PORT = 34217;
const BASE = `http://127.0.0.1:${PORT}`;
const sufijo = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const codigo = `TST-COMPRA-${sufijo}`;
const correos = [`carrito-${sufijo}@example.test`, `carrito2-${sufijo}@example.test`];
let servidor;
let salidaServidor = "";
let pool;
let usuarios = [];
let productos = [];
let tokens = [];

const tokenPara = (id, rol = "cliente") => jwt.sign({ id_usuario: id, nombre: "Cliente temporal", email: "test@example.test", rol }, process.env.JWT_SECRET, { expiresIn: "10m" });

async function request(ruta, opciones = {}) {
  const response = await fetch(`${BASE}${ruta}`, opciones);
  const body = await response.json();
  return { status: response.status, body };
}

async function esperarServidor() {
  const limite = Date.now() + 25000;
  while (Date.now() < limite) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* esperando inicio */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`El backend no iniciÃ³. ${salidaServidor.slice(-1500)}`);
}

test("flujo integrado de carrito, checkout y pagos con registros temporales", { skip: !habilitada }, async (t) => {
  assert.ok(process.env.JWT_SECRET, "JWT_SECRET debe estar configurado");
  pool = await getPool();
  const rol = await pool.request().input("nombre", sql.NVarChar(100), "cliente")
    .query("SELECT id_rol FROM dbo.roles WHERE nombre = @nombre");
  assert.ok(rol.recordset[0], "Debe existir el rol cliente");
  const rolAdmin = await pool.request().input("nombre", sql.NVarChar(100), "admin")
    .query("SELECT id_rol FROM dbo.roles WHERE nombre = @nombre");
  assert.ok(rolAdmin.recordset[0], "Debe existir el rol admin");
  const categoria = await pool.request().query("SELECT TOP 1 id_categoria FROM dbo.categorias ORDER BY id_categoria");
  assert.ok(categoria.recordset[0], "Se necesita al menos una categorÃ­a de productos");

  try {
    for (const email of correos) {
      const result = await pool.request()
        .input("nombre", sql.NVarChar(200), "Cliente de prueba")
        .input("email", sql.NVarChar(300), email)
        .input("password", sql.NVarChar(510), "$2b$12$test.integration.only.not.a.real.login.hash")
        .input("id_rol", sql.Int, rol.recordset[0].id_rol)
        .query(`INSERT INTO dbo.usuarios (nombre,email,password,id_rol,estado)
                OUTPUT INSERTED.id_usuario VALUES (@nombre,@email,@password,@id_rol,1)`);
      usuarios.push(result.recordset[0].id_usuario);
    }
    const admin = await pool.request()
      .input("nombre", sql.NVarChar(200), "Administrador de prueba")
      .input("email", sql.NVarChar(300), `admin-${sufijo}@example.test`)
      .input("password", sql.NVarChar(510), "$2b$12$test.integration.only.not.a.real.login.hash")
      .input("id_rol", sql.Int, rolAdmin.recordset[0].id_rol)
      .query(`INSERT INTO dbo.usuarios (nombre,email,password,id_rol,estado)
              OUTPUT INSERTED.id_usuario VALUES (@nombre,@email,@password,@id_rol,1)`);
    usuarios.push(admin.recordset[0].id_usuario);

    for (const [indice, stock, estado] of [[1, 10, true], [2, 3, true], [3, 10, false]]) {
      const result = await pool.request()
        .input("nombre", sql.NVarChar(300), `Producto temporal ${indice}`)
        .input("codigo", sql.NVarChar(100), `${codigo}-${indice}`)
        .input("precio", sql.Decimal(10, 2), 17.25)
        .input("stock", sql.Int, stock)
        .input("categoria", sql.Int, categoria.recordset[0].id_categoria)
        .input("estado", sql.Bit, estado)
        .query(`INSERT INTO dbo.productos (nombre,codigo,precio,stock_actual,stock_minimo,id_categoria,estado)
                OUTPUT INSERTED.id_producto VALUES (@nombre,@codigo,@precio,@stock,0,@categoria,@estado)`);
      productos.push(result.recordset[0].id_producto);
    }

    tokens = [tokenPara(usuarios[0]), tokenPara(usuarios[1]), tokenPara(usuarios[2], "admin")];
    servidor = spawn(process.execPath, ["src/app.js"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout.on("data", (data) => { salidaServidor += data.toString(); });
    servidor.stderr.on("data", (data) => { salidaServidor += data.toString(); });
    await esperarServidor();

    const auth = (token = tokens[0]) => ({ Authorization: `Bearer ${token}` });
    const json = (data, token = tokens[0]) => ({ method: "POST", headers: { ...auth(token), "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const fechaRetiro = async () => (await request("/api/pedidos/fechas-retiro")).body.data[0];

    await t.test("protege carrito y pedidos con JWT", async () => {
      assert.equal((await request("/api/carrito")).status, 401);
      assert.equal((await request("/api/carrito", { headers: auth() })).status, 200);
    });

    await t.test("agrega, actualiza y elimina lÃ­neas; el precio viene de SQL", async () => {
      const inexistente = await request("/api/carrito/items", json({ id_producto: 2147483000, cantidad: 1 }));
      assert.equal(inexistente.status, 404);
      const inactivo = await request("/api/carrito/items", json({ id_producto: productos[2], cantidad: 1 }));
      assert.equal(inactivo.status, 409);
      const invalido = await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 0 }));
      assert.equal(invalido.status, 400);

      let response = await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 2, precio: 0.01 }));
      assert.equal(response.status, 200);
      assert.equal(response.body.data.length, 1);
      assert.equal(response.body.data[0].precio, 17.25);
      response = await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 3 }));
      assert.equal(response.body.data.length, 1);
      assert.equal(response.body.data[0].cantidad, 3);
      let reserva = await pool.request().input("id", sql.Int, productos[0]).query("SELECT cantidad, estado FROM dbo.reservas_inventario WHERE id_producto=@id AND estado=N'activa'");
      assert.equal(reserva.recordset[0].cantidad, 3);
      assert.equal((await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 11 }))).status, 409);
      assert.equal((await request("/api/carrito", { headers: auth() })).body.data[0].cantidad, 3);
      response = await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 2 }));
      assert.equal(response.body.data[0].cantidad, 2);
      reserva = await pool.request().input("id", sql.Int, productos[0]).query("SELECT cantidad FROM dbo.reservas_inventario WHERE id_producto=@id AND estado=N'activa'");
      assert.equal(reserva.recordset[0].cantidad, 2, "disminuir la cantidad debe liberar inmediatamente el excedente");
      response = await request(`/api/carrito/items/${productos[0]}`, { method: "DELETE", headers: auth() });
      assert.equal(response.body.data.length, 0);
      reserva = await pool.request().input("id", sql.Int, productos[0]).query("SELECT TOP 1 estado FROM dbo.reservas_inventario WHERE id_producto=@id ORDER BY id_reserva DESC");
      assert.equal(reserva.recordset[0].estado, "activa");
    });

    await t.test("reserva efectivo, registra el pago administrativo y entrega sin doble descuento", async () => {
      let response = await request("/api/carrito/checkout", json({ metodo: "efectivo", clave_idempotencia: randomUUID(), fecha_retiro: await fechaRetiro() }));
      assert.equal(response.status, 400);
      assert.equal((await request("/api/carrito/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metodo: "efectivo", clave_idempotencia: randomUUID(), fecha_retiro: await fechaRetiro() }) })).status, 401);
      await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 2, precio: 0 }));
      await pool.request().input("id", sql.Int, productos[0]).query("UPDATE dbo.productos SET stock_actual=1 WHERE id_producto=@id");
      response = await request("/api/carrito/checkout", json({ metodo: "efectivo", clave_idempotencia: randomUUID(), fecha_retiro: await fechaRetiro() }));
      assert.equal(response.status, 409);
      assert.equal((await request("/api/carrito", { headers: auth() })).body.data[0].cantidad, 2);
      await pool.request().input("id", sql.Int, productos[0]).query("UPDATE dbo.productos SET stock_actual=10 WHERE id_producto=@id");
      const clave = randomUUID(); const fecha = await fechaRetiro();
      response = await request("/api/carrito/checkout", json({ metodo: "efectivo", clave_idempotencia: clave, fecha_retiro: fecha, total: 0 }));
      assert.equal(response.status, 201); const pedido = response.body.data;
      assert.equal(Number(pedido.total), 34.5); assert.equal(pedido.estado_pago, "pendiente"); assert.equal(pedido.estado_pedido, "reservado");
      assert.ok(pedido.codigo_pedido.startsWith("FS-"));
      const repetido = await request("/api/carrito/checkout", json({ metodo: "efectivo", clave_idempotencia: clave, fecha_retiro: fecha }));
      assert.equal(repetido.status, 201); assert.equal(repetido.body.data.duplicado, true); assert.equal(repetido.body.data.id_pedido, pedido.id_pedido);
      const detalle = await request("/api/pedidos/" + pedido.id_pedido, { headers: auth() });
      assert.equal(detalle.status, 200); assert.equal(detalle.body.data.detalles[0].subtotal, 34.5);
      assert.equal(detalle.body.data.fecha_retiro.slice(0, 10), fecha); assert.ok(detalle.body.data.historial.length >= 1);
      assert.equal((await request("/api/pedidos/" + pedido.id_pedido, { headers: auth(tokens[1]) })).status, 404);
      assert.equal((await request("/api/mis-pedidos", { headers: auth() })).body.data.length, 1);
      const reservado = await pool.request().input("id", sql.Int, pedido.id_pedido).query("SELECT estado,fecha_expiracion FROM dbo.reservas_inventario WHERE id_pedido=@id");
      assert.equal(reservado.recordset[0].estado, "confirmada"); assert.equal(reservado.recordset[0].fecha_expiracion, null);
      let stock = await pool.request().input("id", sql.Int, productos[0]).query("SELECT stock_actual FROM dbo.productos WHERE id_producto=@id");
      assert.equal(stock.recordset[0].stock_actual, 10, "reservar para checkout no descuenta stock f?sico");
      assert.equal((await request("/api/carrito", { headers: auth() })).body.data.length, 0);
      response = await request("/api/admin/pedidos/" + pedido.id_pedido, { ...json({ accion: "confirmar_pago" }, tokens[2]), method: "PATCH" });
      assert.equal(response.status, 200); assert.equal(response.body.data.estado_pago, "aprobado"); assert.equal(response.body.data.estado_pedido, "pendiente_retiro");
      response = await request("/api/admin/pedidos/" + pedido.id_pedido, { ...json({ accion: "entregar" }, tokens[2]), method: "PATCH" });
      assert.equal(response.status, 200); assert.equal(response.body.data.estado_pedido, "entregado");
      stock = await pool.request().input("id", sql.Int, productos[0]).query("SELECT stock_actual FROM dbo.productos WHERE id_producto=@id");
      assert.equal(stock.recordset[0].stock_actual, 8, "el descuento f?sico ocurre al entregar");
      const repetida = await request("/api/admin/pedidos/" + pedido.id_pedido, { ...json({ accion: "entregar" }, tokens[2]), method: "PATCH" });
      assert.equal(repetida.status, 409, "no permite entregar dos veces");
      const movimientos = await pool.request().input("motivo", sql.NVarChar(300), "Entrega pedido " + pedido.codigo_pedido).query("SELECT COUNT(*) AS total FROM dbo.movimientos_inventario WHERE motivo=@motivo");
      assert.equal(movimientos.recordset[0].total, 1);
    });

    await t.test("rechaza m?todo no permitido y cancela reserva con motivo", async () => {
      await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 1 }));
      const noPermitido = await request("/api/carrito/checkout", json({ metodo: "otro", fecha_retiro: await fechaRetiro(), clave_idempotencia: randomUUID() }));
      assert.equal(noPermitido.status, 400);
      const confirmado = await request("/api/carrito/checkout", json({ metodo: "efectivo", fecha_retiro: await fechaRetiro(), clave_idempotencia: randomUUID() }));
      assert.equal(confirmado.status, 201); const pedido = confirmado.body.data;
      const sinMotivo = await request("/api/admin/pedidos/" + pedido.id_pedido, { ...json({ accion: "cancelar" }, tokens[2]), method: "PATCH" });
      assert.equal(sinMotivo.status, 400);
      const cancelado = await request("/api/admin/pedidos/" + pedido.id_pedido, { ...json({ accion: "cancelar", motivo: "Cliente no retirar?" }, tokens[2]), method: "PATCH" });
      assert.equal(cancelado.status, 200); assert.equal(cancelado.body.data.estado_pedido, "cancelado"); assert.equal(cancelado.body.data.estado_pago, "cancelado");
      const row = await pool.request().input("id", sql.Int, pedido.id_pedido).query("SELECT estado FROM dbo.reservas_inventario WHERE id_pedido=@id");
      assert.equal(row.recordset[0].estado, "cancelada");
    });

    await t.test("tarjeta simulada aprobada y rechazada sin almacenar datos sensibles", async () => {
      await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 1 }));
      const aprobada = await request("/api/carrito/checkout", json({ metodo: "tarjeta", fecha_retiro: await fechaRetiro(), clave_idempotencia: randomUUID(), tarjeta: { numero: "4242424242424242", vencimiento: "12/30", cvv: "123" } }));
      assert.equal(aprobada.status, 201);
      assert.equal(aprobada.body.data.estado_pago, "aprobado");
      assert.equal(aprobada.body.data.estado_pedido, "pendiente_retiro");
      const stockPendiente = await pool.request().input("id", sql.Int, productos[0]).query("SELECT stock_actual FROM dbo.productos WHERE id_producto=@id");
      assert.equal(stockPendiente.recordset[0].stock_actual, 8, "el pago aprobado conserva el compromiso sin descontar stock");
      const entrega = await request("/api/admin/pedidos/" + aprobada.body.data.id_pedido, { ...json({ accion: "entregar" }, tokens[2]), method: "PATCH" });
      assert.equal(entrega.status, 200); assert.equal(entrega.body.data.estado_pedido, "entregado");
      await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 1 }));
      const rechazada = await request("/api/carrito/checkout", json({ metodo: "tarjeta", fecha_retiro: await fechaRetiro(), clave_idempotencia: randomUUID(), tarjeta: { numero: "4000000000000051", vencimiento: "12/30", cvv: "987" } }));
      assert.equal(rechazada.status, 201);
      assert.equal(rechazada.body.data.estado_pago, "rechazado");
      assert.equal("numero" in rechazada.body, false);
      const pago = await pool.request().input("id", sql.Int, rechazada.body.data.id_pedido).query("SELECT estado, referencia_demo FROM dbo.pagos WHERE id_pedido=@id");
      assert.equal(pago.recordset[0].estado, "rechazado");
      assert.equal(pago.recordset[0].referencia_demo, "0051");
      const reserva = await pool.request().input("id", sql.Int, productos[0]).query("SELECT TOP 1 estado FROM dbo.reservas_inventario WHERE id_producto=@id ORDER BY id_reserva DESC");
      assert.equal(reserva.recordset[0].estado, "liberada");
      const stock = await pool.request().input("id", sql.Int, productos[0]).query("SELECT stock_actual FROM dbo.productos WHERE id_producto=@id");
      assert.equal(stock.recordset[0].stock_actual, 7);
      assert.equal((await request("/api/carrito", { headers: auth() })).body.data[0].cantidad, 1);
      assert.equal((await request("/api/carrito", { headers: auth(tokens[1]) })).body.data.length, 0);
      await request("/api/carrito", { method: "DELETE", headers: auth() });
      assert.equal((await request("/api/carrito", { headers: auth() })).body.data.length, 0);
    });

    await t.test("una salida administrativa no puede consumir unidades reservadas", async () => {
      await pool.request().input("id", sql.Int, productos[0]).query("UPDATE dbo.productos SET stock_actual=3 WHERE id_producto=@id");
      await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 2 }, tokens[0]));
      const inventario = require("../src/services/inventarioService");
      await assert.rejects(inventario.registrarMovimiento({ idProducto: productos[0], idUsuario: usuarios[0], tipo: "salida", cantidad: 2, motivo: "prueba aislada" }), { status: 409 });
      const stock = await pool.request().input("id", sql.Int, productos[0]).query("SELECT stock_actual FROM dbo.productos WHERE id_producto=@id");
      assert.equal(stock.recordset[0].stock_actual, 3);
      await request("/api/carrito", { method: "DELETE", headers: auth() });
      const reserva = await pool.request().input("id", sql.Int, productos[0]).query("SELECT TOP 1 estado FROM dbo.reservas_inventario WHERE id_producto=@id ORDER BY id_reserva DESC");
      assert.equal(reserva.recordset[0].estado, "liberada");
    });

    await t.test("dos clientes no pueden reservar simultÃ¡neamente la Ãºltima unidad", async () => {
      await pool.request().input("id", sql.Int, productos[1]).query("UPDATE dbo.productos SET stock_actual=1 WHERE id_producto=@id");
      const resultados = await Promise.all([
        request("/api/carrito/items", json({ id_producto: productos[1], cantidad: 1 }, tokens[0])),
        request("/api/carrito/items", json({ id_producto: productos[1], cantidad: 1 }, tokens[1])),
      ]);
      assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 409]);
      const ganador = resultados.findIndex((r) => r.status === 200);
      const perdedor = ganador === 0 ? 1 : 0;
      const stockAntesDeComprar = await pool.request().input("id", sql.Int, productos[1]).query("SELECT stock_actual FROM dbo.productos WHERE id_producto=@id");
      assert.equal(stockAntesDeComprar.recordset[0].stock_actual, 1, "reservar no debe descontar el stock fÃ­sico");
      const pedido = await request("/api/carrito/checkout", json({ metodo: "efectivo", fecha_retiro: await fechaRetiro(), clave_idempotencia: randomUUID() }, tokens[ganador]));
      assert.equal(pedido.status, 201);
      assert.equal((await request("/api/carrito/items", json({ id_producto: productos[1], cantidad: 1 }, tokens[perdedor]))).status, 409);
      const stockFinal = await pool.request().input("id", sql.Int, productos[1]).query("SELECT stock_actual FROM dbo.productos WHERE id_producto=@id");
      assert.equal(stockFinal.recordset[0].stock_actual, 1, "una reserva confirmada a?n no descuenta stock f?sico");
    });

    await t.test("la expiraciÃ³n libera unidades y mantiene visible el aviso en el carrito", async () => {
      await pool.request().input("id", sql.Int, productos[0]).query("UPDATE dbo.productos SET stock_actual=1 WHERE id_producto=@id");
      const reserva = await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 1 }, tokens[0]));
      assert.equal(reserva.status, 200);
      await pool.request().input("id", sql.Int, productos[0]).query(`UPDATE dbo.reservas_inventario SET fecha_expiracion=DATEADD(MINUTE,-1,SYSUTCDATETIME()) WHERE id_producto=@id AND estado=N'activa'`);
      const recuperada = await request("/api/carrito", { headers: auth(tokens[0]) });
      assert.equal(recuperada.status, 200);
      assert.equal(recuperada.body.data[0].estado_reserva, "vencida");
      assert.equal(recuperada.body.data[0].stock_disponible, 1);
      assert.equal((await request("/api/carrito/items", json({ id_producto: productos[0], cantidad: 1 }, tokens[1]))).status, 200);
      assert.equal((await request("/api/carrito/checkout", json({ metodo: "efectivo", fecha_retiro: await fechaRetiro(), clave_idempotencia: randomUUID() }, tokens[0]))).status, 409);
      const reservaPedido = await request("/api/carrito/checkout", json({ metodo: "efectivo", fecha_retiro: await fechaRetiro(), clave_idempotencia: randomUUID() }, tokens[1]));
      assert.equal(reservaPedido.status, 201);
      await pool.request().input("id", sql.Int, reservaPedido.body.data.id_pedido).query("UPDATE dbo.pedidos SET fecha_retiro=DATEADD(day,-2,CONVERT(date,SYSUTCDATETIME())) WHERE id_pedido=@id");
      const pedidos = require("../src/services/pedidosService");
      assert.equal(await pedidos.vencerReservasEfectivo(), 1);
      const vencida = await request("/api/pedidos/" + reservaPedido.body.data.id_pedido, { headers: auth(tokens[1]) });
      assert.equal(vencida.body.data.estado_pedido, "vencido");
      const hold = await pool.request().input("id", sql.Int, reservaPedido.body.data.id_pedido).query("SELECT estado FROM dbo.reservas_inventario WHERE id_pedido=@id");
      assert.equal(hold.recordset[0].estado, "vencida");
    });
  } finally {
    if (servidor && servidor.exitCode === null) {
      await new Promise((resolve) => {
        servidor.once("exit", resolve);
        servidor.kill();
      });
    }
    if (pool) {
      if (usuarios.length) {
        const ids = usuarios.join(",");
        await pool.request().query(`DELETE h FROM dbo.historial_pedidos h INNER JOIN dbo.pedidos p ON p.id_pedido=h.id_pedido WHERE p.id_usuario IN (${ids});
          DELETE ri FROM dbo.reservas_inventario ri INNER JOIN dbo.pedidos p ON p.id_pedido=ri.id_pedido WHERE p.id_usuario IN (${ids});
          DELETE d FROM dbo.pedido_detalles d INNER JOIN dbo.pedidos p ON p.id_pedido=d.id_pedido WHERE p.id_usuario IN (${ids});
          DELETE pg FROM dbo.pagos pg INNER JOIN dbo.pedidos p ON p.id_pedido=pg.id_pedido WHERE p.id_usuario IN (${ids});
          DELETE FROM dbo.pedidos WHERE id_usuario IN (${ids});
          DELETE cd FROM dbo.carrito_detalles cd INNER JOIN dbo.carritos c ON c.id_carrito=cd.id_carrito WHERE c.id_usuario IN (${ids});
          DELETE FROM dbo.carritos WHERE id_usuario IN (${ids});`);
      }
      if (productos.length) await pool.request().query(`DELETE n FROM dbo.notificaciones n INNER JOIN dbo.movimientos_inventario m ON m.id_movimiento=n.id_movimiento WHERE m.id_producto IN (${productos.join(",")});
        DELETE FROM dbo.movimientos_inventario WHERE id_producto IN (${productos.join(",")});
        DELETE FROM dbo.productos WHERE id_producto IN (${productos.join(",")});`);
      if (usuarios.length) await pool.request().query(`DELETE FROM dbo.usuarios WHERE id_usuario IN (${usuarios.join(",")});`);
      await pool.close();
      pool = null;
    }
  }
});
