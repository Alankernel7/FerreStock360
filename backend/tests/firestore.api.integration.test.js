const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { test } = require("node:test");

const aislado = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST &&
  process.env.TEST_FIREBASE_PROJECT_ID,
);

async function crearCuenta(host, email, password) {
  const response = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "No se pudo crear usuario en Auth Emulator.");
  return data;
}

test("API Firestore: Firebase Auth, catálogo, checkout, pedidos e inventario", {
  skip: aislado ? false : "Define FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST y TEST_FIREBASE_PROJECT_ID para pruebas aisladas",
}, async (t) => {
  process.env.DATA_BACKEND = "firestore";
  process.env.FIREBASE_PROJECT_ID = process.env.TEST_FIREBASE_PROJECT_ID;
  process.env.VERCEL = "1";

  const { db } = require("../src/config/firestore");
  const app = require("../src/app");
  const firestore = db();
  const run = randomUUID().replaceAll("-", "");
  const productId = 100_000_000 + Math.floor(Math.random() * 800_000_000);
  const categoryId = 100_000 + Math.floor(Math.random() * 800_000);
  const adminId = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const adminAuth = await crearCuenta(authHost, `admin-${run}@example.test`, "TestAdmin123");
  await firestore.collection("roles").doc("1").set({ id_rol: 1, nombre: "admin" }, { merge: true });
  await firestore.collection("roles").doc("2").set({ id_rol: 2, nombre: "cliente" }, { merge: true });
  await firestore.collection("users").doc(adminAuth.localId).set({
    uid: adminAuth.localId, id_usuario: adminId, nombre: "Admin de prueba",
    email: `admin-${run}@example.test`, id_rol: 1, rol: "admin", estado: "activo",
    fecha_creacion: new Date(),
  });
  await firestore.collection("categories").doc(String(categoryId)).set({
    id_categoria: categoryId, nombre: `Categoria ${run}`, descripcion: "Prueba de emulador",
  });
  await firestore.collection("products").doc(String(productId)).set({
    id_producto: productId, nombre: `Producto ${run}`, codigo: `TST-${run}`,
    precio: 10, stock_actual: 8, stock_minimo: 1, id_categoria: categoryId,
    categoria_id: categoryId, estado: true, fecha_creacion: new Date(), imagen_1: null, imagen_2: null,
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { token, method = "GET", body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const tokenAdmin = adminAuth.idToken;
  const clientAuth = await crearCuenta(authHost, `cliente-${run}@example.test`, "PruebaSegura123");
  const perfil = await request("/auth/firebase", { method: "POST", token: clientAuth.idToken });
  assert.equal(perfil.status, 200);
  const tokenCliente = clientAuth.idToken;
  const { numero } = require("../src/services/firebaseStore");

  await t.test("los ID tokens protegen el acceso y se rechaza un token inválido", async () => {
    const noAutorizado = await request("/carrito");
    assert.equal(noAutorizado.status, 401);
    const invalido = await request("/carrito", { token: "invalid-token" });
    assert.equal(invalido.status, 401);
  });

  await t.test("el mismo API consulta catálogo y categorías", async () => {
    const productos = await request("/productos?estado=activo");
    assert.equal(productos.status, 200);
    assert.ok(productos.body.some((p) => p.id_producto === productId));
    const categorias = await request("/categorias");
    assert.equal(categorias.status, 200);
    assert.ok(categorias.body.some((c) => c.id_categoria === categoryId));
  });

  await t.test("actividad y perfil se sirven mediante la API", async () => {
    const actividad = await request("/actividad", { method: "POST", token: tokenCliente, body: { tipo: "login", descripcion: "Prueba emulador" } });
    assert.equal(actividad.status, 201);
    const perfilActualizado = await request("/auth/perfil", { method: "PATCH", token: tokenCliente, body: { nombre: "Cliente API" } });
    assert.equal(perfilActualizado.status, 200);
  });

  await t.test("carrito, checkout, pedido, movimientos y notificaciones", async () => {
    await firestore.collection("carts").doc(clientAuth.localId).set({ productos: [String(productId)] });
    await firestore.collection("inventory_holds").doc(String(productId)).set({
      holds: { [`u${numero(clientAuth.localId)}`]: { cantidad: 2, expira: Date.now() + 600_000 } },
    });
    const legacyCart = await request("/carrito", { token: tokenCliente });
    assert.equal(legacyCart.body.data[0].cantidad, 2);
    const fechas = await request("/pedidos/fechas-retiro");
    const add = await request("/carrito/items", { token: tokenCliente, method: "POST", body: { id_producto: productId, cantidad: 2 } });
    assert.equal(add.status, 200);
    const checkout = await request("/carrito/checkout", {
      token: tokenCliente, method: "POST",
      body: { metodo: "efectivo", fecha_retiro: fechas.body.data[0], clave_idempotencia: randomUUID() },
    });
    assert.equal(checkout.status, 201);
    const id = checkout.body.data.id_pedido;
    const pending = await request("/mis-pedidos", { token: tokenCliente });
    assert.ok(pending.body.data.some((p) => p.id_pedido === id));
    const detail = await request(`/pedidos/${id}`, { token: tokenCliente });
    assert.equal(detail.body.data.detalles[0].cantidad, 2);
    const paid = await request(`/admin/pedidos/${id}`, { token: tokenAdmin, method: "PATCH", body: { accion: "confirmar_pago" } });
    assert.equal(paid.status, 200);
    const delivered = await request(`/admin/pedidos/${id}`, { token: tokenAdmin, method: "PATCH", body: { accion: "entregar" } });
    assert.equal(delivered.status, 200);
    assert.equal((await firestore.collection("products").doc(String(productId)).get()).data().stock_actual, 6);
    const movement = await request("/inventario/movimientos", { token: tokenAdmin, method: "POST", body: { id_producto: productId, tipo_movimiento: "entrada", cantidad: 1, motivo: "Prueba emulador" } });
    assert.equal(movement.status, 201);
    const notifications = await request("/notificaciones", { token: tokenAdmin });
    assert.equal(notifications.status, 200);
  });
});
