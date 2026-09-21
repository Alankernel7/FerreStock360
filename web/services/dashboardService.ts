import type {
  DashboardData,
  DashboardResponse,
} from "@/types/dashboard";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function obtenerDashboard(): Promise<DashboardData> {
  const response = await fetch(`${API_URL}/dashboard`);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los datos del dashboard");
  }

  const resultado: DashboardResponse = await response.json();

  return resultado.data;
}