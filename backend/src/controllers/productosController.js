// Controlador de productos.
// Recibe las solicitudes, valida datos, llama al servicio y devuelve la respuesta.

const { obtenerProductos, obtenerProductoPorId, crearProducto, actualizarProducto, eliminarProducto } = require("../services/productosService");

// GET /api/productos
const getProductos = async (req, res) => {
  try {
    const productos = await obtenerProductos();
    res.json(productos);
  } catch (err) {
    console.error("Error al obtener productos:", err.message);
    res.status(500).json({
      ok: false,
      message: "Error al consultar productos",
    });
  }
};

// POST /api/productos
const createProducto = async (req, res) => {
  try {
    const { nombre, descripcion, codigo, precio, stock_actual, stock_minimo, id_categoria, estado } = req.body;

    // Validaciones de campos obligatorios
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });
    }
    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ ok: false, message: "El código es obligatorio" });
    }
    if (precio === undefined || precio === null || Number(precio) < 0) {
      return res.status(400).json({ ok: false, message: "El precio es obligatorio y debe ser mayor o igual a 0" });
    }
    if (id_categoria === undefined || id_categoria === null) {
      return res.status(400).json({ ok: false, message: "La categoría es obligatoria" });
    }

    // El service ejecuta el INSERT utilizando parámetros SQL
    const nuevoProducto = await crearProducto({
      nombre: nombre.trim(),
      descripcion,
      codigo: codigo.trim(),
      precio: Number(precio),
      stock_actual: stock_actual !== undefined ? Number(stock_actual) : 0,
      stock_minimo: stock_minimo !== undefined ? Number(stock_minimo) : 5,
      id_categoria: Number(id_categoria),
      estado: estado !== undefined ? Number(estado) : 1,
    });

    // Devuelve el producto creado al cliente
    res.status(201).json({
      ok: true,
      message: "Producto registrado correctamente",
      data: nuevoProducto,
    });
  } catch (err) {
    console.error("Error al crear producto:", err.message);

    // Manejo de errores específicos de SQL Server
    if (err.message.includes("UK_productos") || err.message.includes("UNIQUE") || err.message.includes("duplicate")) {
      return res.status(409).json({ ok: false, message: "Ya existe un producto con ese código" });
    }
    if (err.message.includes("FK_productos_categorias") || err.message.includes("FOREIGN KEY")) {
      return res.status(400).json({ ok: false, message: "La categoría especificada no existe" });
    }

    res.status(500).json({ ok: false, message: "Error al registrar el producto" });
  }
};

// PUT /api/productos/:id
const updateProducto = async (req, res) => {
  try {
    // Obtiene el ID del producto desde la URL
    const id = parseInt(req.params.id);

    // Validación del ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de producto inválido" });
    }

    // Verifica que el producto exista
    const existente = await obtenerProductoPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Producto no encontrado" });
    }

    // Recibe los datos del body
    const { nombre, descripcion, codigo, precio, stock_actual, stock_minimo, id_categoria, estado } = req.body;

    // Validaciones de campos obligatorios
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });
    }
    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ ok: false, message: "El código es obligatorio" });
    }
    if (precio === undefined || precio === null || Number(precio) < 0) {
      return res.status(400).json({ ok: false, message: "El precio es obligatorio y debe ser mayor o igual a 0" });
    }
    if (id_categoria === undefined || id_categoria === null) {
      return res.status(400).json({ ok: false, message: "La categoría es obligatoria" });
    }

    // El service ejecuta el UPDATE utilizando parámetros SQL
    const productoActualizado = await actualizarProducto(id, {
      nombre: nombre.trim(),
      descripcion,
      codigo: codigo.trim(),
      precio: Number(precio),
      stock_actual: stock_actual !== undefined ? Number(stock_actual) : existente.stock_actual,
      stock_minimo: stock_minimo !== undefined ? Number(stock_minimo) : existente.stock_minimo,
      id_categoria: Number(id_categoria),
      estado: estado !== undefined ? Number(estado) : existente.estado,
    });

    // Devuelve el producto actualizado al cliente
    res.json({
      ok: true,
      message: "Producto actualizado correctamente",
      data: productoActualizado,
    });
  } catch (err) {
    console.error("Error al actualizar producto:", err.message);

    // Manejo de errores específicos de SQL Server
    if (err.message.includes("UNIQUE") || err.message.includes("duplicate")) {
      return res.status(409).json({ ok: false, message: "Ya existe otro producto con ese código" });
    }
    if (err.message.includes("FK_productos_categorias") || err.message.includes("FOREIGN KEY")) {
      return res.status(400).json({ ok: false, message: "La categoría especificada no existe" });
    }

    res.status(500).json({ ok: false, message: "Error al actualizar el producto" });
  }
};

// DELETE /api/productos/:id
const deleteProducto = async (req, res) => {
  try {
    // Obtiene el ID del producto desde la URL
    const id = parseInt(req.params.id);

    // Validación del ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de producto inválido" });
    }

    // Verifica que el producto exista
    const existente = await obtenerProductoPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Producto no encontrado" });
    }

    // El service ejecuta el DELETE utilizando un parámetro SQL
    await eliminarProducto(id);

    // Devuelve confirmación al cliente
    res.json({
      ok: true,
      message: "Producto eliminado correctamente",
    });
  } catch (err) {
    console.error("Error al eliminar producto:", err.message);

    // Manejo de errores de Foreign Key (producto con registros relacionados)
    if (err.message.includes("FOREIGN KEY") || err.message.includes("FK_")) {
      return res.status(409).json({
        ok: false,
        message: "No se puede eliminar el producto porque tiene registros relacionados en otras tablas",
      });
    }

    res.status(500).json({ ok: false, message: "Error al eliminar el producto" });
  }
};

module.exports = { getProductos, createProducto, updateProducto, deleteProducto };
