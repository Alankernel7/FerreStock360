export interface EstadisticasPublicas {
  total_productos: number;
  total_categorias: number;
}

export interface EstadisticasPublicasResponse {
  ok: boolean;
  data: EstadisticasPublicas;
}