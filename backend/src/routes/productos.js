// Rutas de productos.
// GET    /api/productos      → obtener todos los productos
// POST   /api/productos      → registrar un nuevo producto
// PUT    /api/productos/:id  → actualizar un producto existente
// DELETE /api/productos/:id  → eliminar un producto existente

const express = require("express");
const router = express.Router();
const { getProductos, createProducto, updateProducto, deleteProducto } = require("../controllers/productosController");

router.get("/productos", getProductos);
router.post("/productos", createProducto);
router.put("/productos/:id", updateProducto);
router.delete("/productos/:id", deleteProducto);

module.exports = router;
