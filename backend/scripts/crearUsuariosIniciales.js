require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sql, getPool } = require("../src/config/database");

const crearUsuariosIniciales = async () => {
  try {
    const pool = await getPool();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    const empleadoEmail = process.env.EMPLEADO_EMAIL;
    const empleadoPassword = process.env.EMPLEADO_PASSWORD;

    if (
      !adminEmail ||
      !adminPassword ||
      !empleadoEmail ||
      !empleadoPassword
    ) {
      throw new Error(
        "Faltan variables de entorno para crear los usuarios iniciales"
      );
    }

    const adminHash = await bcrypt.hash(adminPassword, 12);
    const empleadoHash = await bcrypt.hash(empleadoPassword, 12);

    const rolAdmin = await pool
      .request()
      .input("nombre", sql.NVarChar(50), "admin")
      .query(`
        SELECT id_rol
        FROM roles
        WHERE nombre = @nombre
      `);

    const rolEmpleado = await pool
      .request()
      .input("nombre", sql.NVarChar(50), "empleado")
      .query(`
        SELECT id_rol
        FROM roles
        WHERE nombre = @nombre
      `);

    if (
      rolAdmin.recordset.length === 0 ||
      rolEmpleado.recordset.length === 0
    ) {
      throw new Error(
        "Los roles admin y empleado deben existir antes de crear usuarios"
      );
    }

    const idRolAdmin = rolAdmin.recordset[0].id_rol;
    const idRolEmpleado = rolEmpleado.recordset[0].id_rol;

    await pool
      .request()
      .input("nombre", sql.NVarChar(100), "Administrador")
      .input("email", sql.NVarChar(150), adminEmail)
      .input("password", sql.NVarChar(255), adminHash)
      .input("id_rol", sql.Int, idRolAdmin)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM usuarios
          WHERE email = @email
        )
        BEGIN
          INSERT INTO usuarios (
            nombre,
            email,
            password,
            id_rol,
            estado
          )
          VALUES (
            @nombre,
            @email,
            @password,
            @id_rol,
            1
          )
        END
      `);

    await pool
      .request()
      .input("nombre", sql.NVarChar(100), "Empleado")
      .input("email", sql.NVarChar(150), empleadoEmail)
      .input("password", sql.NVarChar(255), empleadoHash)
      .input("id_rol", sql.Int, idRolEmpleado)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM usuarios
          WHERE email = @email
        )
        BEGIN
          INSERT INTO usuarios (
            nombre,
            email,
            password,
            id_rol,
            estado
          )
          VALUES (
            @nombre,
            @email,
            @password,
            @id_rol,
            1
          )
        END
      `);

    console.log("Usuarios iniciales creados correctamente.");

    process.exit(0);
  } catch (error) {
    console.error(
      "Error al crear usuarios iniciales:",
      error.message
    );

    process.exit(1);
  }
};

crearUsuariosIniciales();