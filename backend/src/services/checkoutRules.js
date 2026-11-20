const LUHN = (numero) => {
  let suma = 0;
  let duplicar = false;
  for (let indice = numero.length - 1; indice >= 0; indice -= 1) {
    let digito = Number(numero[indice]);
    if (duplicar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
};

const validarTarjetaDemo = (tarjeta = {}) => {
  const numero = String(tarjeta.numero || "").replace(/[ -]/g, "");
  const cvv = String(tarjeta.cvv || "");
  const vencimiento = String(tarjeta.vencimiento || "");
  const coincidencia = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(vencimiento);
  if (!/^\d{13,19}$/.test(numero) || !LUHN(numero)) {
    return { valida: false, error: "El número de tarjeta de demostración no es válido" };
  }
  if (!/^\d{3,4}$/.test(cvv)) {
    return { valida: false, error: "El CVV de demostración no es válido" };
  }
  if (!coincidencia) {
    return { valida: false, error: "Usa el formato MM/AA para el vencimiento" };
  }
  const anio = 2000 + Number(coincidencia[2]);
  const mes = Number(coincidencia[1]);
  const ahora = new Date();
  if (anio < ahora.getFullYear() || (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1)) {
    return { valida: false, error: "La tarjeta de demostración está vencida" };
  }
  return { valida: true, aprobado: Number(numero.at(-1)) % 2 === 0, ultimos4: numero.slice(-4) };
};

const validarCantidadCarrito = ({ producto, cantidad }) => {
  if (!producto) throw Object.assign(new Error("El producto no existe"), { status: 404 });
  if (!producto.estado) throw Object.assign(new Error("El producto no está disponible"), { status: 409 });
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) throw Object.assign(new Error("La cantidad debe ser un entero mayor que cero"), { status: 400 });
  if (cantidad > producto.stock_actual) throw Object.assign(new Error("La cantidad supera las existencias disponibles"), { status: 409 });
};

const validarItemsCheckout = (items) => {
  if (!items.length) throw Object.assign(new Error("El carrito está vacío"), { status: 400 });
  for (const item of items) {
    if (!item.estado) throw Object.assign(new Error(`${item.nombre} ya no está disponible`), { status: 409 });
    if (!Number.isSafeInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > item.stock_actual) {
      throw Object.assign(new Error(`Existencias insuficientes para ${item.nombre}`), { status: 409 });
    }
  }
  return items.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0);
};

module.exports = { validarTarjetaDemo, validarCantidadCarrito, validarItemsCheckout };
