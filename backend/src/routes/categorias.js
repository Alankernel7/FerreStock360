// Rutas de categorías.
// GET    /api/categorias      → obtener todas las categorías
// GET    /api/categorias/:id  → obtener una categoría por ID
// POST   /api/categorias      → registrar una nueva categoría
// PUT    /api/categorias/:id  → actualizar una categoría existente
// DELETE /api/categorias/:id  → eliminar una categoría existente

const express = require("express");
const router = express.Router();
const { getCategorias, getCategoriaById, createCategoria, updateCategoria, deleteCategoria } = require("../controllers/categoriasController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

router.get("/categorias", getCategorias);
router.get("/categorias/:id", getCategoriaById);
router.post(
  "/categorias",
  verificarToken,
  soloAdmin,
  createCategoria
);

router.put(
  "/categorias/:id",
  verificarToken,
  soloAdmin,
  updateCategoria
);

router.delete(
  "/categorias/:id",
  verificarToken,
  soloAdmin,
  deleteCategoria
);

module.exports = router;
