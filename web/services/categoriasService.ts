import type {
  Categoria,
  CategoriaPayload,
  CategoriaResponse,
} from "@/types/categoria";

import { obtenerToken } from "@/services/authService";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function obtenerCategorias(): Promise<Categoria[]> {
  const response = await fetch(`${API_URL}/categorias`);

  if (!response.ok) {
    throw new Error("No se pudieron obtener las categorías");
  }

  return response.json();
}

export async function obtenerCategoriaPorId(id: number): Promise<Categoria> {
  const response = await fetch(`${API_URL}/categorias/${id}`);

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(resultado.message || "No se pudo obtener la categoría");
  }

  return resultado;
}

export async function crearCategoria(
  categoria: CategoriaPayload
): Promise<Categoria> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(`${API_URL}/categorias`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(categoria),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(resultado.message || "No se pudo registrar la categoría");
  }

  const respuesta: CategoriaResponse = resultado;

  return respuesta.data;
}

export async function actualizarCategoria(
  id: number,
  categoria: CategoriaPayload
): Promise<Categoria> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(`${API_URL}/categorias/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(categoria),
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(resultado.message || "No se pudo actualizar la categoría");
  }

  const respuesta: CategoriaResponse = resultado;

  return respuesta.data;
}

export async function eliminarCategoria(id: number): Promise<string> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await fetch(`${API_URL}/categorias/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(resultado.message || "No se pudo eliminar la categoría");
  }

  return resultado.message;
}
