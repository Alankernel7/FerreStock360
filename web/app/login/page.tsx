"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { accesoFirebase, firebaseDisponible, recuperarAcceso } from "@/services/firebaseClient";

import type { EstadisticasPublicas } from "@/types/estadisticasPublicas";

import {
  obtenerEstadisticasPublicas,
} from "@/services/estadisticasPublicasService";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [recordarme, setRecordarme] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [estadisticas, setEstadisticas] =
  useState<EstadisticasPublicas | null>(null);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(true);
  const [errorEstadisticas, setErrorEstadisticas] = useState(false);

  useEffect(() => {
    let activo = true;
    const cargarEstadisticas = async () => {
      try {
        const data =
          await obtenerEstadisticasPublicas();

        if (activo) {
          setEstadisticas(data);
          setErrorEstadisticas(data === null);
        }
      } catch (error) {
        console.error("[login] Falló la carga opcional de estadísticas:", error);
        if (activo) setErrorEstadisticas(true);
      } finally {
        if (activo) setCargandoEstadisticas(false);
      }
    };

    void cargarEstadisticas();
    return () => { activo = false; };
  }, []);

  const [aviso, setAviso] = useState("");
  const integrado = firebaseDisponible;
  const handleSubmit = async (event?: FormEvent<HTMLFormElement>, google = false) => {
    event?.preventDefault();
    setAviso("");

    setError(null);

    if (!google && !email.trim()) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    if (!google && !password) {
      setError("Ingresa tu contraseña.");
      return;
    }

    try {
      setCargando(true);

      if (!integrado) throw new Error("Configura Firebase Authentication para esta web.");
      const data = await accesoFirebase(email.trim(), password, recordarme, google);

      const almacenamiento = recordarme
        ? localStorage
        : sessionStorage;

      // Limpia una sesión anterior del otro almacenamiento.
      localStorage.removeItem("auth_token");
      localStorage.removeItem("usuario");

      sessionStorage.removeItem("auth_token");
      sessionStorage.removeItem("usuario");

      almacenamiento.setItem(
        "auth_token",
        data.token
      );

      almacenamiento.setItem(
        "usuario",
        JSON.stringify(data.usuario)
      );
      window.dispatchEvent(new Event("auth:changed"));

      const destinoSolicitado = new URLSearchParams(window.location.search).get("next");
      const esDestinoInterno = destinoSolicitado?.startsWith("/") && !destinoSolicitado.startsWith("//");
      const esRutaPermitidaParaRol = data.usuario.rol === "admin" || !destinoSolicitado?.startsWith("/dashboard");
      if (destinoSolicitado && esDestinoInterno && esRutaPermitidaParaRol) {
        router.push(destinoSolicitado);
        return;
      }

      if (data.usuario.rol === "admin") {
        router.push("/dashboard");
        return;
      }

      if (data.usuario.rol === "cliente") {
        router.push("/");
        return;
      }

      setError("El usuario no tiene un rol válido.");
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al iniciar sesión.";

      setError(mensaje);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-ferro-black relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ferro-black via-ferro-dark to-ferro-black" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-32 h-32 bg-ferro-yellow/30 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-ferro-yellow/20 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            FerreStock <span className="text-ferro-yellow">360</span>
          </h1>
          <p className="text-gray-400 text-lg">Tu ferretería, siempre contigo</p>
          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="text-center">
              <p className="text-3xl font-bold text-ferro-yellow" aria-live="polite" title={errorEstadisticas ? "Estadísticas temporalmente no disponibles" : undefined}>{estadisticas ? estadisticas.total_productos : "—"}</p>
              <p className="text-sm text-gray-400">Productos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-ferro-yellow" aria-live="polite" title={errorEstadisticas ? "Estadísticas temporalmente no disponibles" : undefined}>{estadisticas ? estadisticas.total_categorias : "—"}</p>
              <p className="text-sm text-gray-400">Categorías</p>
            </div>
            {cargandoEstadisticas && <p className="sr-only" aria-live="polite">Cargando estadísticas públicas.</p>}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-ferro-black">
              FerreStock <span className="text-ferro-yellow">360</span>
            </h1>
          </div>

          <h2 className="text-2xl font-bold text-ferro-black mb-2">Bienvenido</h2>
          <p className="text-gray-500 mb-8">Inicia sesión en tu cuenta</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Correo electrónico</label>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@correo.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />                
              <span className="text-sm text-gray-600">Recordarme</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-ferro-yellow text-ferro-black font-semibold py-3 rounded-lg hover:bg-ferro-yellow-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando
                ? "Iniciando sesión..."
                : "Iniciar sesión"}
            </button>
          </form>
          {integrado && <div className="mt-4 grid gap-3">
            <button type="button" disabled={cargando} onClick={() => void handleSubmit(undefined,true)} className="rounded-lg border p-3">Continuar con Google</button>
            <button type="button" disabled={cargando} onClick={async () => {
              setError(null); setAviso("");
              if (!email.trim()) { setError("Escribe tu correo para recuperar la contraseña."); return; }
              try {
                await recuperarAcceso(email.trim());
                setAviso("Si el correo corresponde a una cuenta, recibirás instrucciones de recuperación.");
              } catch { setError("No se pudo solicitar la recuperación."); }
            }}>Recuperar contraseña</button>
            {aviso && <p role="status">{aviso}</p>}
          </div>}

          <p className="text-center mt-6 text-sm text-gray-500">
            ¿No tienes una cuenta?{" "}
            <Link href="/register" className="text-ferro-yellow font-medium hover:underline">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
