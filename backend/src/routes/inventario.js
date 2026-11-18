const express = require("express");
const { getInventario, getCategoriasInventario, postMovimiento } = require("../controllers/inventarioController");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/inventario", verificarToken, soloAdminActivo, getInventario);
router.get("/inventario/categorias", verificarToken, soloAdminActivo, getCategoriasInventario);
router.post("/inventario/movimientos", verificarToken, soloAdminActivo, postMovimiento);
module.exports = router;
