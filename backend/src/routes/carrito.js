const express = require("express");
const { verificarToken } = require("../middleware/authMiddleware");
const controller = require("../controllers/carritoController");

const router = express.Router();
router.use(verificarToken);
router.get("/carrito", controller.getCarrito);
router.post("/carrito/items", controller.postItem);
router.delete("/carrito/items/:id", controller.deleteItem);
router.delete("/carrito", controller.deleteCarrito);
router.post("/carrito/checkout", controller.postCheckout);

module.exports = router;
