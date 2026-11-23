"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { obtenerPedido } from "@/services/compraService";
import { obtenerToken } from "@/services/authService";
import { resolverUrlImagen } from "@/lib/imagenes";
import type { Pedido } from "@/types/compra";
import { mostrarFecha } from "@/lib/fechas";

const estadoPedido = (estado: string) => ({ pendiente: "Pendiente", pagado: "Pagado", cancelado: "Cancelado" }[estado] || estado);
const fechaCorta = (fecha?: string) => mostrarFecha(fecha);

export default function ConfirmacionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!obtenerToken()) { router.replace(`/login?next=${encodeURIComponent(`/pedido/${id}`)}`); return; }
    let activo = true;
    obtenerPedido(Number(id)).then((resultado) => { if (activo) setPedido(resultado); })
      .catch((err: unknown) => { if (activo) setError(err instanceof Error ? err.message : "No se pudo cargar el pedido."); });
    return () => { activo = false; };
  }, [id, router]);
  const reserva = pedido?.metodo_pago === "efectivo";
  const imprimir = () => window.print();

  return <div className="min-h-screen flex flex-col"><div className="no-print"><Header /></div><main className="flex-1 bg-ferro-light print:bg-white"><div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 print:p-0">
    {error ? <div className="no-print bg-white rounded-2xl p-8 text-center"><h1 className="text-2xl font-bold">No se pudo abrir el pedido</h1><p role="alert" className="text-gray-600 mt-2">{error}</p><Link href="/mis-compras" className="inline-block mt-5 underline">Volver a Mis pedidos</Link></div> : !pedido ? <div className="no-print bg-white rounded-2xl p-10 animate-pulse">Cargando pedido…</div> : <>
      <article className="receipt bg-white border border-gray-200 rounded-2xl shadow-sm p-7 sm:p-10 print:rounded-none print:border-0 print:shadow-none print:p-0">
        <header className="border-b-2 border-ferro-yellow pb-5 flex flex-col sm:flex-row sm:justify-between gap-4"><div><p className="text-sm font-bold text-amber-700">FerreStock<span className="text-ferro-black"> 360</span></p><h1 className="text-2xl font-bold mt-3">Detalle del pedido</h1><p className="text-sm text-gray-600 mt-1">Documento informativo; no es factura fiscal.</p></div><div className="sm:text-right"><p className="text-xs uppercase tracking-wider text-gray-500">Número de pedido</p><p className="font-bold text-xl">{pedido.codigo_pedido}</p><p className="text-sm text-gray-600 mt-1">Fecha: {fechaCorta(pedido.fecha_pedido)}</p></div></header>
        <section className="grid sm:grid-cols-2 gap-5 py-5 border-b"><div><p className="text-xs uppercase text-gray-500">Cliente</p><p className="font-semibold mt-1">{pedido.nombre_cliente || "Cliente FerreStock360"}</p><p className="text-sm text-gray-600 break-all">{pedido.email_cliente || ""}</p></div><div><p className="text-xs uppercase text-gray-500">Estado</p><p className="font-bold mt-1">{estadoPedido(pedido.estado_pedido)}</p><p className="text-sm text-gray-600 mt-1">Retiro: {fechaCorta(pedido.fecha_retiro)}</p>{pedido.fecha_entrega && <p className="text-sm text-gray-600">Entrega: {fechaCorta(pedido.fecha_entrega)}</p>}</div></section>
        <section className="py-5"><h2 className="font-bold">Productos</h2><ul className="divide-y mt-2">{pedido.detalles?.map((item) => { const imagen = resolverUrlImagen(item.imagen); return <li key={item.id_producto} className="py-3 flex gap-3 items-center">{imagen && <img src={imagen} alt="" className="w-12 h-12 object-contain bg-ferro-light rounded print:hidden" />}<div className="flex-1"><p className="font-medium">{item.nombre}</p><p className="text-xs text-gray-500">{item.codigo} · {item.cantidad} × ${item.precio.toFixed(2)}</p></div><strong>${item.subtotal.toFixed(2)}</strong></li>; })}</ul><div className="border-t pt-4 mt-2 flex justify-between text-lg font-bold"><span>{pedido.estado_pedido === "pendiente" ? "Total pendiente" : pedido.estado_pedido === "pagado" ? "Total pagado" : "Importe del pedido"}</span><span>${pedido.total.toFixed(2)}</span></div></section>
        <section className="grid sm:grid-cols-2 gap-4 border-t py-5 text-sm"><div><p className="text-gray-500">Método de pago</p><p className="font-semibold">{pedido.metodo_pago === "tarjeta" ? "Tarjeta" : "Efectivo"}</p><p className="text-gray-500 mt-3">Estado del pago</p><p className="font-semibold">{estadoPedido(pedido.estado_pago)}</p></div><div><p className="text-gray-500">Información</p><p className="mt-1">{pedido.estado_pedido === "cancelado" ? "Este pedido fue cancelado." : reserva ? "Presenta este comprobante en el establecimiento para pagar y retirar tus productos en la fecha indicada." : "Presenta este comprobante para retirar tu pedido en la fecha indicada."}</p>{pedido.motivo_cancelacion && <p className="mt-3 text-red-700"><strong>Motivo de cancelación:</strong> {pedido.motivo_cancelacion}</p>}</div></section>
        <section className="border-t py-5"><h2 className="font-bold">Historial de estados</h2><ol className="mt-3 space-y-3">{pedido.historial?.map((evento) => <li key={evento.id_historial} className="border-l-2 border-ferro-yellow pl-3 text-sm"><p className="font-semibold">{evento.estado_anterior ? `${estadoPedido(evento.estado_anterior)} → ` : ""}{estadoPedido(evento.estado_nuevo)}</p><p className="text-xs text-gray-500">{new Date(evento.fecha_cambio).toLocaleString("es-SV")} · {evento.usuario}{evento.motivo ? ` · ${evento.motivo}` : ""}</p></li>)}</ol></section>
      </article>
      <div className="no-print flex flex-wrap justify-center gap-3 mt-6"><button onClick={imprimir} className="bg-ferro-yellow px-6 py-3 rounded-lg font-semibold">Imprimir / Guardar PDF</button><Link href="/mis-compras" className="bg-white border px-6 py-3 rounded-lg font-semibold">Mis pedidos</Link><Link href="/" className="bg-white border px-6 py-3 rounded-lg font-semibold">Volver a la tienda</Link></div>
    </>}
  </div></main><div className="no-print"><Footer /></div><style jsx global>{`@media print { @page { size: auto; margin: 14mm; } body { background: white !important; } .no-print { display: none !important; } .receipt { color: #111827; } }`}</style></div>;
}
