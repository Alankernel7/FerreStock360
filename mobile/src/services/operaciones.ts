import Constants from "expo-constants";
import { DeviceEventEmitter } from "react-native";
import { authFirebase } from "../config/firebase";

const host = Constants.expoConfig?.hostUri?.split(":")[0];
const url = (
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ && host ? "http://" + host + ":3001/api" : undefined)
)?.replace(/\/$/, "");
export const apiConfigurada = Boolean(url);
export const apiBaseUrl = url;

async function respuesta<T>(
  path: string,
  token: string,
  method = "GET",
  body?: object,
): Promise<T> {
  const res = await fetch(url + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.message || "La operación no se pudo completar.");
  return (Array.isArray(data) ? data : data.data) as T;
}

export async function sesionOperativa() {
  const user = authFirebase?.currentUser;
  if (!user || !url)
    throw new Error(
      "Inicia sesión y configura EXPO_PUBLIC_API_URL para acceder a tus compras.",
    );
  const sesion = await respuesta<{ token: string }>(
    "/auth/firebase",
    await user.getIdToken(),
    "POST",
  );
  return sesion.token;
}

export interface Item {
  id_producto: number;
  cantidad: number;
  nombre: string;
  codigo?: string;
  precio: number;
  imagen?: string | null;
  stock_actual?: number;
  stock_disponible?: number;
  maximo_carrito?: number;
  estado?: boolean;
  estado_reserva?: string;
  fecha_expiracion?: string | null;
}
export interface Pedido {
  id_pedido: number;
  codigo_pedido: string;
  subtotal?: number;
  total: number;
  estado_pedido: string;
  estado_pago?: string;
  metodo_pago?: "efectivo" | "tarjeta";
  fecha_pedido?: string;
  fecha_retiro: string;
  fecha_entrega?: string | null;
  detalles?: Array<{ id_producto: number; nombre: string; cantidad: number; subtotal: number; imagen?: string | null }>;
  aprobado?: boolean;
  mensaje?: string;
}
export interface Aviso {
  id_notificacion: number;
  titulo: string;
  descripcion: string;
}

export async function cargarCompras() {
  const token = await sesionOperativa();
  const [items, pedidos, fechas] = await Promise.all([
    respuesta<Item[]>("/carrito", token),
    respuesta<Pedido[]>("/mis-pedidos", token),
    respuesta<string[]>("/pedidos/fechas-retiro", token),
  ]);
  return { items, pedidos, fechas };
}
export async function obtenerCarritoMovil() {
  return respuesta<Item[]>("/carrito", await sesionOperativa());
}
export async function agregarProducto(codigo: string) {
  const token = await sesionOperativa();
  const catalogo = await respuesta<{ id_producto: number; codigo: string }[]>(
    "/productos?estado=activo",
    token,
  );
  const coincidencias = catalogo.filter(
    (p) => p.codigo.trim().toUpperCase() === codigo.trim().toUpperCase(),
  );
  if (!codigo.trim() || coincidencias.length !== 1)
    throw new Error(
      "Este código todavía requiere conciliación con el inventario.",
    );
  const id = coincidencias[0].id_producto;
  const items = await respuesta<Item[]>("/carrito", token);
  const cantidad =
    (items.find((item) => item.id_producto === id)?.cantidad ?? 0) + 1;
  const resultado = await respuesta<Item[]>("/carrito/items", token, "POST", {
    id_producto: id,
    cantidad,
  });
  DeviceEventEmitter.emit("carrito:actualizado");
  return resultado;
}
export async function quitarProducto(id: number) {
  const resultado = await respuesta<Item[]>("/carrito/items/" + id, await sesionOperativa(), "DELETE");
  DeviceEventEmitter.emit("carrito:actualizado");
  return resultado;
}
export async function guardarCantidad(id: number, cantidad: number) {
  const resultado = await respuesta<Item[]>("/carrito/items", await sesionOperativa(), "POST", { id_producto: id, cantidad });
  DeviceEventEmitter.emit("carrito:actualizado");
  return resultado;
}
export async function vaciarCarrito() {
  const resultado = await respuesta<Item[]>("/carrito", await sesionOperativa(), "DELETE");
  DeviceEventEmitter.emit("carrito:actualizado");
  return resultado;
}
export async function obtenerPedido(id: number) {
  return respuesta<Pedido>(`/pedidos/${id}`, await sesionOperativa());
}
export async function confirmarRetiro(
  fecha: string,
  clave: string,
  tarjeta?: { numero: string; vencimiento: string; cvv: string },
) {
  const pedido = await respuesta<Pedido>(
    "/carrito/checkout",
    await sesionOperativa(),
    "POST",
    {
      metodo: tarjeta ? "tarjeta" : "efectivo",
      fecha_retiro: fecha,
      clave_idempotencia: clave,
      tarjeta,
    },
  );
  DeviceEventEmitter.emit("carrito:actualizado");
  return pedido;
}

export interface Articulo {
  id_producto: number;
  nombre: string;
  stock_actual: number;
  stock_disponible: number;
}
export interface Movimiento {
  id_movimiento: number;
  producto: string;
  tipo_movimiento: string;
  cantidad: number;
}
export async function cargarOperacionAdmin() {
  const token = await sesionOperativa();
  const [inventario, pedidos, movimientos, avisos] = await Promise.all([
    respuesta<{ productos: Articulo[] }>("/inventario", token),
    respuesta<{ pedidos: Pedido[] }>("/admin/pedidos", token),
    respuesta<Movimiento[]>("/movimientos", token),
    respuesta<{ notificaciones: Aviso[] }>("/notificaciones", token),
  ]);
  return {
    articulos: inventario.productos,
    pedidos: pedidos.pedidos,
    movimientos,
    avisos: avisos.notificaciones,
  };
}
export async function registrarMovimiento(
  producto: number,
  tipo: "entrada" | "salida",
  cantidad: number,
  motivo: string,
) {
  await respuesta("/inventario/movimientos", await sesionOperativa(), "POST", {
    id_producto: producto,
    tipo_movimiento: tipo,
    cantidad,
    motivo,
  });
}
export async function cambiarPedido(
  id: number,
  accion: string,
  motivo: string,
) {
  await respuesta("/admin/pedidos/" + id, await sesionOperativa(), "PATCH", {
    accion,
    motivo,
  });
}

export async function administrarCatalogo(
  path: string,
  method: string,
  body?: object,
) {
  return respuesta(path, await sesionOperativa(), method, body);
}
export async function catalogoCompartido(admin: boolean) {
  const headers: Record<string, string> = {};
  if (admin) headers.Authorization = "Bearer " + (await sesionOperativa());
  const res = await fetch(
    url + "/productos" + (admin ? "" : "?estado=activo"),
    { headers },
  );
  if (!res.ok) throw new Error("No se pudo leer el inventario compartido.");
  return (await res.json()) as Array<{
    id_producto: number;
    firestore_id: string;
    nombre: string;
    codigo: string;
    precio: number;
    estado: boolean;
    stock_actual: number;
    stock_disponible: number;
    stock_minimo: number;
    disponible?: boolean;
    descripcion: string | null;
    id_categoria: number;
    imagen_1: string | null;
    imagen_2: string | null;
    fecha_creacion: string;
  }>;
}
