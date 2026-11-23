"use client";
import { useEffect } from "react";
import { getAuth, onIdTokenChanged } from "firebase/auth";
import {
  aplicacionFirebase,
  firebaseDisponible,
} from "@/services/firebaseClient";

export default function SesionFirebase() {
  useEffect(() => {
    if (
      !firebaseDisponible ||
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED !== "true"
    )
      return;
    const auth = getAuth(aplicacionFirebase());
    return onIdTokenChanged(auth, async (user) => {
      const store = localStorage.getItem("usuario")
        ? localStorage
        : sessionStorage;
      const perfil = store.getItem("usuario");
      if (!perfil) return;
      try {
        const { uid } = JSON.parse(perfil);
        if (!uid) return;
        if (!user || user.uid !== uid) {
          store.removeItem("usuario");
          store.removeItem("auth_token");
          window.dispatchEvent(new Event("auth:changed"));
          return;
        }
        const token = await user.getIdToken();
        if (
          auth.currentUser?.uid === uid &&
          store.getItem("usuario") === perfil
        )
          store.setItem("auth_token", token);
      } catch {
        /* Se vuelve a comprobar el token en cada petición a la API. */
      }
    });
  }, []);
  return null;
}
