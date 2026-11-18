import { obtenerToken } from "@/services/authService";
import type { MovimientoInventario, MovimientosResponse } from "@/types/movimiento";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function consultarMovimientos(params: URLSearchParams): Promise<MovimientoInventario[]> {
  const token = obtenerToken();
  if (!token) throw new Error("Inicia sesión para continuar");
  const query = params.toString();
  const response = await fetch(`${API_URL}/movimientos${query ? `?${query}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "No se pudo consultar el historial");
  return (result as MovimientosResponse).data;
}
