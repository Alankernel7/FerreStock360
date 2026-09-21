import type {
  Producto,
  CrearProductoData,
  ProductoResponse,
} from "@/types/producto";

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

export async function crearProducto(
  producto: CrearProductoData
): Promise<Producto> {
  const response = await fetch(`${API_URL}/productos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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