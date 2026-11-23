const express = require("express");

const {
  getEstadisticasPublicas,
} = require("../controllers/estadisticasPublicasController");

const router = express.Router();

router.get(
  "/estadisticas-publicas",
  getEstadisticasPublicas
);

module.exports = router;