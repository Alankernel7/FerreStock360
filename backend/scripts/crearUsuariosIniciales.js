require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sql, getPool } = require("../src/config/database");

const crearAdministradorInicial = async () => {
  let pool;
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error("Faltan ADMIN_EMAIL o ADMIN_PASSWORD para crear el administrador inicial");
    }

    pool = await getPool();
    const rolAdmin = await pool.request()
      .input("nombre", sql.NVarChar(50), "admin")
      .query("SELECT id_rol FROM dbo.roles WHERE nombre=@nombre");

    if (!rolAdmin.recordset[0]) {
      throw new Error("El rol admin debe existir antes de crear la cuenta inicial");
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await pool.request()
      .input("nombre", sql.NVarChar(100), "Administrador")
      .input("email", sql.NVarChar(150), adminEmail.trim().toLowerCase())
      .input("password", sql.NVarChar(255), passwordHash)
      .input("id_rol", sql.Int, rolAdmin.recordset[0].id_rol)
      .query(`IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE email=@email)
        INSERT INTO dbo.usuarios (nombre,email,password,id_rol,estado)
        VALUES (@nombre,@email,@password,@id_rol,1)`);

    console.log("Administrador inicial creado o ya existente.");
  } catch (error) {
    console.error("Error al crear el administrador inicial:", error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};

crearAdministradorInicial();
