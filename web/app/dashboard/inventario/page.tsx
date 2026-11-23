"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { consultarCategoriasInventario, consultarInventario, crearMovimiento } from "@/services/inventarioService";
import { resolverUrlImagen } from "@/lib/imagenes";
import type { ArticuloInventario, CategoriaInventario, InventarioData } from "@/types/inventario";

const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-ferro-black outline-none focus:border-ferro-yellow focus:ring-2 focus:ring-ferro-yellow/30";

export default function InventarioPage() {
  const [data, setData] = useState<InventarioData | null>(null);
  const [categorias, setCategorias] = useState<CategoriaInventario[]>([]);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stock, setStock] = useState("todos");
  const [orden, setOrden] = useState("nombre");
  const [direccion, setDireccion] = useState("asc");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [seleccionado, setSeleccionado] = useState<ArticuloInventario | null>(null);
  const [guardando, setGuardando] = useState(false);

  const params = useMemo(() => {
    const value = new URLSearchParams({ stock, orden, direccion });
    if (q.trim()) value.set("q", q.trim());
    if (categoria) value.set("categoria", categoria);
    return value;
  }, [q, categoria, stock, orden, direccion]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [inventario, listaCategorias] = await Promise.all([
        consultarInventario(params),
        consultarCategoriasInventario(),
      ]);
      setData(inventario);
      setCategorias(listaCategorias);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el inventario");
    } finally {
      setCargando(false);
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  async function enviarMovimiento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seleccionado) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    const form = new FormData(event.currentTarget);
    try {
      await crearMovimiento({
        id_producto: seleccionado.id_producto,
        tipo_movimiento: form.get("tipo") as "entrada" | "salida",
        cantidad: Number(form.get("cantidad")),
        motivo: String(form.get("motivo") || "").trim(),
      });
      window.dispatchEvent(new Event("notificaciones:actualizar"));
      setSeleccionado(null);
      setMensaje("Movimiento guardado; existencias actualizadas.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el movimiento");
    } finally {
      setGuardando(false);
    }
  }

  const stats = data?.estadisticas;
  const cards = [
    ["Stock físico", stats?.unidades_fisicas ?? "—", "text-ferro-black"],
    ["Unidades reservadas", stats?.unidades_reservadas ?? "—", "text-amber-700"],
    ["Unidades disponibles", stats?.unidades_disponibles ?? "—", "text-emerald-700"],
    ["Agotados", stats?.agotados ?? "—", "text-red-700"],
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-ferro-black">Inventario</h1><p className="mt-1 text-sm text-gray-500">Existencias actuales y registro de movimientos</p></div>
        <button onClick={() => void cargar()} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">Actualizar</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, color]) => <article key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></article>)}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {mensaje && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{mensaje}</p>}

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="sm:col-span-2 xl:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-600">Buscar por nombre o código</span><input className={inputClass} value={q} maxLength={150} onChange={(e) => setQ(e.target.value)} placeholder="Ej. taladro o FER-001" /></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Categoría</span><select className={inputClass} value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas</option>{categorias.map((item) => <option key={item.id_categoria} value={item.id_categoria}>{item.nombre}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Estado del stock</span><select className={inputClass} value={stock} onChange={(e) => setStock(e.target.value)}><option value="todos">Todos</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option></select></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Ordenar</span><select className={inputClass} value={`${orden}-${direccion}`} onChange={(e) => { const [o, d] = e.target.value.split("-"); setOrden(o); setDireccion(d); }}><option value="nombre-asc">Nombre A–Z</option><option value="nombre-desc">Nombre Z–A</option><option value="cantidad-asc">Menor existencia</option><option value="cantidad-desc">Mayor existencia</option></select></label>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><h2 className="font-semibold text-ferro-black">Existencias</h2><span className="text-xs text-gray-500">{data?.productos.length ?? 0} productos</span></div>
        {cargando ? <p className="p-8 text-center text-sm text-gray-500">Cargando inventario…</p> : data?.productos.length ? <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Stock físico</th><th className="px-4 py-3">Reservado</th><th className="px-4 py-3">Disponible</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody className="divide-y divide-gray-100">{data.productos.map((item) => {
          const status = item.estado_inventario;
          const style = status === "agotado" ? "bg-red-100 text-red-800" : status === "bajo" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
          return <tr key={item.id_producto} className="hover:bg-gray-50"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-10 w-10 overflow-hidden rounded-lg bg-gray-100">{(item.imagen_1 || item.imagen_2) && <img src={resolverUrlImagen(item.imagen_1 || item.imagen_2) || ""} alt="" className="h-full w-full object-cover" />}</div><span className="max-w-[240px] truncate font-medium text-gray-900">{item.nombre}</span></div></td><td className="px-4 py-3 text-gray-600">{item.codigo}</td><td className="px-4 py-3 text-gray-600">{item.categoria}</td><td className="px-4 py-3"><span className="font-semibold">{item.stock_fisico}</span><span className="ml-1 text-xs text-gray-500">/ min. {item.stock_minimo}</span></td><td className="px-4 py-3 font-semibold text-amber-700">{item.unidades_reservadas}</td><td className="px-4 py-3 font-semibold text-emerald-700">{item.stock_disponible}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{status === "normal" ? "Normal" : status === "bajo" ? "Stock bajo" : "Agotado"}</span></td><td className="px-4 py-3"><button onClick={() => { setError(""); setSeleccionado(item); }} className="rounded-md bg-ferro-yellow px-3 py-2 text-xs font-semibold text-ferro-black hover:brightness-95">Registrar movimiento</button></td></tr>;
        })}</tbody></table></div> : <p className="p-8 text-center text-sm text-gray-500">No hay productos que coincidan con los filtros.</p>}
      </div>

      {seleccionado && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSeleccionado(null); }}><div role="dialog" aria-modal="true" aria-labelledby="movement-title" className="my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="movement-title" className="text-lg font-bold text-ferro-black">Registrar movimiento</h2><p className="mt-1 text-sm text-gray-500">{seleccionado.nombre} · actual: {seleccionado.stock_actual}</p></div><button type="button" onClick={() => setSeleccionado(null)} aria-label="Cerrar" className="rounded p-1 text-gray-500 hover:bg-gray-100">✕</button></div><form className="space-y-4" onSubmit={enviarMovimiento}><label className="block"><span className="mb-1 block text-sm font-medium">Tipo de movimiento</span><select name="tipo" className={inputClass} required><option value="entrada">Entrada de existencias</option><option value="salida">Salida de existencias</option></select></label><label className="block"><span className="mb-1 block text-sm font-medium">Cantidad</span><input name="cantidad" type="number" min="1" max="2147483647" step="1" required className={inputClass} /></label><label className="block"><span className="mb-1 block text-sm font-medium">Motivo <span className="font-normal text-gray-500">(opcional)</span></span><textarea name="motivo" maxLength={300} rows={3} className={inputClass} placeholder="Compra, devolución, ajuste…" /></label><div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setSeleccionado(null)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={guardando} className="rounded-lg bg-ferro-yellow px-4 py-2.5 text-sm font-bold text-ferro-black disabled:opacity-60">{guardando ? "Guardando…" : "Confirmar movimiento"}</button></div></form></div></div>}
    </section>
  );
}
