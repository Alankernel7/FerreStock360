// Servicio de productos.
// Consulta, registra, actualiza y elimina productos en SQL Server.

const { getPool, sql } = require("../config/database");
const { limpiarReservasVencidas } = require("./reservasService");

// Consulta los productos.
// Con soloActivos = true devuelve únicamente los productos activos (estado = 1),
// ordenados del más reciente al más antiguo según fecha_creacion.
// Sin ese flag devuelve todos (uso administrativo: activos e inactivos).
const obtenerProductos = async ({ soloActivos = false } = {}) => {
  const pool = await getPool();
  await limpiarReservasVencidas(pool);
  const consulta = `SELECT p.*,
      CASE WHEN p.stock_actual > COALESCE(r.unidades_reservadas, 0)
           THEN p.stock_actual - COALESCE(r.unidades_reservadas, 0) ELSE 0 END AS stock_disponible
    FROM dbo.productos p
    OUTER APPLY (
      SELECT SUM(ri.cantidad) AS unidades_reservadas
      FROM dbo.reservas_inventario ri
      WHERE ri.id_producto = p.id_producto AND (
        (ri.estado = N'activa' AND ri.fecha_expiracion > SYSUTCDATETIME()) OR ri.estado = N'confirmada'
      )
    ) r${soloActivos ? " WHERE p.estado = 1" : ""}
    ${soloActivos ? "ORDER BY p.fecha_creacion DESC" : ""}`;
  const result = await pool.request().query(consulta);
  return result.recordset;
};

// Consulta un producto por ID
const obtenerProductoPorId = async (id) => {
  const pool = await getPool();
  await limpiarReservasVencidas(pool);
  const result = await pool
    .request()
    .input("id_producto", sql.Int, id)
    .query(`SELECT p.*,
      CASE WHEN p.stock_actual > COALESCE(r.unidades_reservadas, 0)
           THEN p.stock_actual - COALESCE(r.unidades_reservadas, 0) ELSE 0 END AS stock_disponible
      FROM dbo.productos p
      OUTER APPLY (
        SELECT SUM(ri.cantidad) AS unidades_reservadas
        FROM dbo.reservas_inventario ri
        WHERE ri.id_producto = p.id_producto AND (
          (ri.estado = N'activa' AND ri.fecha_expiracion > SYSUTCDATETIME()) OR ri.estado = N'confirmada'
        )
      ) r
      WHERE p.id_producto = @id_producto`);
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

// Comprueba si una ruta de imagen sigue referenciada por algún producto.
// Se consulta siempre después de guardar los cambios en SQL Server para no
// eliminar un archivo que otro registro todavía utiliza.
const estaImagenEnUso = async (ruta) => {
  if (!ruta) return false;

  const pool = await getPool();
  const result = await pool
    .request()
    .input("ruta", sql.NVarChar(500), ruta)
    .query(`
      select count(*) as total
      from productos
      where imagen_1 = @ruta or imagen_2 = @ruta
    `);
  return result.recordset[0].total > 0;
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
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await limpiarReservasVencidas(tx);
    const producto = await new sql.Request(tx).input("id_producto", sql.Int, id)
      .query("SELECT id_producto FROM dbo.productos WITH (UPDLOCK, HOLDLOCK) WHERE id_producto = @id_producto");
    if (!producto.recordset.length) {
      const error = new Error("El producto no existe"); error.status = 404; throw error;
    }
    const reservas = await new sql.Request(tx).input("id_producto", sql.Int, id).query(`
      SELECT COALESCE(SUM(cantidad), 0) AS total
      FROM dbo.reservas_inventario WITH (UPDLOCK, HOLDLOCK)
      WHERE id_producto = @id_producto AND (
        (estado = N'activa' AND fecha_expiracion > SYSUTCDATETIME()) OR estado = N'confirmada'
      )
    `);
    if (datos.stock_actual < reservas.recordset[0].total) {
      const error = new Error(`El stock físico no puede quedar por debajo de las ${reservas.recordset[0].total} unidades reservadas`);
      error.status = 409; throw error;
    }
    const result = await new sql.Request(tx)
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
    await tx.commit();
    return result.recordset[0];
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
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
  estaImagenEnUso,
  existeProductoPorCodigo,
  existeCategoriaPorId,
  contarMovimientosPorProducto,
  contarAlertasPorProducto,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};
