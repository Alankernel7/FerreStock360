import type {
  Producto,
  CrearProductoData,
  ActualizarProductoData,
  ProductoResponse,
} from "@/types/producto";

import { obtenerToken } from "@/services/authService";

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

export async function obtenerProductoPorId(
  id: number
): Promise<Producto> {
  const response = await fetch(`${API_URL}/productos/${id}`);

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo obtener el producto"
    );
  }

  return resultado;
}

export async function crearProducto(
  producto: CrearProductoData
): Promise<Producto> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }
    const response = await fetch(`${API_URL}/productos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(producto),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo registrar el producto"
    );
  }

  const respuesta: ProductoResponse = resultado;

  return respuesta.data;
}

export async function actualizarProducto(
  id: number,
  producto: ActualizarProductoData
): Promise<Producto> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }
  const response = await fetch(`${API_URL}/productos/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(producto),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo actualizar el producto"
    );
  }

  const respuesta: ProductoResponse = resultado;

  return respuesta.data;
}

export async function eliminarProducto(id: number): Promise<string> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }
  const response = await fetch(`${API_URL}/productos/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo eliminar el producto"
    );
  }

  return resultado.message;
}