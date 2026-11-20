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
const estadisticasPublicasRoutes = require( "./routes/estadisticasPublicas");
const inventarioRoutes = require("./routes/inventario");
const usuariosRoutes = require("./routes/usuarios");
const movimientosRoutes = require("./routes/movimientos");
const notificacionesRoutes = require("./routes/notificaciones");
const carritoRoutes = require("./routes/carrito");
const pedidosRoutes = require("./routes/pedidos");
const { iniciarLimpiezaPeriodica } = require("./services/reservasService");
const { obtenerConfiguracionServido } = require("./storage/imageStorage");

const app = express();
const PORT = process.env.PORT || 3001;

// Permitir solicitudes desde el frontend
const originsPermitidos = (
  process.env.FRONTEND_URLS ||
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite solicitudes sin Origin como Postman
      // o llamadas servidor a servidor.
      if (!origin) {
        return callback(null, true);
      }

      if (originsPermitidos.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origen no permitido por CORS")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// Middleware para parsear JSON
app.use(express.json());

// Imágenes de productos servidas desde una ruta controlada.
// En producción con almacenamiento persistente (Azure Blob, S3, etc.) el
// proveedor sirve este mismo prefijo y esta ruta deja de usarse.
const configuracionImagenes = obtenerConfiguracionServido();

if (configuracionImagenes) {
  app.use(
    configuracionImagenes.prefijo,
    express.static(configuracionImagenes.directorio, {
      index: false,
      dotfiles: "deny",
      maxAge: "7d",
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    })
  );
}

// Rutas de la API
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

// Ejecuta limpieza de expiraciones incluso si el cliente cerró el navegador.
// El servicio comprueba si la tabla de reservas ya fue instalada.
iniciarLimpiezaPeriodica();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

module.exports = app;
