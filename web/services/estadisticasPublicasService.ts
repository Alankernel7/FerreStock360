import type {
  EstadisticasPublicas,
  EstadisticasPublicasResponse,
} from "@/types/estadisticasPublicas";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001/api";

export async function obtenerEstadisticasPublicas(): Promise<EstadisticasPublicas> {
  const response = await fetch(
    `${API_URL}/estadisticas-publicas`
  );

  if (!response.ok) {
    throw new Error(
      "No se pudieron obtener las estadísticas"
    );
  }

  const resultado: EstadisticasPublicasResponse =
    await response.json();

  return resultado.data;
}