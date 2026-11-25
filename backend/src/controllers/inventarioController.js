const { listarInventario, registrarMovimiento } = require("../services/inventarioService");
const { obtenerCategorias } = require("../services/categoriasService");

const getInventario = async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length > 150) return res.status(400).json({ ok: false, message: "La búsqueda no puede superar 150 caracteres" });
    const categoria = req.query.categoria === undefined ? null : Number(req.query.categoria);
    if (categoria !== null && (!Number.isInteger(categoria) || categoria <= 0 || categoria > 2147483647)) {
      return res.status(400).json({ ok: false, message: "La categoría seleccionada no es válida" });
    }
    const filtroStock = req.query.stock === undefined ? "todos" : req.query.stock;
    const stock = ["", "todos", "bajo", "agotado"].includes(filtroStock) ? filtroStock : null;
    if (stock === null) return res.status(400).json({ ok: false, message: "El filtro de stock no es válido" });
    const orden = [undefined, "nombre", "cantidad"].includes(req.query.orden) ? req.query.orden : null;
    if (orden === null) return res.status(400).json({ ok: false, message: "El orden seleccionado no es válido" });
    const direccion = [undefined, "asc", "desc"].includes(req.query.direccion) ? req.query.direccion : null;
    if (direccion === null) return res.status(400).json({ ok: false, message: "La dirección del orden no es válida" });

    const data = await listarInventario({ busqueda: q, categoria, stock, orden, direccion });
    return res.json({ ok: true, data });
  } catch (error) {
    console.error("Error al consultar inventario:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudo consultar el inventario" });
  }
};

const getCategoriasInventario = async (_req, res) => {
  try {
    const categorias = await obtenerCategorias();
    return res.json({
      ok: true,
      data: categorias.map(({ id_categoria, nombre }) => ({ id_categoria, nombre })),
    });
  } catch (error) {
    console.error("Error al consultar categorías:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudieron consultar las categorías" });
  }
};

const postMovimiento = async (req, res) => {
  const idProducto = Number(req.body?.id_producto);
  const cantidad = Number(req.body?.cantidad);
  const tipo = req.body?.tipo_movimiento;
  const motivo = req.body?.motivo === undefined || req.body?.motivo === null ? "" : req.body.motivo;
  const errores = [];
  if (!Number.isInteger(idProducto) || idProducto <= 0 || idProducto > 2147483647) errores.push("Selecciona un producto válido");
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 2147483647) errores.push("La cantidad debe ser un entero positivo dentro del límite permitido");
  if (!["entrada", "salida"].includes(tipo)) errores.push("El tipo debe ser entrada o salida");
  if (typeof motivo !== "string" || motivo.trim().length > 300) errores.push("El motivo no puede superar 300 caracteres");
  if (errores.length) return res.status(400).json({ ok: false, message: errores[0], errores });

  try {
    const data = await registrarMovimiento({
      idProducto, idUsuario: Number(req.usuario.id_usuario), tipo, cantidad, motivo: motivo.trim(),
    });
    return res.status(201).json({ ok: true, message: "Movimiento registrado correctamente", data });
  } catch (error) {
    console.error("Error al registrar movimiento:", error.message);
    return res.status(error.status || 500).json({ ok: false, message: error.status ? error.message : "No se pudo registrar el movimiento" });
  }
};

module.exports = { getInventario, getCategoriasInventario, postMovimiento };
