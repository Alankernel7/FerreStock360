const assert = require("node:assert/strict");
const { test } = require("node:test");
const { adaptarReservasSteff } = require("../src/config/firestore");

test("el adaptador conserva reservas Steff activas y comprometidas, e ignora expiradas", () => {
  const ahora = Date.now();
  const doc = (id, data) => ({ id, data: () => data });
  const productos = [doc("prod-a", { id_producto: 42 })];
  const holds = [doc("prod-a", { holds: {
    ucliente: { cantidad: 2, expira: ahora + 60_000 },
    "p900": { cantidad: 3, expira: null },
    uvencida: { cantidad: 8, expira: ahora - 1 },
  } })];

  const reservas = adaptarReservasSteff(holds, productos, ahora);
  assert.equal(reservas.length, 2);
  assert.deepEqual(reservas.map((r) => r.data().cantidad).sort(), [2, 3]);
  assert.ok(reservas.every((r) => r.data().id_producto === 42));
  assert.deepEqual(new Set(reservas.map((r) => r.data().estado)), new Set(["activa", "confirmada"]));
});
