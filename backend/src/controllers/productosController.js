// Controlador de productos.
// Recibe las solicitudes, valida datos, llama al servicio y devuelve la respuesta.

const {
  obtenerProductos,
  obtenerProductoPorId,
  existeProductoPorCodigo,
  existeCategoriaPorId,
  contarMovimientosPorProducto,
  contarAlertasPorProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} = require("../services/productosService");

// Límites según el esquema SQL Server.
const MAX_NOMBRE = 150;
const MAX_CODIGO = 50;
const MAX_DESCRIPCION = 500;
// imagen_1 e imagen_2 son varchar(max) en SQL Server; se aplica un límite
// razonable a nivel de aplicación para rutas de imagen.
const MAX_IMAGEN = 500;
const MAX_INT = 2147483647;
const MAX_PRECIO = 99999999.99;

// Valida y normaliza las entradas de un producto (crear o editar).
// No confía en los datos enviados desde React.
const validarProducto = (entrada) => {
  const errores = [];

  // Nombre (obligatorio, 1..150)
  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  if (!nombre) {
    errores.push("El nombre del producto es obligatorio");
  } else if (nombre.length > MAX_NOMBRE) {
    errores.push(`El nombre no puede superar los ${MAX_NOMBRE} caracteres`);
  }

  // Código (obligatorio, 1..50)
  const codigo = typeof entrada.codigo === "string" ? entrada.codigo.trim() : "";
  if (!codigo) {
    errores.push("El código del producto es obligatorio");
  } else if (codigo.length > MAX_CODIGO) {
    errores.push(`El código no puede superar los ${MAX_CODIGO} caracteres`);
  }

  // Descripción (opcional, máx 500)
  let descripcion = "";
  if (entrada.descripcion !== undefined && entrada.descripcion !== null) {
    if (typeof entrada.descripcion !== "string") {
      errores.push("La descripción no es válida");
    } else {
      descripcion = entrada.descripcion.trim();
    }
  }
  if (descripcion.length > MAX_DESCRIPCION) {
    errores.push(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres`);
  }

  // Precio (obligatorio, numérico, >= 0, DECIMAL(10,2))
  let precio = 0;
  const precioRaw = entrada.precio;
  if (precioRaw === undefined || precioRaw === null || precioRaw === "") {
    errores.push("El precio es obligatorio");
  } else if (typeof precioRaw !== "number" && typeof precioRaw !== "string") {
    errores.push("El precio debe ser un valor numérico");
  } else {
    const numero = Number(precioRaw);
    if (!Number.isFinite(numero)) {
      errores.push("El precio debe ser un valor numérico");
    } else if (numero < 0) {
      errores.push("El precio no puede ser negativo");
    } else if (numero > MAX_PRECIO) {
      errores.push(`El precio no puede superar ${MAX_PRECIO}`);
    } else {
      // Respeta la escala DECIMAL(10,2) de SQL Server.
      precio = Math.round(numero * 100) / 100;
    }
  }

  // Stock e enteros no negativos
  const leerEntero = (valor, campo, defecto) => {
    if (valor === undefined || valor === null || valor === "") {
      return defecto;
    }

    const numero = Number(valor);

    if (!Number.isInteger(numero)) {
      errores.push(`${campo} debe ser un número entero`);
      return defecto;
    }
    if (numero < 0) {
      errores.push(`${campo} no puede ser negativo`);
      return defecto;
    }
    if (numero > MAX_INT) {
      errores.push(`${campo} está fuera del rango permitido`);
      return defecto;
    }

    return numero;
  };

  const stockActual = leerEntero(entrada.stock_actual, "El stock actual", 0);
  const stockMinimo = leerEntero(entrada.stock_minimo, "El stock mínimo", 5);

  // Imágenes (opcionales). La tabla real usa imagen_1 e imagen_2 (varchar(max)).
  const validarImagen = (valor, etiqueta) => {
    if (valor === undefined || valor === null || valor === "") {
      return { valor: null, error: null };
    }

    if (typeof valor !== "string") {
      return { valor: null, error: `La ruta de ${etiqueta} no es válida` };
    }

    const limpia = valor.trim();

    if (!limpia) {
      return { valor: null, error: null };
    }
    if (limpia.length > MAX_IMAGEN) {
      return {
        valor: null,
        error: `La ruta de ${etiqueta} no puede superar los ${MAX_IMAGEN} caracteres`,
      };
    }
    if (!/^(\/|https?:\/\/)/i.test(limpia)) {
      return {
        valor: null,
        error: `La ruta de ${etiqueta} debe comenzar con / o http(s)://`,
      };
    }

    return { valor: limpia, error: null };
  };

  const imagen1 = validarImagen(entrada.imagen_1, "la imagen 1");
  if (imagen1.error) errores.push(imagen1.error);

  const imagen2 = validarImagen(entrada.imagen_2, "la imagen 2");
  if (imagen2.error) errores.push(imagen2.error);

  // Categoría (obligatoria y entero positivo)
  let idCategoria = NaN;
  const categoriaRaw = entrada.id_categoria;
  if (categoriaRaw === undefined || categoriaRaw === null || categoriaRaw === "") {
    errores.push("Debes seleccionar una categoría");
  } else {
    idCategoria = Number(categoriaRaw);
    if (!Number.isInteger(idCategoria) || idCategoria <= 0) {
      errores.push("La categoría seleccionada no es válida");
    }
  }

  // Estado (bit)
  let estado = true;
  if (entrada.estado !== undefined && entrada.estado !== null) {
    estado =
      entrada.estado === true ||
      entrada.estado === 1 ||
      entrada.estado === "1" ||
      entrada.estado === "true";
  }

  return {
    errores,
    datos: {
      nombre,
      codigo,
      descripcion: descripcion || null,
      precio,
      imagen_1: imagen1.valor,
      imagen_2: imagen2.valor,
      stock_actual: stockActual,
      stock_minimo: stockMinimo,
      id_categoria: idCategoria,
      estado,
    },
  };
};

// GET /api/productos
// Acepta ?estado=activo para devolver solo productos activos (catálogo público).
// Sin el parámetro devuelve todos (módulo administrativo: activos e inactivos).
const getProductos = async (req, res) => {
  try {
    const soloActivos =
      typeof req.query.estado === "string" &&
      req.query.estado.trim().toLowerCase() === "activo";

    const productos = await obtenerProductos({ soloActivos });
    res.json(productos);
  } catch (err) {
    console.error("Error al obtener productos:", err.message);
    res.status(500).json({
      ok: false,
      message: "Error al consultar productos",
    });
  }
};

// GET /api/productos/:id
const getProductoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: "ID de producto inválido",
      });
    }

    const producto = await obtenerProductoPorId(id);

    if (!producto) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    res.json(producto);
  } catch (err) {
    console.error("Error al obtener producto:", err.message);

    res.status(500).json({
      ok: false,
      message: "Error al consultar el producto",
    });
  }
};

// POST /api/productos
const createProducto = async (req, res) => {
  try {
    const { errores, datos } = validarProducto(req.body || {});

    if (errores.length > 0) {
      return res.status(400).json({ ok: false, message: errores[0], errores });
    }

    // La categoría debe existir.
    const categoriaValida = await existeCategoriaPorId(datos.id_categoria);
    if (!categoriaValida) {
      return res.status(400).json({ ok: false, message: "La categoría especificada no existe" });
    }

    // Evita códigos duplicados antes de llegar a SQL Server.
    const duplicado = await existeProductoPorCodigo(datos.codigo);
    if (duplicado) {
      return res.status(409).json({ ok: false, message: "Ya existe un producto con ese código" });
    }

    const nuevoProducto = await crearProducto(datos);

    res.status(201).json({
      ok: true,
      message: "Producto registrado correctamente",
      data: nuevoProducto,
    });
  } catch (err) {
    console.error("Error al crear producto:", err.message);

    if (err.message.includes("UNIQUE") || err.message.includes("duplicate") || err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ ok: false, message: "Ya existe un producto con ese código" });
    }
    if (err.message.includes("FOREIGN KEY") || err.message.includes("FK_") || err.number === 547) {
      return res.status(400).json({ ok: false, message: "La categoría especificada no existe" });
    }

    res.status(500).json({ ok: false, message: "Error al registrar el producto" });
  }
};

// PUT /api/productos/:id
const updateProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de producto inválido" });
    }

    const existente = await obtenerProductoPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Producto no encontrado" });
    }

    const body = req.body || {};

    // Los campos ausentes conservan el valor actual del producto.
    const entrada = {
      nombre: body.nombre,
      codigo: body.codigo,
      descripcion: body.descripcion !== undefined ? body.descripcion : existente.descripcion,
      precio: body.precio,
      imagen_1: body.imagen_1 !== undefined ? body.imagen_1 : existente.imagen_1,
      imagen_2: body.imagen_2 !== undefined ? body.imagen_2 : existente.imagen_2,
      stock_actual: body.stock_actual !== undefined ? body.stock_actual : existente.stock_actual,
      stock_minimo: body.stock_minimo !== undefined ? body.stock_minimo : existente.stock_minimo,
      id_categoria: body.id_categoria,
      estado: body.estado !== undefined ? body.estado : existente.estado,
    };

    const { errores, datos } = validarProducto(entrada);

    if (errores.length > 0) {
      return res.status(400).json({ ok: false, message: errores[0], errores });
    }

    const categoriaValida = await existeCategoriaPorId(datos.id_categoria);
    if (!categoriaValida) {
      return res.status(400).json({ ok: false, message: "La categoría especificada no existe" });
    }

    // Permite conservar el mismo código del producto actual.
    const duplicado = await existeProductoPorCodigo(datos.codigo, id);
    if (duplicado) {
      return res.status(409).json({ ok: false, message: "Ya existe otro producto con ese código" });
    }

    const productoActualizado = await actualizarProducto(id, datos);

    res.json({
      ok: true,
      message: "Producto actualizado correctamente",
      data: productoActualizado,
    });
  } catch (err) {
    console.error("Error al actualizar producto:", err.message);

    if (err.message.includes("UNIQUE") || err.message.includes("duplicate") || err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ ok: false, message: "Ya existe otro producto con ese código" });
    }
    if (err.message.includes("FOREIGN KEY") || err.message.includes("FK_") || err.number === 547) {
      return res.status(400).json({ ok: false, message: "La categoría especificada no existe" });
    }

    res.status(500).json({ ok: false, message: "Error al actualizar el producto" });
  }
};

// DELETE /api/productos/:id
const deleteProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID de producto inválido" });
    }

    const existente = await obtenerProductoPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: "Producto no encontrado" });
    }

    // No se elimina un producto con movimientos o alertas asociadas.
    const movimientos = await contarMovimientosPorProducto(id);
    const alertas = await contarAlertasPorProducto(id);

    if (movimientos > 0 || alertas > 0) {
      return res.status(409).json({
        ok: false,
        message: `No se puede eliminar el producto "${existente.nombre}" porque tiene ${movimientos} movimiento(s) y ${alertas} alerta(s) asociados.`,
      });
    }

    await eliminarProducto(id);

    res.json({
      ok: true,
      message: "Producto eliminado correctamente",
    });
  } catch (err) {
    console.error("Error al eliminar producto:", err.message);

    if (err.message.includes("FOREIGN KEY") || err.message.includes("FK_") || err.number === 547) {
      return res.status(409).json({
        ok: false,
        message: "No se puede eliminar el producto porque tiene registros relacionados en otras tablas",
      });
    }

    res.status(500).json({ ok: false, message: "Error al eliminar el producto" });
  }
};

module.exports = { getProductos, getProductoById, createProducto, updateProducto, deleteProducto };
