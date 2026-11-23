const { listarMovimientos } = require("../services/movimientosService");

const fechaValida = (valor) => {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
};

const getMovimientos = async (req, res) => {
  const busqueda = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (busqueda.length > 150) return res.status(400).json({ ok: false, message: "La búsqueda no puede superar 150 caracteres" });

  const tipo = req.query.tipo === undefined ? "todos" : req.query.tipo;
  if (!["todos", "entrada", "salida"].includes(tipo)) return res.status(400).json({ ok: false, message: "El tipo de movimiento no es válido" });

  const direccion = req.query.direccion === undefined ? "desc" : req.query.direccion;
  if (!["asc", "desc"].includes(direccion)) return res.status(400).json({ ok: false, message: "El orden por fecha no es válido" });

  const desde = req.query.desde;
  const hasta = req.query.hasta;
  if (desde !== undefined && !fechaValida(desde)) return res.status(400).json({ ok: false, message: "La fecha inicial no es válida" });
  if (hasta !== undefined && !fechaValida(hasta)) return res.status(400).json({ ok: false, message: "La fecha final no es válida" });
  if (desde && hasta && desde > hasta) return res.status(400).json({ ok: false, message: "La fecha inicial debe ser anterior o igual a la fecha final" });

  try {
    const data = await listarMovimientos({ busqueda, tipo, desde, hasta, direccion });
    return res.json({ ok: true, data });
  } catch (error) {
    console.error("Error al consultar movimientos:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudo consultar el historial de movimientos" });
  }
};

module.exports = { getMovimientos };
