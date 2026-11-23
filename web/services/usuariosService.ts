import { obtenerToken } from "@/services/authService";
import type { UsuarioAdministrable, UsuariosData } from "@/types/usuario";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function solicitud<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const token = obtenerToken();
  if (!token) throw new Error("Inicia sesión para continuar");
  const response = await fetch(`${API_URL}${ruta}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "No se pudo completar la solicitud");
  return result.data as T;
}

export function consultarUsuarios(params: URLSearchParams): Promise<UsuariosData> {
  const query = params.toString();
  return solicitud(`/usuarios${query ? `?${query}` : ""}`);
}

export function guardarUsuario(id: number | null, data: { nombre: string; email: string; password?: string; id_rol: number; estado: boolean }): Promise<UsuarioAdministrable> {
  return solicitud(id ? `/usuarios/${id}` : "/usuarios", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoUsuario(id: number, estado: boolean): Promise<UsuarioAdministrable> {
  return solicitud(`/usuarios/${id}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
}
