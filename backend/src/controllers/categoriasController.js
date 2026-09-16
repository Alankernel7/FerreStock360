// Controlador de categorías.
// Recibe las solicitudes, valida datos, llama al servicio y devuelve la respuesta.

const { obtenerCategorias, obtenerCategoriaPorId, crearCategoria, actualizarCategoria, eliminarCategoria } = require("../services/categoriasService");

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
    const { nombre, descripcion } = req.body;

    // Validaciones de campos obligatorios
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });
    }

    // El service ejecuta el INSERT utilizando parámetros SQL
    const nuevaCategoria = await crearCategoria({
      nombre: nombre.trim(),
      descripcion,
    });

    res.status(201).json({
      ok: true,
      message: "Categoría registrada correctamente",
      data: nuevaCategoria,
    });
  } catch (err) {
    console.error("Error al crear categoría:", err.message);

    // Manejo de nombre duplicado
    if (err.message.includes("UNIQUE") || err.message.includes("duplicate")) {
      return res.status(409).json({ ok: false, message: "Ya existe una categoría con ese nombre" });
    }

    res.status(500).json({ ok: false, message: "Error al registrar la categoría" });
  }
};

// PUT /api/categorias/:id
const updateCategoria = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Validación del ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de categoría inválido" });
    }

    // Verifica que la categoría exista
    const existente = await obtenerCategoriaPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Categoría no encontrada" });
    }

    const { nombre, descripcion } = req.body;

    // Validaciones de campos obligatorios
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });
    }

    // El service ejecuta el UPDATE utilizando parámetros SQL
    const categoriaActualizada = await actualizarCategoria(id, {
      nombre: nombre.trim(),
      descripcion,
    });

    res.json({
      ok: true,
      message: "Categoría actualizada correctamente",
      data: categoriaActualizada,
    });
  } catch (err) {
    console.error("Error al actualizar categoría:", err.message);

    if (err.message.includes("UNIQUE") || err.message.includes("duplicate")) {
      return res.status(409).json({ ok: false, message: "Ya existe otra categoría con ese nombre" });
    }

    res.status(500).json({ ok: false, message: "Error al actualizar la categoría" });
  }
};

// DELETE /api/categorias/:id
const deleteCategoria = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Validación del ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de categoría inválido" });
    }

    // Verifica que la categoría exista
    const existente = await obtenerCategoriaPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Categoría no encontrada" });
    }

    // El service ejecuta el DELETE utilizando un parámetro SQL
    await eliminarCategoria(id);

    res.json({ ok: true, message: "Categoría eliminada correctamente" });
  } catch (err) {
    console.error("Error al eliminar categoría:", err.message);

    // Manejo de Foreign Key (categoría con productos relacionados)
    if (err.message.includes("FOREIGN KEY") || err.message.includes("FK_")) {
      return res.status(409).json({
        ok: false,
        message: "No se puede eliminar la categoría porque tiene productos relacionados",
      });
    }

    res.status(500).json({ ok: false, message: "Error al eliminar la categoría" });
  }
};

module.exports = { getCategorias, getCategoriaById, createCategoria, updateCategoria, deleteCategoria };
