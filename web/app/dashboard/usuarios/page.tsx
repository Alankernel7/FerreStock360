"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { obtenerUsuarioGuardado } from "@/services/authService";
import { cambiarEstadoUsuario, consultarUsuarios, guardarUsuario } from "@/services/usuariosService";
import type { UsuarioAdministrable, UsuariosData } from "@/types/usuario";

const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-ferro-yellow focus:ring-2 focus:ring-ferro-yellow/30";
const vacio = { nombre: "", email: "", password: "", id_rol: "", estado: true };

export default function UsuariosPage() {
  const [data, setData] = useState<UsuariosData | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState("");
  const [estado, setEstado] = useState("todos");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioAdministrable | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const yo = typeof window === "undefined" ? null : obtenerUsuarioGuardado();

  const params = useMemo(() => {
    const result = new URLSearchParams();
    if (busqueda.trim()) result.set("q", busqueda.trim());
    if (rol) result.set("rol", rol);
    if (estado !== "todos") result.set("estado", estado);
    return result;
  }, [busqueda, rol, estado]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setData(await consultarUsuarios(params));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios");
    } finally {
      setCargando(false);
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  function abrirCrear() {
    setUsuarioEditando(null);
    setModalAbierto(true);
    setForm({ ...vacio, id_rol: String(data?.roles[0]?.id_rol ?? "") });
    setError("");
    setMensaje("");
  }

  function abrirEditar(usuario: UsuarioAdministrable) {
    setUsuarioEditando(usuario);
    setModalAbierto(true);
    setForm({ nombre: usuario.nombre, email: usuario.email, password: "", id_rol: String(usuario.id_rol), estado: usuario.estado });
    setError("");
    setMensaje("");
  }

  const editaSuCuenta = Boolean(usuarioEditando && yo?.id_usuario === usuarioEditando.id_usuario);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const payload = {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        id_rol: Number(form.id_rol),
        estado: form.estado,
        ...(!usuarioEditando || form.password ? { password: form.password } : {}),
      };
      await guardarUsuario(usuarioEditando?.id_usuario ?? null, {
        ...payload,
        id_rol: editaSuCuenta && usuarioEditando ? usuarioEditando.id_rol : payload.id_rol,
      });
      setUsuarioEditando(null);
      setModalAbierto(false);
      setMensaje(usuarioEditando ? "Usuario actualizado correctamente." : "Usuario creado correctamente.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el usuario");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(usuario: UsuarioAdministrable) {
    const nuevoEstado = !usuario.estado;
    const accion = nuevoEstado ? "activar" : "desactivar";
    if (!window.confirm(`¿Confirmas ${accion} a ${usuario.nombre}?`)) return;
    setError("");
    setMensaje("");
    try {
      await cambiarEstadoUsuario(usuario.id_usuario, nuevoEstado);
      setMensaje(`Usuario ${nuevoEstado ? "activado" : "desactivado"} correctamente.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-ferro-black">Administración de usuarios</h1><p className="mt-1 text-sm text-gray-500">Cuentas, roles y acceso al sistema</p></div><button onClick={abrirCrear} className="rounded-lg bg-ferro-yellow px-4 py-2.5 text-sm font-bold text-ferro-black hover:brightness-95">Crear usuario</button></div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {mensaje && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{mensaje}</p>}

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3">
        <label className="sm:col-span-1"><span className="mb-1 block text-xs font-medium text-gray-600">Buscar nombre o correo</span><input className={inputClass} value={busqueda} maxLength={150} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o correo" /></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Rol</span><select className={inputClass} value={rol} onChange={(e) => setRol(e.target.value)}><option value="">Todos los roles</option>{data?.roles.map((item) => <option key={item.id_rol} value={item.id_rol}>{item.nombre}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-medium text-gray-600">Estado</span><select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-4 py-3"><h2 className="font-semibold text-ferro-black">Usuarios <span className="ml-1 text-sm font-normal text-gray-500">({data?.usuarios.length ?? 0})</span></h2></div>
        {cargando ? <p className="p-8 text-center text-sm text-gray-500">Cargando usuarios…</p> : data?.usuarios.length ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Registro</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody className="divide-y divide-gray-100">{data.usuarios.map((usuario) => <tr key={usuario.id_usuario} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-900">{usuario.nombre}{usuario.id_usuario === yo?.id_usuario && <span className="ml-2 text-xs text-gray-500">(tú)</span>}</td><td className="px-4 py-3 text-gray-600">{usuario.email}</td><td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">{usuario.rol}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${usuario.estado ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>{usuario.estado ? "Activo" : "Inactivo"}</span></td><td className="px-4 py-3 text-gray-600">{usuario.fecha_creacion ? new Intl.DateTimeFormat("es-SV", { dateStyle: "medium" }).format(new Date(usuario.fecha_creacion)) : "—"}</td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => abrirEditar(usuario)} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-50">Editar</button><button disabled={usuario.id_usuario === yo?.id_usuario && usuario.estado} onClick={() => void cambiarEstado(usuario)} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">{usuario.estado ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-gray-500">No hay usuarios que coincidan con los filtros.</p>}
      </div>

      {modalAbierto && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalAbierto(false); }}><div role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="user-form-title" className="text-lg font-bold text-ferro-black">{usuarioEditando ? "Editar usuario" : "Crear usuario"}</h2><p className="mt-1 text-sm text-gray-500">La contraseña nunca se muestra al editar.</p></div><button type="button" aria-label="Cerrar" onClick={() => setModalAbierto(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100">✕</button></div><form className="space-y-4" onSubmit={enviar}><label className="block"><span className="mb-1 block text-sm font-medium">Nombre completo</span><input className={inputClass} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={100} required /></label><label className="block"><span className="mb-1 block text-sm font-medium">Correo electrónico</span><input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={150} required /></label>{!usuarioEditando && <label className="block"><span className="mb-1 block text-sm font-medium">Contraseña</span><input className={inputClass} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} maxLength={72} required /><span className="mt-1 block text-xs text-gray-500">Mínimo 6 caracteres.</span></label>}<label className="block"><span className="mb-1 block text-sm font-medium">Rol</span><select className={`${inputClass} ${editaSuCuenta ? "cursor-not-allowed bg-gray-100 text-gray-600" : ""}`} value={form.id_rol} onChange={(e) => setForm({ ...form, id_rol: e.target.value })} disabled={editaSuCuenta} required><option value="" disabled>Seleccionar rol</option>{data?.roles.map((item) => <option key={item.id_rol} value={item.id_rol}>{item.nombre}</option>)}</select>{editaSuCuenta && <span className="mt-1 block text-xs text-amber-700">No puedes modificar tu propio rol</span>}</label><label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"><input type="checkbox" checked={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.checked })} className="h-4 w-4 accent-yellow-500" /><span className="text-sm font-medium">Cuenta activa</span></label><div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModalAbierto(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={guardando} className="rounded-lg bg-ferro-yellow px-4 py-2.5 text-sm font-bold text-ferro-black disabled:opacity-60">{guardando ? "Guardando…" : usuarioEditando ? "Guardar cambios" : "Crear usuario"}</button></div></form></div></div>}
    </section>
  );
}
