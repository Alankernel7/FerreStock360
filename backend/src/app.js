// Punto de entrada de la API REST.
// Configura Express, carga variables de entorno y conecta las rutas.

require("dotenv").config();
const express = require("express");
const healthRoutes = require("./routes/health");
const dbTestRoutes = require("./routes/dbTest");
const productosRoutes = require("./routes/productos");
const categoriasRoutes = require("./routes/categorias");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware para parsear JSON
app.use(express.json());

// Rutas de la API
app.use("/api", healthRoutes);
app.use("/api", dbTestRoutes);
app.use("/api", productosRoutes);
app.use("/api", categoriasRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

module.exports = app;
