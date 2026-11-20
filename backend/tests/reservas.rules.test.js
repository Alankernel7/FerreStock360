const assert = require("node:assert/strict");
const { test } = require("node:test");
const { obtenerStockDisponible, obtenerMaximoCarrito, validarDisponibilidadReserva, reservaVigente } = require("../src/services/reservasRules");

test("una unidad reservada reduce disponibilidad sin modificar el stock físico", () => {
  assert.equal(obtenerStockDisponible(8, 1), 7);
  assert.equal(obtenerStockDisponible(8, 1), 8 - 1);
});

test("varias reservas se restan de la cantidad física y nunca muestran disponibilidad negativa", () => {
  assert.equal(obtenerStockDisponible(8, 2), 6);
  assert.equal(obtenerStockDisponible(4, 7), 0);
});

test("la cantidad propia se excluye al calcular cuánto puede aumentar su carrito", () => {
  assert.equal(obtenerMaximoCarrito(8, 7), 1);
  assert.equal(obtenerMaximoCarrito(8, 6), 2);
});

test("acepta una reserva dentro del límite y rechaza aumento sin stock adicional", () => {
  assert.equal(validarDisponibilidadReserva({ stockFisico: 8, reservasTotales: 1, reservaPropia: 0, cantidad: 1 }), 7);
  assert.throws(() => validarDisponibilidadReserva({ stockFisico: 8, reservasTotales: 8, reservaPropia: 1, cantidad: 2 }), { status: 409 });
  assert.throws(() => validarDisponibilidadReserva({ stockFisico: 8, reservasTotales: 1, reservaPropia: 0, cantidad: 0 }), { status: 400 });
});

test("una reserva solo está vigente mientras está activa y no ha vencido", () => {
  const ahora = Date.parse("2026-11-18T12:00:00Z");
  assert.equal(reservaVigente("activa", "2026-11-18T12:15:00Z", ahora), true);
  assert.equal(reservaVigente("activa", "2026-11-18T11:59:59Z", ahora), false);
  assert.equal(reservaVigente("vencida", "2026-11-18T12:15:00Z", ahora), false);
  assert.equal(reservaVigente("liberada", "2026-11-18T12:15:00Z", ahora), false);
});
