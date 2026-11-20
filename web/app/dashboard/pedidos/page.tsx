"use client";

import { useCallback, useEffect, useState } from "react";
import { actualizarPedidoAdmin, listarPedidosAdmin, obtenerPedidoAdmin, type PedidoAdmin, type PedidoResumen, type PedidosAdminResponse } from "@/services/compraService";
import { mostrarFecha } from "@/lib/fechas";

const estadoTitulo = (estado: string) => ({ pendiente: "Pendiente", pagado: "Pagado", cancelado: "Cancelado" }[estado] || estado);
const fechaTexto = (valor: string) => mostrarFecha(valor);

export default function PedidosAdminPage() {
  const [datos, setDatos] = useState<PedidosAdminResponse | null>(null);
  const [pedido, setPedido] = useState<PedidoAdmin | null>(null);
  const [estado, setEstado] = useState("todos");
  const [metodo, setMetodo] = useState("todos");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [accionando, setAccionando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [formCancelar, setFormCancelar] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const params = new URLSearchParams({ estado, metodo });
      if (q.trim()) params.set("q", q.trim());
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      setDatos(await listarPedidosAdmin(params));
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudieron cargar los pedidos."); }
    finally { setCargando(false); }
  }, [estado, metodo, q, desde, hasta]);
  useEffect(() => { const timer = window.setTimeout(() => { void cargar(); }, 0); return () => window.clearTimeout(timer); }, [cargar]);

  const abrirDetalle = async (row: PedidoResumen) => {
    setError(""); setFormCancelar(false); setMotivo("");
    try { setPedido(await obtenerPedidoAdmin(row.id_pedido)); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo abrir el pedido."); }
  };

  const ejecutar = async (accion: "marcar_pendiente" | "confirmar_pago" | "entregar" | "cancelar") => {
    if (!pedido || accionando) return;
    if (accion === "cancelar" && !motivo.trim()) { setError("Escribe el motivo de cancelación."); return; }
    const confirmacion = accion === "confirmar_pago" ? "¿Confirmas que recibiste el pago de este pedido?"
      : accion === "cancelar" ? `¿Confirmas cancelar el pedido? Motivo: ${motivo.trim()}`
        : accion === "marcar_pendiente" ? "¿Confirmas devolver este pedido a Pendiente?"
          : "¿Confirmas registrar el retiro y descontar las unidades del inventario?";
    if (!window.confirm(confirmacion)) return;
    setAccionando(true); setError("");
    try {
      setPedido(await actualizarPedidoAdmin(pedido.id_pedido, accion, accion === "cancelar" ? motivo.trim() : undefined));
      setFormCancelar(false); setMotivo("");
      await cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar el pedido."); }
    finally { setAccionando(false); }
  };

  const indicadores = datos?.indicadores;
  return <div className="max-w-7xl mx-auto">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"><div><p className="text-sm text-gray-500">Administración</p><h1 className="text-3xl font-bold text-ferro-black">Pedidos y Reservas</h1></div><button onClick={() => void cargar()} className="self-start rounded-lg border bg-white px-4 py-2 text-sm font-semibold">Actualizar</button></div>
    {error && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">{[["Total de pedidos", indicadores?.total_pedidos], ["Pendientes", indicadores?.pendientes], ["Pagados", indicadores?.pagados], ["Cancelados", indicadores?.cancelados]].map(([label, value]) => <div key={String(label)} className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value ?? "—"}</p></div>)}</div>
    <section className="bg-white rounded-2xl border mt-6 p-4 sm:p-5"><h2 className="font-bold">Filtros</h2><div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente o número" className="border rounded-lg px-3 py-2" />
      <select value={estado} onChange={(e) => setEstado(e.target.value)} className="border rounded-lg px-3 py-2 bg-white"><option value="todos">Todos los estados</option><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="cancelado">Cancelado</option></select>
      <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="border rounded-lg px-3 py-2 bg-white"><option value="todos">Todos los pagos</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option></select>
      <label className="text-xs text-gray-500">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="block w-full border rounded-lg px-3 py-2 mt-1" /></label>
      <label className="text-xs text-gray-500">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="block w-full border rounded-lg px-3 py-2 mt-1" /></label>
    </div></section>
    <section className="bg-white rounded-2xl border mt-6 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-sm"><thead className="bg-gray-50 text-left text-gray-500"><tr><th className="p-4">Pedido</th><th className="p-4">Cliente</th><th className="p-4">Fecha</th><th className="p-4">Retiro</th><th className="p-4">Pago</th><th className="p-4">Total</th><th className="p-4">Estado</th><th className="p-4">Acción</th></tr></thead><tbody className="divide-y">{cargando ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">Cargando pedidos…</td></tr> : !datos?.pedidos.length ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">No hay pedidos para estos filtros.</td></tr> : datos.pedidos.map((row) => <tr key={row.id_pedido} className="hover:bg-gray-50"><td className="p-4 font-semibold">{row.codigo_pedido}</td><td className="p-4"><div>{row.nombre_cliente}</div><div className="text-xs text-gray-500">{row.email_cliente}</div></td><td className="p-4">{fechaTexto(row.fecha_pedido)}</td><td className="p-4">{fechaTexto(row.fecha_retiro)}</td><td className="p-4">{row.metodo_pago === "tarjeta" ? "Tarjeta" : "Efectivo"}</td><td className="p-4">${row.total.toFixed(2)}</td><td className="p-4">{estadoTitulo(row.estado_pedido)}</td><td className="p-4"><button onClick={() => void abrirDetalle(row)} className="rounded-lg bg-ferro-yellow px-3 py-2 font-semibold">Abrir</button></td></tr>)}</tbody></table></div></section>

    {pedido && <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPedido(null); }}><section role="dialog" aria-modal="true" aria-labelledby="pedido-title" className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-7">
      <div className="flex justify-between gap-4"><div><p className="text-xs text-gray-500">Detalle administrativo</p><h2 id="pedido-title" className="text-2xl font-bold">{pedido.codigo_pedido}</h2></div><button onClick={() => setPedido(null)} aria-label="Cerrar detalle" className="text-2xl leading-none">×</button></div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5 text-sm"><div><span className="text-gray-500">Cliente</span><p className="font-medium">{pedido.nombre_cliente}</p><p className="break-all">{pedido.email_cliente}</p></div><div><span className="text-gray-500">Método de pago</span><p className="font-medium">{pedido.metodo_pago === "tarjeta" ? "Tarjeta" : "Efectivo"}</p><p>{estadoTitulo(pedido.estado_pedido)}</p></div><div><span className="text-gray-500">Fecha de retiro</span><p>{fechaTexto(pedido.fecha_retiro)}</p>{pedido.fecha_entrega && <p>Entregado: {fechaTexto(pedido.fecha_entrega)}</p>}</div><div><span className="text-gray-500">Total</span><p className="font-bold">${pedido.total.toFixed(2)}</p></div></div>
      <h3 className="font-bold mt-6">Productos</h3><ul className="divide-y mt-2">{pedido.detalles?.map((item) => <li key={item.id_producto} className="py-3 flex justify-between gap-4"><span>{item.nombre} <span className="text-gray-500">× {item.cantidad}</span></span><span>${item.subtotal.toFixed(2)}</span></li>)}</ul>
      {pedido.motivo_cancelacion && <p className="mt-3 text-sm text-red-700">Motivo de cancelación: {pedido.motivo_cancelacion}</p>}
      <h3 className="font-bold mt-6">Historial de estados</h3><ol className="mt-2 space-y-3">{pedido.historial?.map((event) => <li key={event.id_historial} className="border-l-2 border-ferro-yellow pl-3 text-sm"><p className="font-medium">{event.estado_anterior ? `${estadoTitulo(event.estado_anterior)} → ` : ""}{estadoTitulo(event.estado_nuevo)}</p><p className="text-xs text-gray-500">{new Date(event.fecha_cambio).toLocaleString("es-SV")} · {event.usuario}{event.motivo ? ` · ${event.motivo}` : ""}</p></li>)}</ol>
      {formCancelar && <form className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4" onSubmit={(event) => { event.preventDefault(); void ejecutar("cancelar"); }}><label htmlFor="motivo-cancelacion" className="block text-sm font-semibold text-red-900">Motivo de cancelación (obligatorio)</label><textarea id="motivo-cancelacion" required value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={440} rows={3} className="mt-2 w-full rounded-lg border border-red-200 bg-white p-3" /><div className="mt-3 flex gap-2"><button type="submit" disabled={accionando || !motivo.trim()} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Confirmar cancelación</button><button type="button" onClick={() => { setFormCancelar(false); setMotivo(""); }} className="rounded-lg border px-4 py-2">Volver</button></div></form>}
      <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t">{pedido.estado_pedido === "pendiente" && pedido.metodo_pago === "efectivo" && pedido.estado_pago === "pendiente" && <button disabled={accionando} onClick={() => void ejecutar("confirmar_pago")} className="rounded-lg bg-ferro-yellow px-4 py-2 font-semibold disabled:opacity-50">Confirmar pago</button>}{pedido.estado_pedido === "pagado" && pedido.metodo_pago === "efectivo" && !pedido.fecha_entrega && <><button disabled={accionando} onClick={() => void ejecutar("marcar_pendiente")} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Marcar como pendiente</button><button disabled={accionando} onClick={() => void ejecutar("entregar")} className="rounded-lg bg-green-700 text-white px-4 py-2 font-semibold disabled:opacity-50">Registrar retiro</button></>}{pedido.estado_pedido !== "cancelado" && !pedido.fecha_entrega && !formCancelar && <button disabled={accionando} onClick={() => { setError(""); setFormCancelar(true); }} className="rounded-lg border border-red-300 text-red-700 px-4 py-2 font-semibold disabled:opacity-50">Cancelar pedido</button>}<a href={`/dashboard/pedidos/${pedido.id_pedido}`} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 font-semibold">Ver comprobante</a></div>
    </section></div>}
  </div>;
}
