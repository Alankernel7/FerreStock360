
const express = require("express");
const router = express.Router();
const {
  verificarToken,
  soloAdmin,
} = require("../middleware/authMiddleware");

const {
  getDashboard,
} = require("../controllers/dashboardController");

router.get(
  "/dashboard",
  verificarToken,
  soloAdmin,
  getDashboard
);

module.exports = router;