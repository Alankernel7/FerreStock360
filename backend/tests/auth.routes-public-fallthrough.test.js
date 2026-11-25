const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const { test } = require("node:test");

const authRoutes = require("../src/routes/auth");

test("las rutas de autenticación no bloquean endpoints públicos montados después", async (t) => {
  const app = express();
  app.use("/api", authRoutes);
  app.get("/api/estadisticas-publicas", (_req, res) => {
    res.json({ ok: true, data: { total_productos: 3, total_categorias: 2 } });
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/estadisticas-publicas`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: { total_productos: 3, total_categorias: 2 },
  });
});
