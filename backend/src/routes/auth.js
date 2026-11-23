const express = require("express");

const { login, register } = require("../controllers/authController");

const router = express.Router();
// El registro público crea clientes; los usuarios administrativos se crean
// desde /usuarios, cuya protección de administrador permanece intacta.
router.post("/auth/register", register);
router.post("/auth/login", login);

module.exports = router;
