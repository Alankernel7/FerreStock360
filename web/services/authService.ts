import { accesoFirebase, firebaseDisponible, registroFirebase, salirFirebase } from "./firebaseClient";
import type { LoginResponse, UsuarioAutenticado } from "@/types/auth";

export async function iniciarSesion(email: string, password: string): Promise<LoginResponse["data"]> {
  return accesoFirebase(email, password, true);
}

export function obtenerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
}

export function obtenerUsuarioGuardado(): UsuarioAutenticado | null {
  if (typeof window === "undefined") return null;
  const usuario = localStorage.getItem("usuario") || sessionStorage.getItem("usuario");
  if (!usuario) return null;
  try { return JSON.parse(usuario) as UsuarioAutenticado; } catch { return null; }
}

export async function registrarUsuario(nombre: string, email: string, password: string): Promise<void> {
  if (!firebaseDisponible) throw new Error("Configura Firebase Authentication para esta web.");
  await registroFirebase(nombre, email, password);
}

export function cerrarSesion(): void {
  if (typeof window === "undefined") return;
  if (firebaseDisponible) void salirFirebase().catch(console.error);
  localStorage.removeItem("auth_token");
  localStorage.removeItem("usuario");
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("usuario");
}

export function tokenExpirado(token: string): boolean {
  try {
    const parte = token.split(".")[1];
    if (!parte) return true;
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch { return true; }
}

export function obtenerSesionValida(): { usuario: UsuarioAutenticado; token: string } | null {
  const token = obtenerToken();
  const usuario = obtenerUsuarioGuardado();
  if (!token || !usuario) return null;
  if (tokenExpirado(token)) { cerrarSesion(); return null; }
  return { usuario, token };
}
