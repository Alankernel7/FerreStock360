const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { test } = require("node:test");

const ruta = (archivo) => require.resolve(archivo);
const firebaseStorePath = ruta("../src/services/firebaseStore");
const productosServicePath = ruta("../src/services/productosService");
const imageStoragePath = ruta("../src/storage/imageStorage");
const uploadPath = ruta("../src/middleware/subirImagenesProducto");

const filas = [
  {
    id_producto: 1, nombre: "Activo", descripcion: "Visible", codigo: "A-1", precio: 10,
    imagen_1: "/a.jpg", imagen_2: null, imagen_url: "/a.jpg", id_categoria: 2,
    estado: true, fecha_creacion: "2026-01-01", stock_actual: 8,
    stock_disponible: 6, stock_minimo: 2,
  },
  {
    id_producto: 2, nombre: "Inactivo", descripcion: "Oculto", codigo: "I-1", precio: 20,
    imagen_1: "/i.jpg", imagen_2: null, imagen_url: "/i.jpg", id_categoria: 3,
    estado: false, fecha_creacion: "2026-01-02", stock_actual: 99,
    stock_disponible: 90, stock_minimo: 10,
  },
];

require.cache[firebaseStorePath] = {
  id: firebaseStorePath,
  filename: firebaseStorePath,
  loaded: true,
  exports: {
    principal: async (req) => {
      const token = req.get("Authorization")?.replace(/^Bearer /, "");
      if (token === "admin") return { uid: "admin-uid", rol: "admin" };
      if (token === "client") return { uid: "client-uid", rol: "cliente" };
      throw Object.assign(new Error("No autorizado"), { status: 401 });
    },
  },
};
require.cache[productosServicePath] = {
  id: productosServicePath,
  filename: productosServicePath,
  loaded: true,
  exports: {
    obtenerProductos: async ({ soloActivos } = {}) =>
      soloActivos ? filas.filter((producto) => producto.estado) : filas,
    obtenerProductoPorId: async (id) => filas.find((producto) => producto.id_producto === Number(id)),
  },
};
require.cache[imageStoragePath] = {
  id: imageStoragePath,
  filename: imageStoragePath,
  loaded: true,
  exports: { guardarImagen: async () => null, eliminarImagen: async () => {} },
};
require.cache[uploadPath] = {
  id: uploadPath,
  filename: uploadPath,
  loaded: true,
  exports: { CAMPOS_ARCHIVO: {}, subirImagenesProducto: (_req, _res, next) => next() },
};

const app = express();
app.use("/api", require("../src/routes/productos"));
const server = http.createServer(app);

test("GET /productos aplica catálogo público y permisos administrativos", async (t) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api/productos`;
  const request = (path = "", token) => fetch(base + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  for (const path of ["", "?estado=activo"]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    const products = await response.json();
    assert.deepEqual(products.map((product) => product.id_producto), [1]);
    assert.equal(products[0].disponible, true);
    for (const field of ["stock_actual", "stock_disponible", "stock_minimo"]) {
      assert.equal(Object.hasOwn(products[0], field), false);
    }
  }

  const clientResponse = await request("", "client");
  assert.equal(clientResponse.status, 200);
  const clientProducts = await clientResponse.json();
  assert.deepEqual(clientProducts.map((product) => product.id_producto), [1]);
  assert.equal(Object.hasOwn(clientProducts[0], "stock_actual"), false);

  for (const path of ["?estado=inactivo", "?estado=todos", "?incluirInactivos=true", "?admin=true"]) {
    assert.equal((await request(path)).status, 403);
    assert.equal((await request(path, "client")).status, 403);
  }

  const adminResponse = await request("", "admin");
  assert.equal(adminResponse.status, 200);
  const adminProducts = await adminResponse.json();
  assert.deepEqual(adminProducts.map((product) => product.id_producto), [1, 2]);
  assert.equal(adminProducts[1].stock_actual, 99);

  const adminActive = await request("?estado=activo", "admin");
  assert.deepEqual((await adminActive.json()).map((product) => product.id_producto), [1]);
  const adminInactive = await request("?estado=inactivo", "admin");
  assert.deepEqual((await adminInactive.json()).map((product) => product.id_producto), [2]);
});

test("GET /productos/:id no revela productos inactivos ni inventario al público", async (t) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const cleanup = () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  t.after(cleanup);
  const base = `http://127.0.0.1:${server.address().port}/api/productos`;
  const inactivo = await fetch(`${base}/2`);
  assert.equal(inactivo.status, 404);

  const publico = await fetch(`${base}/1`);
  assert.equal(publico.status, 200);
  const producto = await publico.json();
  assert.equal(producto.disponible, true);
  for (const field of ["stock_actual", "stock_disponible", "stock_minimo"]) {
    assert.equal(Object.hasOwn(producto, field), false);
  }

  const cliente = await fetch(`${base}/2`, { headers: { Authorization: "Bearer client" } });
  assert.equal(cliente.status, 404);
  const admin = await fetch(`${base}/2`, { headers: { Authorization: "Bearer admin" } });
  assert.equal(admin.status, 200);
  assert.equal((await admin.json()).stock_actual, 99);
});
