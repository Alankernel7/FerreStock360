const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validarTarjetaDemo, validarCantidadCarrito, validarItemsCheckout } = require("../src/services/checkoutRules");

test("simulación aprueba una tarjeta de demostración válida con terminación par", () => {
  const result = validarTarjetaDemo({ numero: "4242 4242 4242 4242", vencimiento: "12/30", cvv: "123" });
  assert.equal(result.valida, true);
  assert.equal(result.aprobado, true);
  assert.equal(result.ultimos4, "4242");
  assert.equal("numero" in result, false);
  assert.equal("cvv" in result, false);
});

test("simulación rechaza una tarjeta de demostración válida con terminación impar", () => {
  const result = validarTarjetaDemo({ numero: "4000 0000 0000 0051", vencimiento: "12/30", cvv: "123" });
  assert.equal(result.valida, true);
  assert.equal(result.aprobado, false);
});

test("rechaza datos de tarjeta incompletos o con formato inválido", () => {
  assert.equal(validarTarjetaDemo({ numero: "123", vencimiento: "12/30", cvv: "123" }).valida, false);
  assert.equal(validarTarjetaDemo({ numero: "4242424242424242", vencimiento: "15/30", cvv: "123" }).valida, false);
  assert.equal(validarTarjetaDemo({ numero: "4242424242424242", vencimiento: "12/30", cvv: "1" }).valida, false);
});

test("rechaza vencimiento pasado", () => {
  assert.equal(validarTarjetaDemo({ numero: "4242424242424242", vencimiento: "01/20", cvv: "123" }).valida, false);
});

test("el carrito valida existencia, estado y límite de stock del producto", () => {
  assert.throws(() => validarCantidadCarrito({ producto: null, cantidad: 1 }), { status: 404 });
  assert.throws(() => validarCantidadCarrito({ producto: { estado: false, stock_actual: 2 }, cantidad: 1 }), { status: 409 });
  assert.throws(() => validarCantidadCarrito({ producto: { estado: true, stock_actual: 2 }, cantidad: 3 }), { status: 409 });
  assert.throws(() => validarCantidadCarrito({ producto: { estado: true, stock_actual: 2 }, cantidad: 0 }), { status: 400 });
  assert.doesNotThrow(() => validarCantidadCarrito({ producto: { estado: true, stock_actual: 2 }, cantidad: 2 }));
});

test("el checkout rechaza carrito vacío, productos inactivos y stock insuficiente", () => {
  assert.throws(() => validarItemsCheckout([]), { status: 400 });
  assert.throws(() => validarItemsCheckout([{ nombre: "Desactivado", estado: false, cantidad: 1, stock_actual: 2 }]), { status: 409 });
  assert.throws(() => validarItemsCheckout([{ nombre: "Agotado", estado: true, cantidad: 3, stock_actual: 2 }]), { status: 409 });
});

test("el checkout calcula el total desde precio y cantidades consultadas por el servidor", () => {
  const subtotal = validarItemsCheckout([
    { nombre: "Tornillos", estado: true, precio: 1.25, cantidad: 2, stock_actual: 4 },
    { nombre: "Martillo", estado: true, precio: 8.5, cantidad: 1, stock_actual: 3 },
  ]);
  assert.equal(subtotal, 11);
});
