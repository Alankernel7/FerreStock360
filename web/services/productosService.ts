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

// Catálogo público: el backend devuelve únicamente productos activos
// (estado = 1), ordenados del más reciente al más antiguo.
export async function obtenerProductosPublicos(): Promise<Producto[]> {
  const response = await fetch(`${API_URL}/productos?estado=activo`);

  if (!response.ok) {
    throw new Error("No se pudieron obtener los productos");
  }

  const productos: Producto[] = await response.json();

  return productos;
}

export async function obtenerProductoPorId(
  id: number
): Promise<Producto> {
  const token = obtenerToken();

  const response = await fetch(`${API_URL}/productos/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo obtener el producto"
    );
  }

  return resultado;
}

// Detalle público: el backend responde 404 si el producto está inactivo.
export async function obtenerProductoPublicoPorId(
  id: number
): Promise<Producto> {
  const response = await fetch(`${API_URL}/productos/${id}?estado=activo`);

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.message || "No se pudo obtener el producto"
    );
  }

  return resultado;
}

// Construye el cuerpo multipart cuando hay archivos nuevos. Sin archivos se
// conserva el envío JSON original para no alterar el contrato existente.
function construirCuerpoProducto(
  producto: CrearProductoData | ActualizarProductoData
): { body: BodyInit; esMultipart: boolean } {
  const {
    imagen_1_archivo,
    imagen_2_archivo,
    ...campos
  } = producto;

  if (!imagen_1_archivo && !imagen_2_archivo) {
    return { body: JSON.stringify(producto), esMultipart: false };
  }

  const form = new FormData();

  form.append("nombre", campos.nombre);
  form.append("descripcion", campos.descripcion ?? "");
  form.append("codigo", campos.codigo);
  form.append("precio", String(campos.precio));
  form.append("imagen_1", campos.imagen_1 ?? "");
  form.append("imagen_2", campos.imagen_2 ?? "");
  form.append("stock_actual", String(campos.stock_actual));
  form.append("stock_minimo", String(campos.stock_minimo));
  form.append("id_categoria", String(campos.id_categoria));
  form.append("estado", campos.estado ? "true" : "false");

  if (imagen_1_archivo) {
    form.append("imagen_1_file", imagen_1_archivo);
  }

  if (imagen_2_archivo) {
    form.append("imagen_2_file", imagen_2_archivo);
  }

  return { body: form, esMultipart: true };
}

export async function crearProducto(
  producto: CrearProductoData
): Promise<Producto> {
  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const { body, esMultipart } = construirCuerpoProducto(producto);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (!esMultipart) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}/productos`, {
    method: "POST",
    headers,
    body,
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

  const { body, esMultipart } = construirCuerpoProducto(producto);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (!esMultipart) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}/productos/${id}`, {
    method: "PUT",
    headers,
    body,
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