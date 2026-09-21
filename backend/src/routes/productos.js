// Rutas de productos.
// GET    /api/productos      → obtener todos los productos
// GET    /api/productos/:id  → obtener un producto por ID
// POST   /api/productos      → registrar un nuevo producto
// PUT    /api/productos/:id  → actualizar un producto existente
// DELETE /api/productos/:id  → eliminar un producto existente

const express = require("express");
const router = express.Router();
const { getProductos, getProductoById, createProducto, updateProducto, deleteProducto } = require("../controllers/productosController");

router.get("/productos", getProductos);
router.get("/productos/:id", getProductoById);
router.post("/productos", createProducto);
router.put("/productos/:id", updateProducto);
router.delete("/productos/:id", deleteProducto);

module.exports = router;
