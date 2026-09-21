export interface Producto {
  id_producto: number;
  nombre: string;
  descripcion: string | null;
  codigo: string;
  precio: number;
  imagen_url: string | null;
  stock_actual: number;
  stock_minimo: number;
  id_categoria: number;
  estado: boolean;
  fecha_creacion: string;
}

export interface CrearProductoData {
  nombre: string;
  descripcion: string;
  codigo: string;
  precio: number;
  imagen_url: string | null;
  stock_actual: number;
  stock_minimo: number;
  id_categoria: number;
  estado: boolean;
}

export interface ProductoResponse {
  ok: boolean;
  message: string;
  data: Producto;
}