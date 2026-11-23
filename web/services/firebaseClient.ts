import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import type { LoginResponse } from "@/types/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseDisponible = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
export function aplicacionFirebase() {
  if (!firebaseDisponible) throw new Error("Configura Firebase para esta web.");
  return getApps().length ? getApp() : initializeApp(config);
}
export async function accesoFirebase(
  email: string,
  password: string,
  recordar: boolean,
  google = false,
): Promise<LoginResponse["data"]> {
  const auth = getAuth(aplicacionFirebase());
  await setPersistence(
    auth,
    recordar ? browserLocalPersistence : browserSessionPersistence,
  );
  const { user } = google
    ? await signInWithPopup(auth, new GoogleAuthProvider())
    : await signInWithEmailAndPassword(auth, email, password);
  try {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    const respuesta = await fetch(api + "/auth/firebase", {
      method: "POST",
      headers: { Authorization: "Bearer " + (await user.getIdToken()) },
    });
    const datos = await respuesta.json();
    if (!respuesta.ok)
      throw new Error(
        datos.message || "No se pudo conectar la cuenta con el sistema.",
      );
    return datos.data;
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}
export async function registroFirebase(
  nombre: string,
  email: string,
  password: string,
) {
  const auth = getAuth(aplicacionFirebase());
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(user, { displayName: nombre });
  } finally {
    await signOut(auth);
  }
}
export async function recuperarAcceso(email: string) {
  await sendPasswordResetEmail(getAuth(aplicacionFirebase()), email);
}
export async function salirFirebase() {
  if (firebaseDisponible) await signOut(getAuth(aplicacionFirebase()));
}
