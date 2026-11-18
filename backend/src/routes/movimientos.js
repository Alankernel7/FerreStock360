const express = require("express");
const { getMovimientos } = require("../controllers/movimientosController");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/movimientos", verificarToken, soloAdminActivo, getMovimientos);

module.exports = router;
