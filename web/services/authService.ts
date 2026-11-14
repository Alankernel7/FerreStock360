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

export async function registrarUsuario(
  nombre: string,
  email: string,
  password: string
): Promise<void> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombre,
      email,
      password,
    }),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo crear la cuenta"
    );
  }
}

export function cerrarSesion(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("auth_token");
  localStorage.removeItem("usuario");

  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("usuario");
}

// Decodifica la fecha de expiración (exp) del JWT sin verificar la firma.
// Devuelve true si el token está vencido o no se puede leer.
export function tokenExpirado(token: string): boolean {
  try {
    const parte = token.split(".")[1];
    if (!parte) {
      return true;
    }

    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { exp?: number };

    if (typeof payload.exp !== "number") {
      return false;
    }

    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

// Devuelve la sesión (usuario + token) solo si el token sigue vigente.
// Si el token ya venció, limpia el almacenamiento y devuelve null para
// que la interfaz no quede en un estado autenticado incorrecto.
export function obtenerSesionValida(): {
  usuario: UsuarioAutenticado;
  token: string;
} | null {
  const token = obtenerToken();
  const usuario = obtenerUsuarioGuardado();

  if (!token || !usuario) {
    return null;
  }

  if (tokenExpirado(token)) {
    cerrarSesion();
    return null;
  }

  return { usuario, token };
}