const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { test } = require("node:test");

test("autenticación unificada: exige Firebase ID token y no expone login JWT", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api", require("../src/routes/auth"));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const sinToken = await fetch(`${base}/auth/firebase`, { method: "POST" });
  assert.equal(sinToken.status, 401);

  const perfilSinToken = await fetch(`${base}/auth/perfil`);
  assert.equal(perfilSinToken.status, 401);

  for (const path of ["/auth/login", "/auth/register"]) {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(response.status, 404);
  }
});
