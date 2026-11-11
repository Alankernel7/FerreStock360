import type {
  DashboardData,
  DashboardResponse,
} from "@/types/dashboard";

import { obtenerToken } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function obtenerDashboard(): Promise<DashboardData> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(`${API_URL}/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("No se pudieron obtener los datos del dashboard");
  }

  const resultado: DashboardResponse = await response.json();

  return resultado.data;
}