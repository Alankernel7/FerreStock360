"use client";
import { useEffect, useState } from "react";
import { getAuth, updateProfile } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { aplicacionFirebase } from "@/services/firebaseClient";

interface Fila {
  id: string;
  texto: string;
  fecha: number;
}

export default function PerfilFirebase({
  uid,
  nombreInicial,
  onNombre,
}: {
  uid: string;
  nombreInicial: string;
  onNombre: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [favoritos, setFavoritos] = useState<Fila[]>([]);
  const [historial, setHistorial] = useState<Fila[]>([]);
  const [mensaje, setMensaje] = useState("");
  useEffect(() => {
    const db = getFirestore(aplicacionFirebase());
    const escuchar = (
      coleccion: string,
      campo: string,
      set: (filas: Fila[]) => void,
    ) =>
      onSnapshot(
        query(collection(db, coleccion), where("uid", "==", uid)),
        (snapshot) => {
          set(
            snapshot.docs
              .map((d) => ({
                id: d.id,
                texto: String(d.get(campo) ?? ""),
                fecha: d.get("fecha")?.toMillis?.() ?? 0,
              }))
              .sort((a, b) => b.fecha - a.fecha),
          );
        },
        () => setMensaje("No se pudieron leer los datos de la cuenta."),
      );
    const detenerFav = escuchar("favorites", "nombre", setFavoritos);
    const detenerHist = escuchar(
      "activity_history",
      "descripcion",
      setHistorial,
    );
    return () => {
      detenerFav();
      detenerHist();
    };
  }, [uid]);
  async function guardar() {
    const nuevo = nombre.trim();
    if (!nuevo || nuevo.length > 100)
      return setMensaje("Escribe un nombre de hasta 100 caracteres.");
    const app = aplicacionFirebase(),
      auth = getAuth(app),
      db = getFirestore(app);
    await auth.authStateReady();
    if (auth.currentUser?.uid !== uid)
      throw new Error("Vuelve a iniciar sesión.");
    await updateDoc(doc(db, "users", uid), {
      nombre: nuevo,
      actualizado_en: serverTimestamp(),
    });
    await updateProfile(auth.currentUser, { displayName: nuevo });
    onNombre(nuevo);
    await addDoc(collection(db, "activity_history"), {
      uid,
      tipo: "perfil_actualizado",
      descripcion: "Nombre actualizado desde la web.",
      fecha: serverTimestamp(),
    });
    setMensaje("Perfil actualizado.");
  }
  return (
    <section className="mt-6 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guardar().catch(() =>
            setMensaje("No se pudo completar la actualización."),
          );
        }}
      >
        <label className="block">
          Nombre{" "}
          <input
            className="rounded border p-2"
            value={nombre}
            maxLength={100}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <button className="mt-2 rounded border px-3 py-2">
          Guardar nombre
        </button>
      </form>
      <h2 className="font-semibold">Favoritos</h2>
      {favoritos.length === 0 && <p>Sin favoritos.</p>}
      {favoritos.map((f) => (
        <div key={f.id} className="flex justify-between">
          <span>{f.texto}</span>
          <button
            onClick={() =>
              void deleteDoc(
                doc(getFirestore(aplicacionFirebase()), "favorites", f.id),
              ).catch(() => setMensaje("No se pudo quitar el favorito."))
            }
          >
            Quitar
          </button>
        </div>
      ))}
      <h2 className="font-semibold">Historial de actividad</h2>
      {historial.length === 0 && <p>Sin actividad registrada.</p>}
      {historial.map((h) => (
        <p key={h.id}>
          {h.fecha ? new Date(h.fecha).toLocaleString("es-SV") + " · " : ""}
          {h.texto}
        </p>
      ))}
      <p role="status">{mensaje}</p>
    </section>
  );
}
