export type TipoNotificacion =
  | "stock_bajo"
  | "producto_agotado"
  | "entrada_inventario"
  | "salida_inventario"
  | "pedido_pendiente"
  | "pedido_pagado"
  | "pedido_cancelado";

export interface Notificacion {
  id_notificacion: number;
  tipo: TipoNotificacion;
  titulo: string;
  descripcion: string;
  id_producto: number | null;
  producto: string | null;
  id_movimiento: number | null;
  id_pedido?: number | null;
  leida: boolean;
  fecha_creacion: string;
  estado_stock: "activa" | "resuelta" | null;
}

export interface NotificacionesData {
  notificaciones: Notificacion[];
  no_leidas: number;
}
