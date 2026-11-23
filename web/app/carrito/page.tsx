"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/components/CartProvider";
import { resolverUrlImagen } from "@/lib/imagenes";
import { obtenerToken } from "@/services/authService";

const dinero = (valor: number) => `$${valor.toFixed(2)}`;

export default function CarritoPage() {
  const { items, subtotal, listo, errorSincronizacion, actualizar, cambiarCantidad, eliminar, vaciar } = useCart();
  const [error, setError] = useState("");
  const [ahora, setAhora] = useState(0);
  const [autenticado, setAutenticado] = useState(false);
  useEffect(() => {
    const inicial = window.setTimeout(() => setAhora(Date.now()), 0);
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000);
    const syncAuth = () => setAutenticado(Boolean(obtenerToken()));
    const authInicial = window.setTimeout(syncAuth, 0);
    window.addEventListener("auth:changed", syncAuth);
    return () => { window.clearTimeout(inicial); window.clearInterval(intervalo); window.clearTimeout(authInicial); window.removeEventListener("auth:changed", syncAuth); };
  }, []);
  const ejecutar = async (accion: () => Promise<void>) => { setError(""); try { await accion(); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar el carrito."); } };
  return <div className="min-h-screen flex flex-col"><Header />
    <main className="flex-1 bg-ferro-light"><div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8"><div><p className="text-sm font-semibold uppercase tracking-wide text-ferro-gray">Tu compra</p><h1 className="text-3xl font-bold mt-1">Carrito de compras</h1></div><Link href="/#catalogo" className="text-sm font-medium underline">Continuar comprando</Link></div>
      {errorSincronizacion && <p role="alert" className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{errorSincronizacion} <button type="button" onClick={() => void ejecutar(actualizar)} className="ml-1 font-semibold underline">Reintentar sincronización</button></p>}
      {!listo ? <div className="bg-white rounded-2xl p-10 animate-pulse">Cargando carrito…</div> : items.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><div className="text-5xl mb-4" aria-hidden="true">🛒</div><h2 className="text-xl font-bold">Tu carrito está vacío</h2><p className="text-gray-500 mt-2 mb-6">Explora el catálogo para encontrar lo que necesitas.</p><Link href="/#catalogo" className="inline-flex bg-ferro-yellow px-6 py-3 rounded-lg font-semibold">Ver catálogo</Link></div> : <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <section className="bg-white rounded-2xl border border-gray-100 divide-y">
          {items.map((item) => { const imagen = resolverUrlImagen(item.imagen); const restante = item.estado_reserva === "activa" && item.fecha_expiracion && ahora ? Math.max(0, Math.ceil((new Date(item.fecha_expiracion).getTime() - ahora) / 1000)) : 0; const expirada = item.estado_reserva === "vencida" || (item.estado_reserva === "activa" && restante === 0 && ahora > 0); return <article key={item.id_producto} className="p-4 sm:p-6 flex gap-4 sm:gap-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-ferro-light flex-shrink-0 flex items-center justify-center p-2">{imagen ? <img src={imagen} alt={item.nombre} className="max-w-full max-h-full object-contain" /> : <span aria-hidden="true">📦</span>}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><div><Link href={`/productos/${item.id_producto}`} className="font-semibold hover:underline">{item.nombre}</Link><p className="text-xs text-gray-500 mt-1">Código: {item.codigo}</p></div><p className="font-bold">{dinero(item.precio * item.cantidad)}</p></div>
              <p className="text-sm text-gray-500 mt-2">{dinero(item.precio)} por unidad · físico: {item.stock_fisico ?? item.stock_actual} · reservado: {item.unidades_reservadas ?? 0} · disponible: {item.stock_disponible}</p>
              {item.estado_reserva === "activa" && restante > 0 ? <p className={`text-sm mt-2 ${restante <= 120 ? "font-semibold text-amber-700" : "text-emerald-700"}`}>Reserva temporal: {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, "0")} min restantes{restante <= 120 ? " · Está por vencer" : ""}</p> : autenticado ? <div className="mt-2 flex flex-wrap items-center gap-2"><p className={`text-sm ${expirada ? "text-red-700" : "text-amber-700"}`}>{expirada ? "La reserva venció; las unidades pueden haber sido tomadas." : item.estado_reserva === "liberada" ? "La reserva fue liberada." : "Este producto aún no tiene una reserva activa."}</p><button type="button" onClick={() => void ejecutar(() => cambiarCantidad(item.id_producto, item.cantidad))} className="text-sm font-semibold underline">Renovar reserva por {item.duracion_reserva_minutos || 15} min</button></div> : <p className="text-sm text-amber-700 mt-2">Carrito de invitado: inicia sesión para reservar estas unidades.</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4"><div className="inline-flex border rounded-lg overflow-hidden"><button aria-label={`Reducir cantidad de ${item.nombre}`} disabled={item.cantidad <= 1} onClick={() => void ejecutar(() => cambiarCantidad(item.id_producto, item.cantidad - 1))} className="w-10 h-9 hover:bg-gray-100 disabled:opacity-40">−</button><span className="w-10 h-9 border-x flex items-center justify-center text-sm">{item.cantidad}</span><button aria-label={`Aumentar cantidad de ${item.nombre}`} disabled={item.cantidad >= item.maximo_carrito} onClick={() => void ejecutar(() => cambiarCantidad(item.id_producto, item.cantidad + 1))} className="w-10 h-9 hover:bg-gray-100 disabled:opacity-40">+</button></div><button onClick={() => { if (window.confirm(`¿Quitar ${item.nombre} del carrito?`)) void ejecutar(() => eliminar(item.id_producto)); }} className="text-sm text-red-600 hover:underline">Eliminar</button></div>
              {item.cantidad >= item.maximo_carrito && <p className="text-xs text-amber-700 mt-2">Máximo para este carrito: {item.maximo_carrito}</p>}
            </div>
          </article>; })}
          {error && <p role="alert" className="px-6 py-3 text-sm text-red-700">{error}</p>}
          <div className="px-6 py-4 text-right"><button onClick={() => { if (window.confirm("¿Vaciar todo el carrito?")) void ejecutar(vaciar); }} className="text-sm text-red-600 hover:underline">Vaciar carrito</button></div>
        </section>
        <aside className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24"><h2 className="text-lg font-bold">Resumen</h2><div className="flex justify-between mt-6 text-sm"><span>Subtotal</span><span>{dinero(subtotal)}</span></div><div className="flex justify-between border-t mt-4 pt-4 font-bold text-lg"><span>Total</span><span>{dinero(subtotal)}</span></div><p className="text-xs text-gray-500 mt-2">El precio final se confirma con el inventario al procesar la compra.</p><Link href="/checkout" className="block mt-6 text-center bg-ferro-yellow hover:bg-ferro-yellow-dark font-semibold px-5 py-3 rounded-lg">Proceder al checkout</Link></aside>
      </div>}
    </div></main><Footer /></div>;
}
