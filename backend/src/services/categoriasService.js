// Servicio de categorías.
// Consulta, registra, actualiza y elimina categorías en SQL Server.

const { getPool, sql } = require("../config/database");

// Consulta todas las categorías
const obtenerCategorias = async () => {
  const pool = await getPool();
  const result = await pool.request().query("SELECT * FROM categorias");
  return result.recordset;
};

// Consulta una categoría por ID
const obtenerCategoriaPorId = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, id)
    .query("SELECT * FROM categorias WHERE id_categoria = @id_categoria");
  return result.recordset[0];
};

// Inserta una nueva categoría utilizando parámetros SQL
const crearCategoria = async (datos) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("nombre", sql.NVarChar(100), datos.nombre)
    .input("descripcion", sql.NVarChar(200), datos.descripcion || null)
    .query(`
      INSERT INTO categorias (nombre, descripcion)
      OUTPUT INSERTED.*
      VALUES (@nombre, @descripcion)
    `);
  return result.recordset[0];
};

// Actualiza una categoría existente utilizando parámetros SQL
const actualizarCategoria = async (id, datos) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, id)
    .input("nombre", sql.NVarChar(100), datos.nombre)
    .input("descripcion", sql.NVarChar(200), datos.descripcion || null)
    .query(`
      UPDATE categorias
      SET nombre = @nombre,
          descripcion = @descripcion
      OUTPUT INSERTED.*
      WHERE id_categoria = @id_categoria
    `);
  return result.recordset[0];
};

// Elimina una categoría por ID utilizando un parámetro SQL
const eliminarCategoria = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, id)
    .query("DELETE FROM categorias WHERE id_categoria = @id_categoria");
  return result.rowsAffected[0];
};

module.exports = { obtenerCategorias, obtenerCategoriaPorId, crearCategoria, actualizarCategoria, eliminarCategoria };
