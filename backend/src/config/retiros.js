const ZONA_RETIRO = process.env.ZONA_RETIRO || "America/El_Salvador";
const DIAS_RETIRO = (process.env.DIAS_RETIRO || "1,2,3,4,5,6")
  .split(",")
  .map((dia) => Number(dia.trim()))
  .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6);
const DIAS_PARA_MOSTRAR = 90;

const fechaLocalISO = (fecha = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_RETIRO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(fecha);

const fechaValida = (valor) => typeof valor === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(valor)
  && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`))
  && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;

const fechasRetiroDisponibles = (ahora = new Date()) => {
  const inicio = fechaLocalISO(ahora);
  const resultado = [];
  for (let offset = 0; offset <= DIAS_PARA_MOSTRAR; offset += 1) {
    const fecha = new Date(`${inicio}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + offset);
    const valor = fecha.toISOString().slice(0, 10);
    if (DIAS_RETIRO.includes(fecha.getUTCDay())) resultado.push(valor);
  }
  return resultado;
};

const validarFechaRetiro = (valor, ahora = new Date()) => {
  if (!fechaValida(valor) || !fechasRetiroDisponibles(ahora).includes(valor)) {
    throw Object.assign(new Error("Selecciona una fecha de retiro permitida."), { status: 400 });
  }
  return valor;
};

module.exports = { ZONA_RETIRO, DIAS_RETIRO, fechaLocalISO, fechasRetiroDisponibles, validarFechaRetiro };
