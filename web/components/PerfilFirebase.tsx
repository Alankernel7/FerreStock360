"use client";
import { useCallback, useEffect, useState } from "react";
import { getAuth, updateProfile } from "firebase/auth";
import { aplicacionFirebase } from "@/services/firebaseClient";

interface Fila { id: string; texto: string; fecha: number; }
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function PerfilFirebase({ uid, nombreInicial, onNombre }: {
  uid: string; nombreInicial: string; onNombre: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [historial, setHistorial] = useState<Fila[]>([]);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    const auth = getAuth(aplicacionFirebase());
    const user = auth.currentUser;
    if (!user || user.uid !== uid) return;
    const token = await user.getIdToken();
    const headers = { Authorization: `Bearer ${token}` };
    const historyResponse = await fetch(`${API}/actividad`, { headers });
    if (!historyResponse.ok) throw new Error("No se pudo leer el historial de la cuenta.");
    const historyResult = await historyResponse.json();
    setHistorial((historyResult.data as Array<{ id: string; descripcion: string; fecha?: string }>).map((h) => ({ id: h.id, texto: h.descripcion, fecha: Date.parse(h.fecha || "") || 0 })));
  }, [uid]);

  useEffect(() => {
    let activo = true;
    const refrescar = () => cargar().catch(() => { if (activo) setMensaje("No se pudieron leer los datos de la cuenta."); });
    void refrescar();
    const timer = window.setInterval(refrescar, 15000);
    return () => { activo = false; window.clearInterval(timer); };
  }, [cargar]);

  async function guardar() {
    const nuevo = nombre.trim();
    if (!nuevo || nuevo.length > 100) { setMensaje("Escribe un nombre de hasta 100 caracteres."); return; }
    const auth = getAuth(aplicacionFirebase());
    const user = auth.currentUser;
    if (!user || user.uid !== uid) throw new Error("Vuelve a iniciar sesión.");
    const token = await user.getIdToken();
    const response = await fetch(`${API}/auth/perfil`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevo }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "No se pudo actualizar el perfil.");
    await updateProfile(user, { displayName: nuevo });
    onNombre(nuevo);
    await fetch(`${API}/actividad`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "perfil_actualizado", descripcion: "Nombre actualizado desde la web." }) });
    setMensaje("Perfil actualizado.");
    await cargar();
  }

  return <section className="mt-6 space-y-4">
    <form onSubmit={(e) => { e.preventDefault(); void guardar().catch(() => setMensaje("No se pudo completar la actualización.")); }}>
      <label className="block">Nombre <input className="rounded border p-2" value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} /></label>
      <button className="mt-2 rounded border px-3 py-2">Guardar nombre</button>
    </form>
    <h2 className="font-semibold">Historial de actividad</h2>
    {historial.length === 0 && <p>Sin actividad registrada.</p>}
    {historial.map((h) => <p key={h.id}>{h.fecha ? new Date(h.fecha).toLocaleString("es-SV") + " · " : ""}{h.texto}</p>)}
    <p role="status">{mensaje}</p>
  </section>;
}
