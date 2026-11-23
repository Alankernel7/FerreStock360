const express = require("express");
const controller = require("../controllers/pedidosController");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/pedidos/fechas-retiro", controller.fechasRetiro);
router.get("/mis-pedidos", verificarToken, controller.listarMios);
router.get("/pedidos/:id", verificarToken, controller.detalleMio);
router.get("/admin/pedidos", verificarToken, soloAdminActivo, controller.listarAdmin);
router.get("/admin/pedidos/:id", verificarToken, soloAdminActivo, controller.detalleAdmin);
router.patch("/admin/pedidos/:id", verificarToken, soloAdminActivo, controller.cambiarEstado);
module.exports = router;
