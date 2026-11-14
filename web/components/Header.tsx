"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { UsuarioAutenticado } from "@/types/auth";
import {
  cerrarSesion,
  obtenerSesionValida,
} from "@/services/authService";

export default function Header() {
  const router = useRouter();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [montado, setMontado] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);

  const cuentaRef = useRef<HTMLDivElement>(null);

  // Recupera la sesión válida al montar (valida la expiración del token).
  // Se usa una IIFE para no invocar setState de forma síncrona en el efecto.
  useEffect(() => {
    let activo = true;

    (async () => {
      const sesion = obtenerSesionValida();
      if (!activo) return;
      setUsuario(sesion ? sesion.usuario : null);
      setMontado(true);
    })();

    return () => {
      activo = false;
    };
  }, []);

  // Cierra el menú de cuenta al hacer clic fuera de él.
  useEffect(() => {
    if (!cuentaAbierta) return;

    const handleClickFuera = (event: MouseEvent) => {
      if (
        cuentaRef.current &&
        !cuentaRef.current.contains(event.target as Node)
      ) {
        setCuentaAbierta(false);
      }
    };

    document.addEventListener("mousedown", handleClickFuera);

    return () => {
      document.removeEventListener("mousedown", handleClickFuera);
    };
  }, [cuentaAbierta]);

  const handleCerrarSesion = () => {
    cerrarSesion();
    setUsuario(null);
    setCuentaAbierta(false);
    setMenuAbierto(false);
    router.push("/");
  };

  const inicial = usuario?.nombre?.trim().charAt(0).toUpperCase() ?? "";

  return (
    <header className="bg-ferro-black text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-ferro-yellow font-bold text-xl">
              FerreStock <span className="text-white">360</span>
            </span>
          </Link>

          {/* Navegación de escritorio */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="hover:text-ferro-yellow transition-colors"
            >
              Inicio
            </Link>

            <Link
              href="/#catalogo"
              className="hover:text-ferro-yellow transition-colors"
            >
              Catálogo
            </Link>

            {!montado ? (
              // Reserva el espacio para evitar saltos mientras se lee la sesión.
              <span className="inline-block w-40 h-8" aria-hidden="true" />
            ) : usuario ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-300">
                  Bienvenido,{" "}
                  <span className="text-ferro-yellow font-medium">
                    {usuario.nombre}
                  </span>
                </span>

                <div className="relative" ref={cuentaRef}>
                  <button
                    type="button"
                    onClick={() => setCuentaAbierta((valor) => !valor)}
                    aria-haspopup="menu"
                    aria-expanded={cuentaAbierta}
                    aria-label="Abrir menú de cuenta"
                    className="w-10 h-10 bg-ferro-yellow rounded-full flex items-center justify-center text-ferro-black font-bold hover:opacity-90 transition"
                  >
                    {inicial}
                  </button>

                  {cuentaAbierta && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-72 bg-white text-ferro-black rounded-xl shadow-lg border border-gray-100 overflow-hidden"
                    >
                      <div className="px-4 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-ferro-yellow rounded-full flex items-center justify-center font-bold flex-shrink-0">
                            {inicial}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">
                              Bienvenido,
                            </p>
                            <p className="font-semibold truncate">
                              {usuario.nombre}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="px-4 py-3 text-sm">
                        <p className="text-xs text-gray-500">Nombre completo</p>
                        <p className="font-medium">{usuario.nombre}</p>

                        <p className="text-xs text-gray-500 mt-2">
                          Correo electrónico
                        </p>
                        <p className="font-medium break-all">
                          {usuario.email}
                        </p>

                        <p className="text-xs text-gray-500 mt-2">Rol</p>
                        <p className="font-medium capitalize">{usuario.rol}</p>
                      </div>

                      <div className="border-t border-gray-100">
                        <Link
                          href="/perfil"
                          role="menuitem"
                          onClick={() => setCuentaAbierta(false)}
                          className="block px-4 py-3 text-sm hover:bg-ferro-light transition-colors"
                        >
                          Mi perfil
                        </Link>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleCerrarSesion}
                          className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Cerrar sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hover:text-ferro-yellow transition-colors"
                >
                  Iniciar Sesión
                </Link>

                <Link
                  href="/register"
                  className="hover:text-ferro-yellow transition-colors"
                >
                  Registrarse
                </Link>
              </>
            )}
          </nav>

          {/* Botón de menú móvil */}
          <button
            type="button"
            className="md:hidden text-white"
            onClick={() => setMenuAbierto(!menuAbierto)}
            aria-label="Abrir menú de navegación"
            aria-expanded={menuAbierto}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {menuAbierto ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Navegación móvil */}
        {menuAbierto && (
          <div className="md:hidden pb-4 border-t border-ferro-gray mt-1 pt-2 space-y-1">
            <Link
              href="/"
              onClick={() => setMenuAbierto(false)}
              className="block py-2 hover:text-ferro-yellow transition-colors"
            >
              Inicio
            </Link>

            <Link
              href="/#catalogo"
              onClick={() => setMenuAbierto(false)}
              className="block py-2 hover:text-ferro-yellow transition-colors"
            >
              Catálogo
            </Link>

            {montado &&
              (usuario ? (
                <div className="pt-3 mt-2 border-t border-ferro-gray">
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-10 h-10 bg-ferro-yellow rounded-full flex items-center justify-center text-ferro-black font-bold flex-shrink-0">
                      {inicial}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {usuario.nombre}
                      </p>
                      <p className="text-xs text-gray-400 break-all">
                        {usuario.email}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">
                        {usuario.rol}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/perfil"
                    onClick={() => setMenuAbierto(false)}
                    className="block py-2 hover:text-ferro-yellow transition-colors"
                  >
                    Mi perfil
                  </Link>

                  <button
                    type="button"
                    onClick={handleCerrarSesion}
                    className="block w-full text-left py-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuAbierto(false)}
                    className="block py-2 hover:text-ferro-yellow transition-colors"
                  >
                    Iniciar Sesión
                  </Link>

                  <Link
                    href="/register"
                    onClick={() => setMenuAbierto(false)}
                    className="block py-2 hover:text-ferro-yellow transition-colors"
                  >
                    Registrarse
                  </Link>
                </>
              ))}
          </div>
        )}
      </div>
    </header>
  );
}
