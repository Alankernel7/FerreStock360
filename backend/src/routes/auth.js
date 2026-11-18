const express = require("express");

const {
  login,
  register,
} = require("../controllers/authController");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
router.post("/auth/register", verificarToken, soloAdminActivo, register);

router.post("/auth/login", login);

module.exports = router;
