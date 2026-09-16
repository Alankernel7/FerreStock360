// Rutas de categorías.
// GET    /api/categorias      → obtener todas las categorías
// GET    /api/categorias/:id  → obtener una categoría por ID
// POST   /api/categorias      → registrar una nueva categoría
// PUT    /api/categorias/:id  → actualizar una categoría existente
// DELETE /api/categorias/:id  → eliminar una categoría existente

const express = require("express");
const router = express.Router();
const { getCategorias, getCategoriaById, createCategoria, updateCategoria, deleteCategoria } = require("../controllers/categoriasController");

router.get("/categorias", getCategorias);
router.get("/categorias/:id", getCategoriaById);
router.post("/categorias", createCategoria);
router.put("/categorias/:id", updateCategoria);
router.delete("/categorias/:id", deleteCategoria);

module.exports = router;
