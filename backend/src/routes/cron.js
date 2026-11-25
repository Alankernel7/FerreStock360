const crypto = require("node:crypto");
const express = require("express");
const { limpiarReservasVencidas } = require("../services/reservasService");
const { vencerReservasEfectivo } = require("../services/pedidosFirestoreService");

const router = express.Router();

router.get("/cron/reservas", async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return res.status(503).json({ ok: false, message: "CRON_SECRET no está configurado" });
  const recibido = String(req.headers.authorization || "");
  const esperado = `Bearer ${secreto}`;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, message: "No autorizado" });
  }

  try {
    const reservas = await limpiarReservasVencidas();
    const pedidos = await vencerReservasEfectivo();
    return res.json({ ok: true, data: { reservas, pedidos } });
  } catch (error) {
    console.error("Error al expirar reservas:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudieron procesar las expiraciones" });
  }
});

module.exports = router;
