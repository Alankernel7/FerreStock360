// Controlador de la ruta /api/health.
// Retorna un JSON indicando que la API está funcionando.

const healthCheck = (req, res) => {
  res.json({
    ok: true,
    message: "API FerreStock 360 funcionando",
  });
};

module.exports = { healthCheck };
