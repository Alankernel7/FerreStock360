const assert = require("node:assert/strict");
const { test } = require("node:test");
const { fechasRetiroDisponibles, validarFechaRetiro } = require("../src/config/retiros");

test("las fechas de retiro solo incluyen los días configurados y no fechas pasadas", () => {
  const fechas = fechasRetiroDisponibles(new Date("2026-11-19T18:00:00.000Z"));
  assert.ok(fechas.length > 0);
  assert.ok(fechas.every((fecha) => fecha >= "2026-11-19"));
  assert.ok(fechas.every((fecha) => new Date(`${fecha}T00:00:00.000Z`).getUTCDay() !== 0));
});

test("valida que la fecha solicitada aparezca en el calendario de retiro", () => {
  assert.throws(() => validarFechaRetiro("2026-11-18", new Date("2026-11-19T18:00:00.000Z")), { status: 400 });
  assert.throws(() => validarFechaRetiro("2026-11-22", new Date("2026-11-19T18:00:00.000Z")), { status: 400 });
  assert.throws(() => validarFechaRetiro("2026-02-30", new Date("2026-02-01T18:00:00.000Z")), { status: 400 });
});
