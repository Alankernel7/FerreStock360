const express = require("express");
const {
  getNotificaciones,
  patchNotificacionLeida,
  patchTodasLeidas,
} = require("../controllers/notificacionesController");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
router.use("/notificaciones", verificarToken, soloAdminActivo);
router.get("/notificaciones", getNotificaciones);
router.patch("/notificaciones/leidas", patchTodasLeidas);
router.patch("/notificaciones/:id/leida", patchNotificacionLeida);

module.exports = router;
