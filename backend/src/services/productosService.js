// Servicio de productos.
// Consulta, registra, actualiza y elimina productos en SQL Server.

const { getPool, sql } = require("../config/database");

// Consulta todos los productos
const obtenerProductos = async () => {
  const pool = await getPool();
  const result = await pool.request().query("SELECT * FROM productos");
  return result.recordset;
};

// Consulta un producto por ID
const obtenerProductoPorId = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .query("SELECT * FROM productos WHERE id_producto = @id_producto");
  return result.recordset[0];
};

// Inserta un nuevo producto utilizando parámetros SQL
const crearProducto = async (datos) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("nombre", sql.NVarChar(150), datos.nombre)
    .input("descripcion", sql.NVarChar(500), datos.descripcion || null)
    .input("codigo", sql.NVarChar(50), datos.codigo)
    .input("precio", sql.Decimal(10, 2), datos.precio)
    .input("stock_actual", sql.Int, datos.stock_actual || 0)
    .input("stock_minimo", sql.Int, datos.stock_minimo || 5)
    .input("id_categoria", sql.Int, datos.id_categoria)
    .input("estado", sql.Bit, datos.estado !== undefined ? datos.estado : 1)
    .query(`
      INSERT INTO productos (nombre, descripcion, codigo, precio, stock_actual, stock_minimo, id_categoria, estado)
      OUTPUT INSERTED.*
      VALUES (@nombre, @descripcion, @codigo, @precio, @stock_actual, @stock_minimo, @id_categoria, @estado)
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
    .input("descripcion", sql.NVarChar(500), datos.descripcion || null)
    .input("codigo", sql.NVarChar(50), datos.codigo)
    .input("precio", sql.Decimal(10, 2), datos.precio)
    .input("stock_actual", sql.Int, datos.stock_actual)
    .input("stock_minimo", sql.Int, datos.stock_minimo)
    .input("id_categoria", sql.Int, datos.id_categoria)
    .input("estado", sql.Bit, datos.estado)
    .query(`
      UPDATE productos
      SET nombre = @nombre,
          descripcion = @descripcion,
          codigo = @codigo,
          precio = @precio,
          stock_actual = @stock_actual,
          stock_minimo = @stock_minimo,
          id_categoria = @id_categoria,
          estado = @estado
      OUTPUT INSERTED.*
      WHERE id_producto = @id_producto
    `);
  return result.recordset[0];
};

// Elimina un producto por ID utilizando un parámetro SQL
const eliminarProducto = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .query("DELETE FROM productos WHERE id_producto = @id_producto");
  return result.rowsAffected[0];
};

module.exports = { obtenerProductos, obtenerProductoPorId, crearProducto, actualizarProducto, eliminarProducto };
