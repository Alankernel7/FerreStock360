"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { obtenerToken } from "@/services/authService";
import { obtenerPedidoAdmin, type PedidoAdmin } from "@/services/compraService";
import { mostrarFecha } from "@/lib/fechas";

const fecha = (value?: string) => mostrarFecha(value);
const estado = (value: string) => ({ pendiente: "Pendiente", pagado: "Pagado", cancelado: "Cancelado" }[value] || value);

export default function ComprobanteAdminPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<PedidoAdmin | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!obtenerToken()) { router.replace("/login"); return; }
    obtenerPedidoAdmin(Number(id)).then(setPedido).catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar el comprobante."));
  }, [id, router]);
  if (error) return <p role="alert" className="m-10 text-red-700">{error}</p>;
  if (!pedido) return <p className="m-10">Cargando comprobante…</p>;
  return <main className="max-w-3xl mx-auto my-8 bg-white border rounded-xl p-8 print:m-0 print:border-0">
    <div className="no-print flex justify-end mb-5"><button onClick={() => window.print()} className="rounded-lg bg-ferro-yellow px-5 py-2 font-semibold">Imprimir / Guardar PDF</button></div>
    <header className="border-b-2 border-ferro-yellow pb-5"><p className="font-bold text-amber-700">FerreStock <span className="text-black">360</span></p><h1 className="text-2xl font-bold mt-3">{pedido.metodo_pago === "efectivo" ? "Comprobante de reserva" : "Comprobante de compra"}</h1><p className="text-xs text-gray-500">Documento informativo; no es factura fiscal.</p><p className="font-bold mt-3">{pedido.codigo_pedido}</p></header>
    <div className="grid sm:grid-cols-2 gap-4 py-5 border-b text-sm"><p>Cliente: <strong>{pedido.nombre_cliente}</strong><br />{pedido.email_cliente}</p><p>Fecha: {fecha(pedido.fecha_pedido)}<br />Retiro: {fecha(pedido.fecha_retiro)}{pedido.fecha_entrega && <><br />Entrega: {fecha(pedido.fecha_entrega)}</>}<br />Estado: <strong>{estado(pedido.estado_pedido)}</strong></p></div>
    <h2 className="font-bold mt-5">Productos</h2><ul className="divide-y">{pedido.detalles?.map((item) => <li key={item.id_producto} className="py-3 flex justify-between"><span>{item.nombre} · {item.cantidad} × ${item.precio.toFixed(2)}</span><strong>${item.subtotal.toFixed(2)}</strong></li>)}</ul><div className="border-t pt-4 flex justify-between text-lg font-bold"><span>{pedido.estado_pago === "pagado" ? "Total pagado" : pedido.estado_pago === "pendiente" ? "Total pendiente" : "Importe del pedido"}</span><span>${pedido.total.toFixed(2)}</span></div>
    {pedido.motivo_cancelacion && <p className="mt-4 text-sm text-red-700">Motivo de cancelación: {pedido.motivo_cancelacion}</p>}
    <section className="border-t mt-5 pt-4"><h2 className="font-bold">Historial de estados</h2><ol className="mt-3 space-y-3">{pedido.historial?.map((evento) => <li key={evento.id_historial} className="border-l-2 border-ferro-yellow pl-3 text-sm"><p className="font-semibold">{evento.estado_anterior ? `${estado(evento.estado_anterior)} → ` : ""}{estado(evento.estado_nuevo)}</p><p className="text-xs text-gray-500">{new Date(evento.fecha_cambio).toLocaleString("es-SV")} · {evento.usuario}{evento.motivo ? ` · ${evento.motivo}` : ""}</p></li>)}</ol></section>
    <p className="border-t mt-5 pt-4 text-sm">{pedido.metodo_pago === "efectivo" ? "Presenta este comprobante para pagar en efectivo y retirar el pedido." : "Presenta este comprobante para retirar el pedido."}</p>
    <style jsx global>{`@media print { @page { margin: 14mm; } body { background: white !important; } .no-print { display: none !important; } }`}</style>
  </main>;
}
