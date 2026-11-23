"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { obtenerMisPedidos, type PedidoResumen } from "@/services/compraService";
import { obtenerToken } from "@/services/authService";
import { mostrarFecha } from "@/lib/fechas";

const filtros = [["todos", "Todos"], ["pendiente", "Pendiente"], ["pagado", "Pagado"], ["cancelado", "Cancelado"]] as const;

export default function MisComprasPage() {
  const router = useRouter();
  const [estado, setEstado] = useState("todos");
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => { if (!obtenerToken()) router.replace("/login?next=%2Fmis-compras"); }, [router]);
  useEffect(() => {
    let activo = true;
    obtenerMisPedidos(estado).then((data) => { if (activo) setPedidos(data); })
      .catch((err: unknown) => { if (activo) setError(err instanceof Error ? err.message : "No se pudo cargar el historial."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [estado]);

  return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1 bg-ferro-light"><div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
    <Link href="/perfil" className="text-sm text-gray-500 hover:text-black">← Mi perfil</Link><h1 className="text-3xl font-bold mt-3">Mis pedidos</h1><p className="text-gray-600 mt-2">Consulta tus pedidos, productos y comprobantes.</p>
    <div className="flex flex-wrap gap-2 mt-6">{filtros.map(([valor, titulo]) => <button key={valor} onClick={() => { if (valor !== estado) { setCargando(true); setError(""); setEstado(valor); } }} className={`rounded-full px-4 py-2 text-sm border ${estado === valor ? "bg-ferro-black text-white border-ferro-black" : "bg-white border-gray-200"}`}>{titulo}</button>)}</div>
    {error && <p role="alert" className="mt-5 p-4 rounded-xl bg-red-50 text-red-700">{error}</p>}
    {cargando ? <div className="mt-6 bg-white p-8 rounded-2xl animate-pulse">Cargando tus pedidos…</div> : pedidos.length === 0 ? <div className="mt-6 bg-white p-8 rounded-2xl">No hay pedidos para este filtro.</div> : <div className="mt-6 space-y-3">{pedidos.map((pedido) => <article key={pedido.id_pedido} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{pedido.codigo_pedido}</h2><span className="text-xs rounded-full bg-amber-50 text-amber-900 px-3 py-1">{pedido.estado_pedido[0].toUpperCase() + pedido.estado_pedido.slice(1)}</span></div><p className="text-sm text-gray-500 mt-2">{mostrarFecha(pedido.fecha_pedido)} · Retiro: {mostrarFecha(pedido.fecha_retiro)}</p><ul className="text-sm text-gray-600 mt-2">{pedido.detalles?.map((producto) => <li key={producto.id_producto}>{producto.nombre} · {producto.cantidad} × ${producto.subtotal.toFixed(2)}</li>)}</ul><p className="text-sm text-gray-600 mt-1">Pago: {pedido.metodo_pago === "tarjeta" ? "Tarjeta simulada" : "Efectivo"} · {pedido.estado_pago[0].toUpperCase() + pedido.estado_pago.slice(1)}</p></div><div className="flex items-center justify-between sm:justify-end gap-4"><strong>${pedido.total.toFixed(2)}</strong><Link href={`/pedido/${pedido.id_pedido}`} className="rounded-lg bg-ferro-yellow px-4 py-2 font-semibold">Ver detalle</Link></div></article>)}</div>}
  </div></main><Footer /></div>;
}
