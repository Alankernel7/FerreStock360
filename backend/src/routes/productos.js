// Rutas de productos.
// GET    /api/productos               → obtener productos (todos; ?estado=activo → solo activos)
// GET    /api/productos/:id           → obtener un producto por ID
// POST   /api/productos               → registrar un nuevo producto
// PUT    /api/productos/:id           → actualizar un producto existente
// DELETE /api/productos/:id           → eliminar un producto existente

// GET productos      → público
// POST producto      → solo admin
// PUT producto       → solo admin
// DELETE producto    → solo admin

const express = require("express");
const router = express.Router();
const { getProductos, getProductoById, createProducto, updateProducto, deleteProducto } = require("../controllers/productosController");
const {verificarToken, tokenOpcional, soloAdminActivo } = require("../middleware/authMiddleware");
const { subirImagenesProducto } = require("../middleware/subirImagenesProducto");

router.get("/productos", getProductos);
router.get("/productos/:id", tokenOpcional, getProductoById);

router.post(
  "/productos",
  verificarToken,
  soloAdminActivo,
  subirImagenesProducto,
  createProducto
);

router.put(
  "/productos/:id",
  verificarToken,
  soloAdminActivo,
  subirImagenesProducto,
  updateProducto
);

router.delete(
  "/productos/:id",
  verificarToken,
  soloAdminActivo,
  deleteProducto
);

module.exports = router;
