import { obtenerToken } from "@/services/authService";
import type { NotificacionesData } from "@/types/notificacion";

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

export function consultarNotificaciones(cliente = false): Promise<NotificacionesData> {
  return solicitud(cliente ? "/mis-notificaciones" : "/notificaciones");
}

export function marcarNotificacionLeida(id: number, cliente = false): Promise<void> {
  return solicitud(`${cliente ? "/mis-notificaciones" : "/notificaciones"}/${id}/leida`, { method: "PATCH" });
}

export function marcarTodasNotificacionesLeidas(cliente = false): Promise<void> {
  return solicitud(`${cliente ? "/mis-notificaciones" : "/notificaciones"}/leidas`, { method: "PATCH" });
}
