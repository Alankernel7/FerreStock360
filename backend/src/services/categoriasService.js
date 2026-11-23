// Servicio de categorías.
// Consulta, registra, actualiza y elimina categorías en SQL Server.

const { getPool, sql } = require("../config/database");

// Consulta todas las categorías
const obtenerCategorias = async () => {
  const pool = await getPool();
  const result = await pool.request().query("select * from categorias order by nombre");
  return result.recordset;
};

// Consulta una categoría por ID
const obtenerCategoriaPorId = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, id)
    .query("select * from categorias where id_categoria = @id_categoria");
  return result.recordset[0];
};

// Comprueba si ya existe una categoría con ese nombre.
// Al editar se puede excluir la propia categoría para permitir conservar su nombre.
const existeCategoriaPorNombre = async (nombre, excluirId = null) => {
  const pool = await getPool();
  const request = pool.request().input("nombre", sql.NVarChar(100), nombre);

  let consulta = "select id_categoria from categorias where nombre = @nombre";

  if (excluirId) {
    request.input("id_categoria", sql.Int, excluirId);
    consulta += " and id_categoria <> @id_categoria";
  }

  const result = await request.query(consulta);
  return result.recordset.length > 0;
};

// Cuenta los productos asociados a una categoría.
// Se usa para impedir el borrado si compromete la integridad referencial.
const contarProductosPorCategoria = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, id)
    .query("select count(*) as total from productos where id_categoria = @id_categoria");
  return result.recordset[0].total;
};

// Inserta una nueva categoría utilizando parámetros SQL
const crearCategoria = async (datos) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("nombre", sql.NVarChar(100), datos.nombre)
    .input("descripcion", sql.NVarChar(200), datos.descripcion || null)
    .query(`
      insert into categorias (nombre, descripcion)
      output inserted.*
      values (@nombre, @descripcion)
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
      update categorias
      set nombre = @nombre,
          descripcion = @descripcion
      output inserted.*
      where id_categoria = @id_categoria
    `);
  return result.recordset[0];
};

// Elimina una categoría por ID utilizando un parámetro SQL
const eliminarCategoria = async (id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, id)
    .query("delete from categorias where id_categoria = @id_categoria");
  return result.rowsAffected[0];
};

module.exports = {
  obtenerCategorias,
  obtenerCategoriaPorId,
  existeCategoriaPorNombre,
  contarProductosPorCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
};
