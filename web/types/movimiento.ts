export interface MovimientoInventario {
  id_movimiento: number;
  id_producto: number;
  producto: string;
  codigo_producto: string;
  tipo_movimiento: "entrada" | "salida";
  cantidad: number;
  motivo: string | null;
  fecha_movimiento: string;
  id_usuario: number;
  usuario: string;
}

export interface MovimientosResponse {
  ok: boolean;
  data: MovimientoInventario[];
}
