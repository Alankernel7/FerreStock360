import { obtenerToken } from "@/services/authService";
import type { CarritoItem, Pedido } from "@/types/compra";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function solicitud<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = obtenerToken();
  if (!token) throw new Error("Inicia sesión para continuar con tu compra.");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...opciones.headers,
      },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }

  const texto = await response.text();
  let resultado: { data?: T; message?: string; diagnostico?: { code: string | null; number: number | null; original: string } } = {};
  try {
    resultado = texto ? JSON.parse(texto) as { data?: T; message?: string; diagnostico?: { code: string | null; number: number | null; original: string } } : {};
  } catch {
    // Algunos errores de proxy o del servidor llegan como HTML en vez de JSON.
  }

  if (!response.ok) {
    if (resultado.message) {
      const diagnostico = process.env.NODE_ENV !== "production" && resultado.diagnostico
        ? ` [SQL ${resultado.diagnostico.number ?? resultado.diagnostico.code ?? "error"}: ${resultado.diagnostico.original}]`
        : "";
      throw new Error(`${resultado.message}${diagnostico}`);
    }
    if (response.status === 401) throw new Error("Tu sesión venció. Inicia sesión nuevamente.");
    if (response.status === 409) throw new Error("El inventario cambió. Actualiza el carrito e inténtalo de nuevo.");
    if (response.status >= 500) throw new Error("El servidor no pudo actualizar el carrito. Inténtalo nuevamente en unos momentos.");
    throw new Error("No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.");
  }
  if (!Object.prototype.hasOwnProperty.call(resultado, "data")) {
    throw new Error("El servidor respondió de forma inesperada. Actualiza la página e inténtalo de nuevo.");
  }
  return resultado.data as T;
}

export const obtenerCarrito = () => solicitud<CarritoItem[]>("/carrito");
export const guardarItemCarrito = (id_producto: number, cantidad: number) =>
  solicitud<CarritoItem[]>("/carrito/items", { method: "POST", body: JSON.stringify({ id_producto, cantidad }) });
export const eliminarItemCarrito = (id: number) => solicitud<CarritoItem[]>(`/carrito/items/${id}`, { method: "DELETE" });
export const vaciarCarritoRemoto = () => solicitud<CarritoItem[]>("/carrito", { method: "DELETE" });
export const finalizarCompra = (datos: { metodo: "efectivo" | "tarjeta"; fecha_retiro: string; clave_idempotencia: string; tarjeta?: { numero: string; vencimiento: string; cvv: string } }) =>
  solicitud<Pedido>("/carrito/checkout", { method: "POST", body: JSON.stringify(datos) });
export const obtenerPedido = (id: number) => solicitud<Pedido>(`/pedidos/${id}`);
export const obtenerFechasRetiro = () => solicitud<string[]>("/pedidos/fechas-retiro");

export interface PedidoResumen {
  id_pedido: number;
  codigo_pedido: string;
  fecha_pedido: string;
  fecha_retiro: string;
  total: number;
  metodo_pago: "efectivo" | "tarjeta";
  estado_pedido: "pendiente" | "pagado" | "cancelado";
  estado_pago: "pendiente" | "pagado" | "cancelado";
  detalles?: Array<{ id_producto: number; nombre: string; cantidad: number; subtotal: number }>;
  nombre_cliente?: string;
  email_cliente?: string;
}

export interface PedidoAdmin extends Pedido {
  nombre_cliente: string;
  email_cliente: string;
  fecha_retiro: string;
  fecha_entrega?: string | null;
  motivo_cancelacion?: string | null;
  historial?: Array<{ id_historial: number; estado_anterior: string | null; estado_nuevo: string; estado_pago_anterior: string | null; estado_pago_nuevo: string; motivo: string | null; fecha_cambio: string; usuario: string }>;
}

export interface PedidosAdminResponse {
  pedidos: PedidoResumen[];
  indicadores: { total_pedidos: number; pendientes: number; pagados: number; cancelados: number };
}

export const obtenerMisPedidos = (estado = "todos") => solicitud<PedidoResumen[]>(`/mis-pedidos?estado=${encodeURIComponent(estado)}`);
export const listarPedidosAdmin = (params: URLSearchParams) => solicitud<PedidosAdminResponse>(`/admin/pedidos?${params.toString()}`);
export const obtenerPedidoAdmin = (id: number) => solicitud<PedidoAdmin>(`/admin/pedidos/${id}`);
export const actualizarPedidoAdmin = (id: number, accion: "marcar_pendiente" | "confirmar_pago" | "entregar" | "cancelar", motivo?: string) =>
  solicitud<PedidoAdmin>(`/admin/pedidos/${id}`, { method: "PATCH", body: JSON.stringify({ accion, motivo }) });
