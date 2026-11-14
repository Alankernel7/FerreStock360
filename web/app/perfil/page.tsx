"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import type { UsuarioAutenticado } from "@/types/auth";
import { cerrarSesion, obtenerSesionValida } from "@/services/authService";

export default function PerfilPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    let activo = true;

    (async () => {
      const sesion = obtenerSesionValida();

      if (!activo) return;

      if (!sesion) {
        router.replace("/login");
        return;
      }

      setUsuario(sesion.usuario);
      setVerificando(false);
    })();

    return () => {
      activo = false;
    };
  }, [router]);

  const handleCerrarSesion = () => {
    cerrarSesion();
    router.replace("/");
  };

  const inicial = usuario?.nombre?.trim().charAt(0).toUpperCase() ?? "";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-ferro-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {verificando || !usuario ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-gray-500">Verificando sesión...</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-ferro-black px-6 py-8 flex items-center gap-4">
                <div className="w-16 h-16 bg-ferro-yellow rounded-full flex items-center justify-center text-ferro-black font-bold text-2xl flex-shrink-0">
                  {inicial}
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Bienvenido,</p>
                  <h1 className="text-2xl font-bold text-white truncate">
                    {usuario.nombre}
                  </h1>
                  <p className="text-sm text-gray-400 capitalize">
                    {usuario.rol}
                  </p>
                </div>
              </div>

              <div className="p-6">
                <h2 className="text-lg font-semibold text-ferro-black mb-4">
                  Información de la cuenta
                </h2>

                <dl className="divide-y divide-gray-100">
                  <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <dt className="text-sm text-gray-500">Nombre completo</dt>
                    <dd className="font-medium text-ferro-black">
                      {usuario.nombre}
                    </dd>
                  </div>

                  <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <dt className="text-sm text-gray-500">
                      Correo electrónico
                    </dt>
                    <dd className="font-medium text-ferro-black break-all">
                      {usuario.email}
                    </dd>
                  </div>

                  <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <dt className="text-sm text-gray-500">Rol</dt>
                    <dd className="font-medium text-ferro-black capitalize">
                      {usuario.rol}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-gray-100">
                  {usuario.rol === "admin" && (
                    <Link
                      href="/dashboard"
                      className="bg-ferro-yellow text-ferro-black font-semibold px-5 py-2 rounded-lg hover:bg-ferro-yellow-dark transition-colors"
                    >
                      Ir al panel de administración
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleCerrarSesion}
                    className="px-5 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
