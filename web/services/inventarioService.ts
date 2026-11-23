import { obtenerToken } from "@/services/authService";
import type { CategoriaInventario, InventarioData } from "@/types/inventario";

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

export function consultarInventario(params: URLSearchParams): Promise<InventarioData> {
  const query = params.toString();
  return solicitud(`/inventario${query ? `?${query}` : ""}`);
}

export function consultarCategoriasInventario(): Promise<CategoriaInventario[]> {
  return solicitud("/inventario/categorias");
}

export function crearMovimiento(data: { id_producto: number; tipo_movimiento: "entrada" | "salida"; cantidad: number; motivo: string }) {
  return solicitud<{ stock_actual: number }>("/inventario/movimientos", { method: "POST", body: JSON.stringify(data) });
}
