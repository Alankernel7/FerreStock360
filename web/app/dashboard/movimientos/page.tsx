"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { consultarMovimientos } from "@/services/movimientosService";
import type { MovimientoInventario } from "@/types/movimiento";

const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-ferro-yellow focus:ring-2 focus:ring-ferro-yellow/30";

export default function MovimientosPage() {
  const [items, setItems] = useState<MovimientoInventario[]>([]);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [direccion, setDireccion] = useState("desc");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const value = new URLSearchParams({ tipo, direccion });
    if (q.trim()) value.set("q", q.trim());
    if (desde) value.set("desde", desde);
    if (hasta) value.set("hasta", hasta);
    return value;
  }, [q, tipo, desde, hasta, direccion]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await consultarMovimientos(params));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el historial");
    } finally {
      setCargando(false);
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-ferro-black">Movimientos</h1><p className="mt-1 text-sm text-gray-500">Historial de entradas y salidas registradas</p></div>
        <button type="button" onClick={() => void cargar()} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50">Actualizar</button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="sm:col-span-2 xl:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-600">Buscar producto, código, usuario o motivo</span><input className={inputClass} value={q} maxLength={150} onChange={(event) => setQ(event.target.value)} placeholder="Nombre, código o usuario" /></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Tipo</span><select className={inputClass} value={tipo} onChange={(event) => setTipo(event.target.value)}><option value="todos">Entradas y salidas</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Desde</span><input className={inputClass} type="date" value={desde} max={hasta || undefined} onChange={(event) => setDesde(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Hasta</span><input className={inputClass} type="date" value={hasta} min={desde || undefined} onChange={(event) => setHasta(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Orden por fecha</span><select className={inputClass} value={direccion} onChange={(event) => setDireccion(event.target.value)}><option value="desc">Más recientes</option><option value="asc">Más antiguos</option></select></label>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><h2 className="font-semibold text-ferro-black">Registro de movimientos</h2><span className="text-xs text-gray-500">{items.length} registros</span></div>
        {cargando ? <p className="p-8 text-center text-sm text-gray-500">Cargando movimientos…</p> : items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Fecha y hora</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Motivo</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map((item) => <tr key={item.id_movimiento} className="hover:bg-gray-50"><td className="whitespace-nowrap px-4 py-3 text-gray-600">{new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.fecha_movimiento))}</td><td className="px-4 py-3"><p className="font-medium text-gray-900">{item.producto}</p><p className="text-xs text-gray-500">{item.codigo_producto}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.tipo_movimiento === "entrada" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{item.tipo_movimiento === "entrada" ? "Entrada" : "Salida"}</span></td><td className="px-4 py-3 font-semibold">{item.cantidad}</td><td className="px-4 py-3 text-gray-700">{item.usuario}</td><td className="max-w-xs truncate px-4 py-3 text-gray-600">{item.motivo || "—"}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-gray-500">No hay movimientos que coincidan con los filtros.</p>}
      </div>
    </section>
  );
}
