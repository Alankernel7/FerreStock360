"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { consultarNotificaciones, marcarNotificacionLeida, marcarTodasNotificacionesLeidas } from "@/services/notificacionesService";
import type { Notificacion, NotificacionesData } from "@/types/notificacion";

const iconoCampana = "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9";

export default function NotificationBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [data, setData] = useState<NotificacionesData>({ notificaciones: [], no_leidas: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState<number | "todas" | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setData(await consultarNotificaciones());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  useEffect(() => {
    const actualizar = () => { void cargar(); };
    window.addEventListener("focus", actualizar);
    window.addEventListener("notificaciones:actualizar", actualizar);
    return () => {
      window.removeEventListener("focus", actualizar);
      window.removeEventListener("notificaciones:actualizar", actualizar);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setAbierto(false);
    };
    const cerrarEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", cerrarFuera);
    document.addEventListener("keydown", cerrarEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarFuera);
      document.removeEventListener("keydown", cerrarEscape);
    };
  }, [abierto]);

  async function marcarUna(notification: Notificacion) {
    if (notification.leida) return;
    setActualizando(notification.id_notificacion);
    try {
      await marcarNotificacionLeida(notification.id_notificacion);
      setData((prev) => ({
        ...prev,
        no_leidas: Math.max(0, prev.no_leidas - 1),
        notificaciones: prev.notificaciones.map((item) => item.id_notificacion === notification.id_notificacion ? { ...item, leida: true } : item),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar como leída");
    } finally {
      setActualizando(null);
    }
  }

  async function marcarTodas() {
    setActualizando("todas");
    try {
      await marcarTodasNotificacionesLeidas();
      setData((prev) => ({ ...prev, no_leidas: 0, notificaciones: prev.notificaciones.map((item) => ({ ...item, leida: true })) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron marcar como leídas");
    } finally {
      setActualizando(null);
    }
  }

  async function abrirNotificacion(notification: Notificacion) {
    await marcarUna(notification);
    setAbierto(false);
    if (notification.id_movimiento) router.push("/dashboard/movimientos");
    else if (notification.id_producto) router.push("/dashboard/inventario");
  }

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => { const next = !abierto; setAbierto(next); if (next) void cargar(); }} className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-ferro-black" aria-label={`Notificaciones${data.no_leidas ? `, ${data.no_leidas} sin leer` : ""}`} aria-expanded={abierto} aria-haspopup="dialog">
        <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconoCampana} /></svg>
        {data.no_leidas > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">{data.no_leidas > 99 ? "99+" : data.no_leidas}</span>}
      </button>

      {abierto && <section role="dialog" aria-label="Notificaciones" className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white text-ferro-black shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3"><div><h2 className="font-semibold">Notificaciones</h2><p className="text-xs text-gray-500">{data.no_leidas} sin leer</p></div><button type="button" disabled={!data.no_leidas || actualizando !== null} onClick={() => void marcarTodas()} className="text-xs font-semibold text-amber-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50">Marcar todas como leídas</button></header>
        {error && <p role="alert" className="px-4 py-3 text-xs text-red-700">{error}</p>}
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto">
          {cargando ? <p className="p-6 text-center text-sm text-gray-500">Cargando notificaciones…</p> : data.notificaciones.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">No tienes notificaciones.</p> : data.notificaciones.map((notification) => {
            const href = notification.id_movimiento ? "/dashboard/movimientos" : notification.id_producto ? "/dashboard/inventario" : "/dashboard";
            return <article key={notification.id_notificacion} className={`relative border-b border-gray-100 last:border-0 ${notification.leida ? "bg-white" : "bg-amber-50/70"}`}>
              <Link href={href} onClick={(event) => { event.preventDefault(); void abrirNotificacion(notification); }} className="block px-4 py-3 pr-10 hover:bg-gray-50">
                <div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${notification.leida ? "bg-transparent" : "bg-ferro-yellow"}`} aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-semibold">{notification.titulo}</p><p className="mt-0.5 text-xs leading-5 text-gray-600">{notification.descripcion}</p><p className="mt-1 text-[11px] text-gray-400">{new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.fecha_creacion))}</p></div></div>
              </Link>
              {!notification.leida && <button type="button" disabled={actualizando !== null} onClick={() => void marcarUna(notification)} className="absolute right-2 top-3 rounded p-1 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50" aria-label="Marcar notificación como leída" title="Marcar como leída"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>}
            </article>;
          })}
        </div>
        {data.notificaciones.length > 0 && <footer className="border-t border-gray-100 px-4 py-2"><Link href="/dashboard/movimientos" onClick={() => setAbierto(false)} className="text-xs font-semibold text-amber-800 hover:underline">Ver movimientos</Link></footer>}
      </section>}
    </div>
  );
}
