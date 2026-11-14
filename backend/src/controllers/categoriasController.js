// Controlador de categorías.
// Recibe las solicitudes, valida datos, llama al servicio y devuelve la respuesta.

const {
  obtenerCategorias,
  obtenerCategoriaPorId,
  existeCategoriaPorNombre,
  contarProductosPorCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} = require("../services/categoriasService");

// Longitudes máximas según el esquema de SQL Server.
const MAX_NOMBRE = 100;
const MAX_DESCRIPCION = 200;

// Valida y normaliza los datos recibidos desde el cliente.
// Devuelve la lista de errores y los datos limpios.
const validarCategoria = (body) => {
  const errores = [];

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const descripcion =
    typeof body.descripcion === "string" ? body.descripcion.trim() : "";

  if (!nombre) {
    errores.push("El nombre de la categoría es obligatorio");
  } else if (nombre.length > MAX_NOMBRE) {
    errores.push(`El nombre no puede superar los ${MAX_NOMBRE} caracteres`);
  }

  if (descripcion.length > MAX_DESCRIPCION) {
    errores.push(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres`);
  }

  return {
    errores,
    datos: {
      nombre,
      descripcion: descripcion || null,
    },
  };
};

// GET /api/categorias
const getCategorias = async (req, res) => {
  try {
    const categorias = await obtenerCategorias();
    res.json(categorias);
  } catch (err) {
    console.error("Error al obtener categorías:", err.message);
    res.status(500).json({ ok: false, message: "Error al consultar categorías" });
  }
};

// GET /api/categorias/:id
const getCategoriaById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de categoría inválido" });
    }

    const categoria = await obtenerCategoriaPorId(id);
    if (!categoria) {
      return res.status(404).json({ ok: false, message: "Categoría no encontrada" });
    }

    res.json(categoria);
  } catch (err) {
    console.error("Error al obtener categoría:", err.message);
    res.status(500).json({ ok: false, message: "Error al consultar la categoría" });
  }
};

// POST /api/categorias
const createCategoria = async (req, res) => {
  try {
    const { errores, datos } = validarCategoria(req.body || {});

    if (errores.length > 0) {
      return res.status(400).json({ ok: false, message: errores[0], errores });
    }

    // Evita categorías duplicadas antes de llegar a SQL Server.
    const duplicada = await existeCategoriaPorNombre(datos.nombre);
    if (duplicada) {
      return res.status(409).json({ ok: false, message: "Ya existe una categoría con ese nombre" });
    }

    const nuevaCategoria = await crearCategoria(datos);

    res.status(201).json({
      ok: true,
      message: "Categoría registrada correctamente",
      data: nuevaCategoria,
    });
  } catch (err) {
    console.error("Error al crear categoría:", err.message);

    // Respaldo: restricción UNIQUE de SQL Server.
    if (err.message.includes("UNIQUE") || err.message.includes("duplicate") || err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ ok: false, message: "Ya existe una categoría con ese nombre" });
    }

    res.status(500).json({ ok: false, message: "Error al registrar la categoría" });
  }
};

// PUT /api/categorias/:id
const updateCategoria = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de categoría inválido" });
    }

    const existente = await obtenerCategoriaPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Categoría no encontrada" });
    }

    const { errores, datos } = validarCategoria(req.body || {});

    if (errores.length > 0) {
      return res.status(400).json({ ok: false, message: errores[0], errores });
    }

    // Permite conservar el mismo nombre de la categoría actual.
    const duplicada = await existeCategoriaPorNombre(datos.nombre, id);
    if (duplicada) {
      return res.status(409).json({ ok: false, message: "Ya existe otra categoría con ese nombre" });
    }

    const categoriaActualizada = await actualizarCategoria(id, datos);

    res.json({
      ok: true,
      message: "Categoría actualizada correctamente",
      data: categoriaActualizada,
    });
  } catch (err) {
    console.error("Error al actualizar categoría:", err.message);

    if (err.message.includes("UNIQUE") || err.message.includes("duplicate") || err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ ok: false, message: "Ya existe otra categoría con ese nombre" });
    }

    res.status(500).json({ ok: false, message: "Error al actualizar la categoría" });
  }
};

// DELETE /api/categorias/:id
const deleteCategoria = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de categoría inválido" });
    }

    const existente = await obtenerCategoriaPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Categoría no encontrada" });
    }

    // No se elimina una categoría con productos asociados.
    const totalProductos = await contarProductosPorCategoria(id);
    if (totalProductos > 0) {
      return res.status(409).json({
        ok: false,
        message: `No se puede eliminar la categoría "${existente.nombre}" porque tiene ${totalProductos} producto(s) asociado(s). Reasigna o elimina primero esos productos.`,
      });
    }

    await eliminarCategoria(id);

    res.json({ ok: true, message: "Categoría eliminada correctamente" });
  } catch (err) {
    console.error("Error al eliminar categoría:", err.message);

    // Respaldo: restricción de clave foránea de SQL Server.
    if (err.message.includes("FOREIGN KEY") || err.message.includes("FK_") || err.number === 547) {
      return res.status(409).json({
        ok: false,
        message: "No se puede eliminar la categoría porque tiene productos relacionados",
      });
    }

    res.status(500).json({ ok: false, message: "Error al eliminar la categoría" });
  }
};

module.exports = { getCategorias, getCategoriaById, createCategoria, updateCategoria, deleteCategoria };
