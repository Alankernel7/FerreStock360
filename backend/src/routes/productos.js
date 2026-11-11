// Rutas de productos.
// GET    /api/productos      → obtener todos los productos
// GET    /api/productos/:id  → obtener un producto por ID
// POST   /api/productos      → registrar un nuevo producto
// PUT    /api/productos/:id  → actualizar un producto existente
// DELETE /api/productos/:id  → eliminar un producto existente

// GET productos      → público
// POST producto      → solo admin
// PUT producto       → solo admin
// DELETE producto    → solo admin

const express = require("express");
const router = express.Router();
const { getProductos, getProductoById, createProducto, updateProducto, deleteProducto } = require("../controllers/productosController");
const {verificarToken, soloAdmin } = require("../middleware/authMiddleware");

router.get("/productos", getProductos);
router.get("/productos/:id", getProductoById);

router.post(
  "/productos",
  verificarToken,
  soloAdmin,
  createProducto
);

router.put(
  "/productos/:id",
  verificarToken,
  soloAdmin,
  updateProducto
);

router.delete(
  "/productos/:id",
  verificarToken,
  soloAdmin,
  deleteProducto
);

module.exports = router;
