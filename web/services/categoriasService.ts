import type { Categoria } from "@/types/categoria";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function obtenerCategorias(): Promise<Categoria[]> {
  const response = await fetch(`${API_URL}/categorias`);

  if (!response.ok) {
    throw new Error("No se pudieron obtener las categorías");
  }

  return response.json();
}