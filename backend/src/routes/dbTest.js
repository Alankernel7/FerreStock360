// Ruta de prueba de conexión a la base de datos.
// GET /api/db-test → dbTestController

const express = require("express");
const router = express.Router();
const { dbTest } = require("../controllers/dbTestController");

router.get("/db-test", dbTest);

module.exports = router;
