// Punto de entrada de la API REST.
// Configura Express, carga variables de entorno y conecta las rutas.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health");
const dbTestRoutes = require("./routes/dbTest");
const productosRoutes = require("./routes/productos");
const categoriasRoutes = require("./routes/categorias");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3001;

// Permitir solicitudes desde el frontend
app.use(cors({
  origin: "http://localhost:3000",
}));

// Middleware para parsear JSON
app.use(express.json());

// Rutas de la API
app.use("/api", healthRoutes);
app.use("/api", dbTestRoutes);
app.use("/api", productosRoutes);
app.use("/api", categoriasRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", authRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

module.exports = app;
