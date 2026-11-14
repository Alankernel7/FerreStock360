// Servicio de productos.
// Consulta, registra, actualiza y elimina productos en SQL Server.

const { getPool, sql } = require("../config/database");

// Consulta los productos.
// Con soloActivos = true devuelve únicamente los productos activos (estado = 1),
// ordenados del más reciente al más antiguo según fecha_creacion.
// Sin ese flag devuelve todos (uso administrativo: activos e inactivos).
const obtenerProductos = async ({ soloActivos = false } = {}) => {
  const pool = await getPool();
  const consulta = soloActivos
    ? "select * from productos where estado = 1 order by fecha_creacion desc"
    : "select * from productos";
  const result = await pool.request().query(consulta);
  return result.recordset;
};

// Consulta un producto por ID
const obtenerProductoPorId = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .query("select * from productos where id_producto = @id_producto");
  return result.recordset[0];
};

// Comprueba si ya existe un producto con ese código.
// Al editar se puede excluir el propio producto para permitir conservar su código.
const existeProductoPorCodigo = async (codigo, excluirId = null) => {
  const pool = await getPool();
  const request = pool.request().input("codigo", sql.NVarChar(50), codigo);

  let consulta = "select id_producto from productos where codigo = @codigo";

  if (excluirId) {
    request.input("id_producto", sql.Int, excluirId);
    consulta += " and id_producto <> @id_producto";
  }

  const result = await request.query(consulta);
  return result.recordset.length > 0;
};

// Comprueba si existe una categoría válida para la relación del producto.
const existeCategoriaPorId = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, id)
    .query("select id_categoria from categorias where id_categoria = @id_categoria");
  return result.recordset.length > 0;
};

// Cuenta los movimientos de inventario asociados a un producto.
const contarMovimientosPorProducto = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .query("select count(*) as total from movimientos_inventario where id_producto = @id_producto");
  return result.recordset[0].total;
};

// Cuenta las alertas de stock asociadas a un producto.
const contarAlertasPorProducto = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .query("select count(*) as total from alertas_stock where id_producto = @id_producto");
  return result.recordset[0].total;
};

// Inserta un nuevo producto utilizando parámetros SQL
const crearProducto = async (datos) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("nombre", sql.NVarChar(150), datos.nombre)
    .input("descripcion", sql.NVarChar(500), datos.descripcion)
    .input("codigo", sql.NVarChar(50), datos.codigo)
    .input("precio", sql.Decimal(10, 2), datos.precio)
    .input("imagen_1", sql.VarChar(sql.MAX), datos.imagen_1)
    .input("imagen_2", sql.VarChar(sql.MAX), datos.imagen_2)
    .input("stock_actual", sql.Int, datos.stock_actual)
    .input("stock_minimo", sql.Int, datos.stock_minimo)
    .input("id_categoria", sql.Int, datos.id_categoria)
    .input("estado", sql.Bit, datos.estado)
    .query(`
      insert into productos (nombre, descripcion, codigo, precio, imagen_1, imagen_2, stock_actual, stock_minimo, id_categoria, estado)
      output inserted.*
      values (@nombre, @descripcion, @codigo, @precio, @imagen_1, @imagen_2, @stock_actual, @stock_minimo, @id_categoria, @estado)
    `);
  return result.recordset[0];
};

// Actualiza un producto existente utilizando parámetros SQL
const actualizarProducto = async (id, datos) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .input("nombre", sql.NVarChar(150), datos.nombre)
    .input("descripcion", sql.NVarChar(500), datos.descripcion)
    .input("codigo", sql.NVarChar(50), datos.codigo)
    .input("precio", sql.Decimal(10, 2), datos.precio)
    .input("imagen_1", sql.VarChar(sql.MAX), datos.imagen_1)
    .input("imagen_2", sql.VarChar(sql.MAX), datos.imagen_2)
    .input("stock_actual", sql.Int, datos.stock_actual)
    .input("stock_minimo", sql.Int, datos.stock_minimo)
    .input("id_categoria", sql.Int, datos.id_categoria)
    .input("estado", sql.Bit, datos.estado)
    .query(`
      update productos
      set nombre = @nombre,
          descripcion = @descripcion,
          codigo = @codigo,
          precio = @precio,
          imagen_1 = @imagen_1,
          imagen_2 = @imagen_2,
          stock_actual = @stock_actual,
          stock_minimo = @stock_minimo,
          id_categoria = @id_categoria,
          estado = @estado
      output inserted.*
      where id_producto = @id_producto
    `);
  return result.recordset[0];
};

// Elimina un producto por ID utilizando un parámetro SQL
const eliminarProducto = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .query("delete from productos where id_producto = @id_producto");
  return result.rowsAffected[0];
};

module.exports = {
  obtenerProductos,
  obtenerProductoPorId,
  existeProductoPorCodigo,
  existeCategoriaPorId,
  contarMovimientosPorProducto,
  contarAlertasPorProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};
