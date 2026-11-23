const express = require("express");
const { getUsuarios, postUsuario, putUsuario, patchEstadoUsuario } = require("../controllers/usuariosController");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
router.use("/usuarios", verificarToken, soloAdminActivo);
router.get("/usuarios", getUsuarios);
router.post("/usuarios", postUsuario);
router.put("/usuarios/:id", putUsuario);
router.patch("/usuarios/:id/estado", patchEstadoUsuario);
module.exports = router;
