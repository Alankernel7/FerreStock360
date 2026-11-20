export interface CarritoItem {
  id_producto: number;
  cantidad: number;
  nombre: string;
  codigo: string;
  precio: number;
  stock_actual: number;
  stock_fisico?: number;
  stock_disponible: number;
  unidades_reservadas?: number;
  maximo_carrito: number;
  estado: boolean;
  imagen: string | null;
  estado_reserva?: "activa" | "liberada" | "vencida" | "consumida" | "sin_reserva";
  fecha_expiracion?: string | null;
  segundos_restantes?: number;
  duracion_reserva_minutos?: number;
}

export interface Pedido {
  id_pedido: number;
  codigo_pedido: string;
  fecha_pedido?: string;
  subtotal: number;
  total: number;
  metodo_pago: "efectivo" | "tarjeta";
  estado_pedido: string;
  estado_pago: string;
  fecha_retiro?: string;
  fecha_entrega?: string | null;
  fecha_cancelacion?: string | null;
  motivo_cancelacion?: string | null;
  nombre_cliente?: string;
  email_cliente?: string;
  referencia_demo?: string | null;
  mensaje?: string;
  aprobado?: boolean;
  detalles?: Array<{
    id_producto: number;
    nombre: string;
    codigo: string;
    precio: number;
    cantidad: number;
    subtotal: number;
    imagen: string | null;
  }>;
  historial?: Array<{ id_historial: number; estado_anterior: string | null; estado_nuevo: string; estado_pago_anterior: string | null; estado_pago_nuevo: string; motivo: string | null; fecha_cambio: string; usuario: string }>;
}
