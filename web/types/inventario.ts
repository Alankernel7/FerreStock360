export interface ArticuloInventario {
  id_producto: number;
  codigo: string;
  nombre: string;
  imagen_1: string | null;
  imagen_2: string | null;
  stock_actual: number;
  stock_minimo: number;
  id_categoria: number;
  categoria: string;
  estado_inventario: "normal" | "bajo" | "agotado";
}

export interface CategoriaInventario {
  id_categoria: number;
  nombre: string;
}

export interface EstadisticasInventario {
  unidades_disponibles: number;
  total_productos: number;
  con_stock: number;
  stock_bajo: number;
  agotados: number;
}

export interface InventarioData {
  productos: ArticuloInventario[];
  estadisticas: EstadisticasInventario;
}
