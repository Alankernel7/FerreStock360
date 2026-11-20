const express = require("express");
const controller = require("../controllers/notificacionesController");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/notificaciones", verificarToken, soloAdminActivo, controller.getNotificaciones);
router.patch("/notificaciones/leidas", verificarToken, soloAdminActivo, controller.patchTodasLeidas);
router.patch("/notificaciones/:id/leida", verificarToken, soloAdminActivo, controller.patchNotificacionLeida);
router.get("/mis-notificaciones", verificarToken, controller.getNotificacionesCliente);
router.patch("/mis-notificaciones/leidas", verificarToken, controller.patchTodasNotificacionesClienteLeidas);
router.patch("/mis-notificaciones/:id/leida", verificarToken, controller.patchNotificacionClienteLeida);
module.exports = router;
