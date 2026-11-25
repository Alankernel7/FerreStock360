const express = require("express");
const { FieldValue } = require("../config/firebase");
const { db, principal, fallo } = require("../services/firebaseStore");
const { verificarToken } = require("../middleware/authMiddleware");

const router = express.Router();

function vistaUsuario(usuario, perfilCompleto = false) {
  return {
    ...usuario,
    rol: perfilCompleto ? (usuario.rol_perfil || usuario.rol) : (usuario.rol === "admin" ? "admin" : "cliente"),
    estado: usuario.estado === "inactivo" || usuario.estado === false ? "inactivo" : "activo",
  };
}

// Firebase Authentication autentica al cliente; este endpoint valida el ID
// token y crea el perfil inicial bajo control del servidor.
router.post("/auth/firebase", async (req, res, next) => {
  try {
    const usuario = await principal(req, true);
    res.json({
      ok: true,
      data: { usuario: vistaUsuario(usuario), token: req.get("Authorization").slice(7) },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/perfil", verificarToken, (req, res) => {
  res.json({ ok: true, data: vistaUsuario(req.usuario, true) });
});

router.patch("/auth/perfil", verificarToken, async (req, res, next) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    if (!nombre || nombre.length > 100) throw fallo(400, "Nombre inválido.");
    const ref = db().collection("users").doc(req.usuario.uid);
    await ref.set({ nombre, actualizado_en: FieldValue.serverTimestamp() }, { merge: true });
    res.json({ ok: true, data: { ...vistaUsuario(req.usuario, true), nombre } });
  } catch (error) {
    next(error);
  }
});

router.post("/actividad", verificarToken, async (req, res, next) => {
  try {
    const tipo = String(req.body?.tipo || "");
    const descripcion = String(req.body?.descripcion || "").trim();
    if (!tipo || !descripcion || descripcion.length > 500) throw fallo(400, "Actividad inválida.");
    const ref = await db().collection("activity_history").add({
      uid: req.usuario.uid,
      tipo,
      descripcion,
      fecha: FieldValue.serverTimestamp(),
    });
    res.status(201).json({ ok: true, data: { id: ref.id } });
  } catch (error) {
    next(error);
  }
});

router.get("/actividad", verificarToken, async (req, res, next) => {
  try {
    const snap = await db().collection("activity_history").where("uid", "==", req.usuario.uid).get();
    const actividad = snap.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data, fecha: data.fecha?.toDate?.().toISOString() ?? data.fecha ?? null };
    }).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    res.json({ ok: true, data: actividad });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
