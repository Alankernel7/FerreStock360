// Controlador del dashboard.
// Solicita los datos al servicio y devuelve la respuesta HTTP.

const { obtenerDashboard } = require("../services/dashboardService");

// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const dashboard = await obtenerDashboard();

    res.json({
      ok: true,
      data: dashboard,
    });
  } catch (err) {
    console.error("Error al obtener dashboard:", err.message);

    res.status(500).json({
      ok: false,
      message: "Error al consultar los datos del dashboard",
    });
  }
};

module.exports = { getDashboard };