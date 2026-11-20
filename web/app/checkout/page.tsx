"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/components/CartProvider";
import { obtenerToken, obtenerUsuarioGuardado } from "@/services/authService";
import { finalizarCompra, obtenerFechasRetiro } from "@/services/compraService";
import { resolverUrlImagen } from "@/lib/imagenes";
import type { Pedido } from "@/types/compra";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, listo, compraConfirmada, actualizar } = useCart();
  const [usuario, setUsuario] = useState<ReturnType<typeof obtenerUsuarioGuardado>>(null);
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta">("efectivo");
  const [fechasRetiro, setFechasRetiro] = useState<string[]>([]);
  const [fechaRetiro, setFechaRetiro] = useState("");
  const [numero, setNumero] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [clave, setClave] = useState("");

  useEffect(() => {
    if (!obtenerToken()) router.replace("/login?next=%2Fcheckout");
    else void Promise.resolve().then(() => setUsuario(obtenerUsuarioGuardado()));
  }, [router]);
  useEffect(() => {
    if (!obtenerToken()) return;
    let activo = true;
    obtenerFechasRetiro().then((fechas) => {
      if (!activo) return;
      setFechasRetiro(fechas);
      setFechaRetiro((actual) => actual || fechas[0] || "");
    }).catch((err: unknown) => { if (activo) setError(err instanceof Error ? err.message : "No se pudieron cargar las fechas de retiro."); });
    return () => { activo = false; };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!items.length) { setError("Agrega al menos un producto antes de confirmar."); return; }
    if (!fechaRetiro) { setError("Selecciona una fecha de retiro disponible."); return; }
    if (metodo === "tarjeta" && (!numero.trim() || !vencimiento.trim() || !cvv.trim())) { setError("Completa los datos de la tarjeta de demostración."); return; }
    setCargando(true);
    const idempotencia = clave || sessionStorage.getItem("ferrestock_checkout_key") || crypto.randomUUID();
    setClave(idempotencia);
    sessionStorage.setItem("ferrestock_checkout_key", idempotencia);
    try {
      const pedido: Pedido = await finalizarCompra({ metodo, fecha_retiro: fechaRetiro, clave_idempotencia: idempotencia,
        ...(metodo === "tarjeta" ? { tarjeta: { numero, vencimiento, cvv } } : {}),
      });
      setNumero(""); setVencimiento(""); setCvv("");
      sessionStorage.removeItem("ferrestock_checkout_key");
      if (pedido.estado_pedido === "rechazado") {
        await actualizar().catch(() => {});
      } else {
        compraConfirmada();
      }
      router.push(`/pedido/${pedido.id_pedido}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pedido.");
    } finally { setCargando(false); }
  };

  return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1 bg-ferro-light"><div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
    <Link href="/carrito" className="text-sm text-gray-500 hover:text-black">← Volver al carrito</Link><h1 className="text-3xl font-bold mt-3 mb-8">Finalizar compra</h1>
    {!obtenerToken() ? <div className="bg-white rounded-2xl p-8">Te llevamos al inicio de sesión para continuar con tu carrito.</div> : !listo ? <div className="bg-white rounded-2xl p-8 animate-pulse">Cargando pedido…</div> : !items.length ? <div className="bg-white rounded-2xl p-8"><p>Tu carrito está vacío.</p><Link href="/#catalogo" className="underline mt-3 inline-block">Continuar comprando</Link></div> : <form onSubmit={submit} className="grid lg:grid-cols-[1fr_390px] gap-6 items-start">
      <div className="space-y-6"><section className="bg-white rounded-2xl border border-gray-100 p-6"><h2 className="font-bold text-lg">Datos del cliente</h2><p className="text-sm text-gray-500 mt-1">Confirmamos los datos de tu sesión.</p><div className="grid sm:grid-cols-2 gap-4 mt-5"><div><span className="text-xs text-gray-500">Nombre</span><p className="font-medium">{usuario?.nombre || "—"}</p></div><div><span className="text-xs text-gray-500">Correo</span><p className="font-medium break-all">{usuario?.email || "—"}</p></div></div></section>
        <section className="bg-white rounded-2xl border border-gray-100 p-6"><h2 className="font-bold text-lg">Fecha de retiro</h2><label className="block text-sm mt-3">¿Qué día deseas retirar tu pedido?<select required value={fechaRetiro} onChange={(event) => setFechaRetiro(event.target.value)} className="block w-full mt-1 border rounded-lg px-3 py-2 bg-white"><option value="" disabled>Selecciona una fecha disponible</option>{fechasRetiro.map((fecha) => <option key={fecha} value={fecha}>{new Intl.DateTimeFormat("es-SV", { dateStyle: "full", timeZone: "UTC" }).format(new Date(fecha + "T12:00:00Z"))}</option>)}</select></label><p className="text-xs text-gray-500 mt-2">Las fechas disponibles respetan los días de retiro configurados por la tienda.</p></section>
        <section className="bg-white rounded-2xl border border-gray-100 p-6"><h2 className="font-bold text-lg">Método de pago</h2><div className="grid sm:grid-cols-2 gap-3 mt-4">{([ ["efectivo", "Efectivo"], ["tarjeta", "Tarjeta simulada"]] as const).map(([valor, etiqueta]) => <label key={valor} className={metodo === valor ? "cursor-pointer rounded-xl border p-4 border-ferro-yellow ring-1 ring-ferro-yellow bg-amber-50" : "cursor-pointer rounded-xl border p-4 border-gray-200"}><input type="radio" name="metodo" value={valor} checked={metodo === valor} onChange={() => setMetodo(valor)} className="accent-yellow-500 mr-2" />{etiqueta}</label>)}</div>
          {metodo === "efectivo" && <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">Confirmarás una reserva. Pagarás en efectivo en el establecimiento el día de retiro; el pedido queda pendiente de pago hasta que el personal lo registre.</p>}
          {metodo === "tarjeta" && <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-4"><p className="text-sm font-semibold text-blue-900">Pago simulado para uso académico</p><p className="text-xs text-blue-800 mt-1">Usa solo datos ficticios. No ingreses una tarjeta real. Un número válido terminado en cifra par se aprueba; impar se rechaza.</p><div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="sm:col-span-2 text-sm">Número de demostración<input autoComplete="off" inputMode="numeric" maxLength={23} value={numero} onChange={(e) => setNumero(e.target.value)} className="block w-full mt-1 border rounded-lg px-3 py-2" placeholder="4242 4242 4242 4242" /></label><label className="text-sm">Vencimiento<input autoComplete="off" maxLength={5} value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className="block w-full mt-1 border rounded-lg px-3 py-2" placeholder="MM/AA" /></label><label className="text-sm">CVV de prueba<input autoComplete="off" inputMode="numeric" maxLength={4} value={cvv} onChange={(e) => setCvv(e.target.value)} className="block w-full mt-1 border rounded-lg px-3 py-2" placeholder="123" /></label></div></div>}
        </section></div>
      <aside className="bg-white rounded-2xl border border-gray-100 p-6"><h2 className="font-bold text-lg">Revisa tu pedido</h2><ul className="divide-y mt-3">{items.map((item) => { const imagen = resolverUrlImagen(item.imagen); return <li key={item.id_producto} className="py-3 flex items-center gap-3">{imagen ? <img src={imagen} alt="" className="w-14 h-14 rounded-lg object-contain bg-ferro-light p-1" /> : <div className="w-14 h-14 rounded-lg bg-ferro-light" />}<div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{item.nombre}</p><p className="text-xs text-gray-500">{item.codigo} · {item.cantidad} × ${item.precio.toFixed(2)}</p></div><span className="text-sm font-semibold">${(item.precio * item.cantidad).toFixed(2)}</span></li>; })}</ul><div className="flex justify-between border-t pt-4 mt-2 text-lg font-bold"><span>Total</span><span>${subtotal.toFixed(2)}</span></div><p className="text-xs text-gray-500 mt-2">Los precios y existencias se comprobarán de nuevo antes de registrar.</p>{error && <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}<button type="submit" disabled={cargando || !items.length || !fechaRetiro} className="w-full mt-5 bg-ferro-yellow hover:bg-ferro-yellow-dark rounded-lg py-3 font-bold disabled:opacity-50">{cargando ? "Procesando…" : "Confirmar pedido"}</button></aside>
    </form>}
  </div></main><Footer /></div>;
}
