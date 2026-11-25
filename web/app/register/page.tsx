"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { EstadisticasPublicas } from "@/types/estadisticasPublicas";
import { obtenerEstadisticasPublicas } from "@/services/estadisticasPublicasService";
import { registrarUsuario } from "@/services/authService";

const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [estadisticas, setEstadisticas] = useState<EstadisticasPublicas | null>(null);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(true);
  const [errorEstadisticas, setErrorEstadisticas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    obtenerEstadisticasPublicas()
      .then((data) => {
        if (activo) {
          setEstadisticas(data);
          setErrorEstadisticas(data === null);
        }
      })
      .catch((err) => {
        console.error("[registro] Falló la carga opcional de estadísticas:", err);
        if (activo) setErrorEstadisticas(true);
      })
      .finally(() => { if (activo) setCargandoEstadisticas(false); });
    return () => { activo = false; };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const nombre = name.trim();
    const correo = email.trim().toLowerCase();
    const passwordBytes = new TextEncoder().encode(password).length;

    if (!nombre || nombre.length > 100) {
      setError("Ingresa tu nombre (máximo 100 caracteres).");
      return;
    }
    if (correo.length > 150 || !emailValido.test(correo)) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }
    if (passwordBytes < 8 || passwordBytes > 72 ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("La contraseña debe tener entre 8 y 72 bytes e incluir minúscula, mayúscula y número.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setCargando(true);
      await registrarUsuario(nombre, correo, password);
      setMensaje("Cuenta creada. Revisa tu correo para verificarlo; ya puedes iniciar sesión.");
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => router.push("/login"), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al crear la cuenta.");
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

          <h2 className="text-2xl font-bold text-ferro-black mb-2">Crea tu cuenta</h2>
          <p className="text-gray-500 mb-8">Regístrate para explorar el catálogo y realizar tus compras.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
            {mensaje && <div role="status" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{mensaje}</div>}

            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-2">Nombre completo</label>
              <input id="register-name" type="text" value={name} onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre" maxLength={100} autoComplete="name" required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent" />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-2">Correo electrónico</label>
              <input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@correo.com" maxLength={150} autoComplete="email" required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent" />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <div className="relative">
                <input id="register-password" type={showPassword ? "text" : "password"} value={password}
                  onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password" minLength={8} required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700">
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Incluye una mayúscula, una minúscula y un número.</p>
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">Confirmar contraseña</label>
              <input id="register-confirm-password" type={showPassword ? "text" : "password"}
                value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirma tu contraseña" autoComplete="new-password" minLength={8} required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent" />
            </div>

            <button type="submit" disabled={cargando}
              className="w-full bg-ferro-yellow text-ferro-black font-semibold py-3 rounded-lg hover:bg-ferro-yellow-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {cargando ? "Creando cuenta..." : "Registrarse"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-ferro-yellow font-medium hover:underline">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
