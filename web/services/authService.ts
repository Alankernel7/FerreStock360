import type { LoginResponse, UsuarioAutenticado } from "@/types/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function iniciarSesion(
  email: string,
  password: string
): Promise<LoginResponse["data"]> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo iniciar sesión"
    );
  }

  const respuesta: LoginResponse = resultado;

  return respuesta.data;
}

export function obtenerToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token")
  );
}

export function obtenerUsuarioGuardado(): UsuarioAutenticado | null {
  if (typeof window === "undefined") {
    return null;
  }

  const usuario =
    localStorage.getItem("usuario") ||
    sessionStorage.getItem("usuario");

  if (!usuario) {
    return null;
  }

  try {
    return JSON.parse(usuario) as UsuarioAutenticado;
  } catch {
    return null;
  }
}