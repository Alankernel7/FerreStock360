require("dotenv").config();
const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health");
const dbTestRoutes = require("./routes/dbTest");
const productosRoutes = require("./routes/productos");
const categoriasRoutes = require("./routes/categorias");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/auth");
const estadisticasPublicasRoutes = require("./routes/estadisticasPublicas");
const inventarioRoutes = require("./routes/inventario");
const usuariosRoutes = require("./routes/usuarios");
const movimientosRoutes = require("./routes/movimientos");
const notificacionesRoutes = require("./routes/notificaciones");
const carritoRoutes = require("./routes/carrito");
const pedidosRoutes = require("./routes/pedidos");
const cronRoutes = require("./routes/cron");
const { obtenerConfiguracionServido } = require("./storage/imageStorage");

const app = express();
const PORT = process.env.PORT || 3001;
const originsPermitidos = (process.env.FRONTEND_URLS || "http://localhost:3000")
  .split(",").map((origin) => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || originsPermitidos.includes(origin)) return callback(null, true);
    return callback(new Error("Origen no permitido por CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

const configuracionImagenes = obtenerConfiguracionServido();
if (configuracionImagenes) {
  app.use(configuracionImagenes.prefijo, express.static(configuracionImagenes.directorio, {
    index: false,
    dotfiles: "deny",
    maxAge: "7d",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }));
}

// Un solo montaje de la API Firestore. Los ID tokens Firebase protegen todas
// las rutas privadas; los clientes no acceden directamente a datos de negocio.
app.use("/api", healthRoutes);
app.use("/api", dbTestRoutes);
app.use("/api", productosRoutes);
app.use("/api", categoriasRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", authRoutes);
app.use("/api", estadisticasPublicasRoutes);
app.use("/api", inventarioRoutes);
app.use("/api", usuariosRoutes);
app.use("/api", movimientosRoutes);
app.use("/api", notificacionesRoutes);
app.use("/api", carritoRoutes);
app.use("/api", pedidosRoutes);
app.use("/api", cronRoutes);

if (!process.env.VERCEL) {
  require("./services/reservasService").iniciarLimpiezaPeriodica();
}

app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status : Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status === 500) console.error("API:", error.code || error.name);
  res.status(status).json({
    ok: false,
    message: status === 500 ? "No se pudo completar la operación." : error.message,
  });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor backend corriendo en http://localhost:${PORT}`));
}

module.exports = app;
