// Controlador de la ruta /api/db-test.
// Llama al servicio de prueba y devuelve el resultado.

const { testConnection } = require("../services/dbTestService");

const dbTest = async (req, res) => {
  try {
    await testConnection();
    res.json({
      ok: true,
      message: "Conexión con SQL Server exitosa",
    });
  } catch (err) {
    // Log para depuración (no expone credenciales)
    console.error("Error en db-test:", err.message);
    res.status(500).json({
      ok: false,
      message: "Error al conectar con SQL Server",
    });
  }
};

module.exports = { dbTest };
