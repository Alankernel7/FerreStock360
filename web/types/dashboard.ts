export interface DashboardResumen {
  total_productos: number;
  total_categorias: number;
  productos_stock_bajo: number;
  total_movimientos: number;
}

export interface ProductoStockBajo {
  id_producto: number;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
}

export interface MovimientoReciente {
  id_movimiento: number;
  producto: string;
  tipo_movimiento: "entrada" | "salida";
  cantidad: number;
  motivo: string | null;
  fecha_movimiento: string;
  usuario: string;
}

export interface DashboardData {
  resumen: DashboardResumen;
  stock_bajo: ProductoStockBajo[];
  movimientos_recientes: MovimientoReciente[];
}

export interface DashboardResponse {
  ok: boolean;
  data: DashboardData;
}