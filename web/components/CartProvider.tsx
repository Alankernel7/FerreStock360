"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { obtenerToken } from "@/services/authService";
import { eliminarItemCarrito, guardarItemCarrito, obtenerCarrito, vaciarCarritoRemoto } from "@/services/compraService";
import type { CarritoItem } from "@/types/compra";
import type { Producto } from "@/types/producto";

const STORAGE_KEY = "ferrestock_carrito_invitado";
type ItemInvitado = CarritoItem & { cantidad_objetivo_sesion?: number };
type CartContextValue = {
  items: CarritoItem[];
  cantidadArticulos: number;
  subtotal: number;
  listo: boolean;
  errorSincronizacion: string;
  agregar: (producto: Producto, cantidad?: number) => Promise<void>;
  cambiarCantidad: (id: number, cantidad: number) => Promise<void>;
  eliminar: (id: number) => Promise<void>;
  vaciar: () => Promise<void>;
  actualizar: () => Promise<void>;
  compraConfirmada: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);

const desdeProducto = (producto: Producto, cantidad: number): CarritoItem => ({
  id_producto: producto.id_producto, cantidad, nombre: producto.nombre, codigo: producto.codigo,
  precio: Number(producto.precio), stock_actual: 0,
  stock_disponible: 0,
  maximo_carrito: Number.MAX_SAFE_INTEGER,
  estado: producto.estado,
  imagen: producto.imagen_1 || producto.imagen_2 || null,
});
const leerInvitado = (): ItemInvitado[] => {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ItemInvitado[]).map((item) => ({
      ...item,
      stock_fisico: item.stock_fisico ?? item.stock_actual,
      stock_disponible: item.stock_disponible ?? item.stock_actual,
      maximo_carrito: item.maximo_carrito ?? item.stock_actual,
      estado_reserva: item.estado_reserva ?? "sin_reserva",
      fecha_expiracion: item.fecha_expiracion ?? null,
      segundos_restantes: item.segundos_restantes ?? 0,
      duracion_reserva_minutos: item.duracion_reserva_minutos ?? 15,
    }));
  } catch { return []; }
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CarritoItem[]>([]);
  const [listo, setListo] = useState(false);
  const [errorSincronizacion, setErrorSincronizacion] = useState("");
  const agregadosEnCurso = useRef(new Set<number>());
  const generacionSincronizacion = useRef(0);
  const sincronizar = useCallback(async () => {
    if (typeof window === "undefined") return;
    const intento = ++generacionSincronizacion.current;
    const token = obtenerToken();
    if (!token) {
      if (intento !== generacionSincronizacion.current) return;
      setItems(leerInvitado());
      setErrorSincronizacion("");
      setListo(true);
      return;
    }
    try {
      let remoto = await obtenerCarrito();
      if (intento !== generacionSincronizacion.current || obtenerToken() !== token) return;
      const invitados = leerInvitado();
      const pendientes: ItemInvitado[] = [];
      for (const invitado of invitados) {
        if (intento !== generacionSincronizacion.current || obtenerToken() !== token) return;
        const actual = remoto.find((item) => item.id_producto === invitado.id_producto);
        const cantidad = invitado.cantidad_objetivo_sesion ?? (invitado.cantidad + (actual?.cantidad || 0));
        if (actual && actual.cantidad >= cantidad) continue;
        try {
          remoto = await guardarItemCarrito(invitado.id_producto, cantidad);
        } catch {
          // Si se perdió la respuesta tras confirmar SQL, no sumar dos veces
          // al reintentar la sincronización del carrito de invitado.
          try {
            const actualizado = await obtenerCarrito();
            const sincronizado = actualizado.find((item) => item.id_producto === invitado.id_producto);
            if (sincronizado && sincronizado.cantidad >= cantidad) {
              remoto = actualizado;
              continue;
            }
            remoto = actualizado;
          } catch { /* conserva el estado remoto más reciente disponible */ }
          pendientes.push({ ...invitado, cantidad_objetivo_sesion: cantidad });
        }
      }
      if (pendientes.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendientes));
        setErrorSincronizacion("Algunos productos del carrito de invitado no se pudieron reservar. Se conservaron en este navegador; revisa las cantidades e inténtalo de nuevo.");
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setErrorSincronizacion("");
      }
      if (intento !== generacionSincronizacion.current || obtenerToken() !== token) return;
      setItems(remoto);
    } catch (error) {
      if (intento !== generacionSincronizacion.current || obtenerToken() !== token) return;
      setErrorSincronizacion(error instanceof Error ? error.message : "No se pudo cargar el carrito de tu cuenta.");
    } finally {
      if (intento === generacionSincronizacion.current) setListo(true);
    }
  }, []);

  useEffect(() => {
    const handleAuth = () => { void sincronizar(); };
    void Promise.resolve().then(sincronizar);
    window.addEventListener("auth:changed", handleAuth);
    return () => window.removeEventListener("auth:changed", handleAuth);
  }, [sincronizar]);

  const guardarInvitado = (siguiente: CarritoItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(siguiente));
    setItems(siguiente);
  };
  const agregar = async (producto: Producto, cantidad = 1) => {
    if (agregadosEnCurso.current.has(producto.id_producto)) {
      throw new Error("Este producto ya se está agregando; espera a que termine la solicitud.");
    }
    agregadosEnCurso.current.add(producto.id_producto);
    try {
    const actual = items.find((item) => item.id_producto === producto.id_producto);
    const siguiente = (actual?.cantidad || 0) + cantidad;
    if (!producto.estado) throw new Error("Este producto no está disponible.");
    if (!producto.disponible && (producto.stock_disponible ?? producto.stock_actual ?? 0) < 1) {
      throw new Error("Este producto no tiene unidades disponibles.");
    }
    if (obtenerToken()) {
      setItems(await guardarItemCarrito(producto.id_producto, siguiente));
    } else {
      guardarInvitado([...items.filter((item) => item.id_producto !== producto.id_producto), desdeProducto(producto, siguiente)]);
    }
    } finally {
      agregadosEnCurso.current.delete(producto.id_producto);
    }
  };
  const cambiarCantidad = async (id: number, cantidad: number) => {
    const item = items.find((actual) => actual.id_producto === id);
    if (!item || cantidad < 1) return;
    if (cantidad > item.maximo_carrito) throw new Error("La cantidad supera las existencias disponibles.");
    if (obtenerToken()) setItems(await guardarItemCarrito(id, cantidad));
    else guardarInvitado(items.map((actual) => actual.id_producto === id ? { ...actual, cantidad } : actual));
  };
  const eliminar = async (id: number) => {
    if (obtenerToken()) setItems(await eliminarItemCarrito(id));
    else guardarInvitado(items.filter((item) => item.id_producto !== id));
  };
  const vaciar = async () => {
    if (obtenerToken()) setItems(await vaciarCarritoRemoto());
    else guardarInvitado([]);
  };
  const compraConfirmada = () => {
    setItems([]);
    setErrorSincronizacion("");
  };
  const value = { items, listo, errorSincronizacion,
    cantidadArticulos: items.reduce((suma, item) => suma + item.cantidad, 0),
    subtotal: Math.round(items.reduce((suma, item) => suma + item.precio * item.cantidad, 0) * 100) / 100,
    agregar, cambiarCantidad, eliminar, vaciar, actualizar: sincronizar, compraConfirmada,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
