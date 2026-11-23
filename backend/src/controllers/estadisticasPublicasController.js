const {
  obtenerEstadisticasPublicas,
} = require("../services/estadisticasPublicasService");

const getEstadisticasPublicas = async (req, res) => {
  try {
    const estadisticas = await obtenerEstadisticasPublicas();

    res.json({
      ok: true,
      data: estadisticas,
    });
  } catch (error) {
    console.error(
      "Error al obtener estadísticas públicas:",
      error.message
    );

    res.status(500).json({
      ok: false,
      message: "Error al obtener estadísticas",
    });
  }
};

module.exports = {
  getEstadisticasPublicas,
};