"use client";
import { useState } from "react";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { aplicacionFirebase } from "@/services/firebaseClient";
import { obtenerSesionValida } from "@/services/authService";

export default function FavoritoProducto({ codigo }: { codigo: string }) {
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function guardar() {
    const app = aplicacionFirebase(),
      auth = getAuth(app);
    await auth.authStateReady();
    const uid = auth.currentUser?.uid;
    if (!uid || obtenerSesionValida()?.usuario.uid !== uid)
      throw new Error("Inicia sesión para guardar favoritos.");
    const db = getFirestore(app);
    const resultado = await getDocs(
      query(
        collection(db, "products"),
        where("codigo", "==", codigo),
        limit(2),
      ),
    );
    if (resultado.size !== 1)
      throw new Error(
        "Este producto requiere conciliación con el catálogo móvil.",
      );
    const producto = resultado.docs[0],
      datos = producto.data();
    const ref = doc(db, "favorites", uid + "_" + producto.id);
    const previos = await getDocs(
      query(
        collection(db, "favorites"),
        where("uid", "==", uid),
        where("producto_id", "==", producto.id),
        limit(1),
      ),
    );
    if (!previos.empty) {
      setMensaje("Ya está en tus favoritos.");
      return;
    }
    await setDoc(ref, {
      uid,
      producto_id: producto.id,
      nombre: datos.nombre,
      precio: datos.precio,
      imagen_url: datos.imagen_url ?? null,
      stock_actual: datos.stock_actual,
      stock_minimo: datos.stock_minimo,
      categoria: datos.categoria ?? "",
      creado_en: serverTimestamp(),
    });
    await addDoc(collection(db, "activity_history"), {
      uid,
      tipo: "favorito_agregado",
      descripcion: "Favorito agregado: " + datos.nombre,
      fecha: serverTimestamp(),
    });
    setMensaje("Guardado en favoritos.");
  }
  return (
    <div>
      <button
        type="button"
        disabled={ocupado}
        className="text-sm underline"
        onClick={async () => {
          setOcupado(true);
          try {
            await guardar();
          } catch (e) {
            setMensaje(e instanceof Error ? e.message : "No se pudo guardar.");
          } finally {
            setOcupado(false);
          }
        }}
      >
        Guardar favorito
      </button>
      <p role="status" className="text-sm">
        {mensaje}
      </p>
    </div>
  );
}
