export type TipoNotificacion =
  | "stock_bajo"
  | "producto_agotado"
  | "entrada_inventario"
  | "salida_inventario";

export interface Notificacion {
  id_notificacion: number;
  tipo: TipoNotificacion;
  titulo: string;
  descripcion: string;
  id_producto: number | null;
  producto: string | null;
  id_movimiento: number | null;
  leida: boolean;
  fecha_creacion: string;
  estado_stock: "activa" | "resuelta" | null;
}

export interface NotificacionesData {
  notificaciones: Notificacion[];
  no_leidas: number;
}
