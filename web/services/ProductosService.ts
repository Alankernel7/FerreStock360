import type { Producto } from "@/types/producto";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function obtenerProductos(): Promise<Producto[]> {
  const response = await fetch(`${API_URL}/productos`);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los productos");
  }

  const productos: Producto[] = await response.json();

  return productos;
}