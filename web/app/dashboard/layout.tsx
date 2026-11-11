"use client";

import Sidebar from "@/components/Sidebar";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { UsuarioAutenticado } from "@/types/auth";

import {
  obtenerToken,
  obtenerUsuarioGuardado,
} from "@/services/authService";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  
  const router = useRouter();

  const [usuario, setUsuario] =
    useState<UsuarioAutenticado | null>(null);

  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const token = obtenerToken();
    const usuarioGuardado = obtenerUsuarioGuardado();

    if (!token || !usuarioGuardado) {
      router.replace("/login");
      return;
    }

    if (usuarioGuardado.rol !== "admin") {
      router.replace("/");
      return;
    }

    setUsuario(usuarioGuardado);
    setVerificando(false);
  }, [router]);

  if (verificando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ferro-light">
        <p className="text-gray-500">
          Verificando sesión...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ferro-light">
      <Sidebar usuario={usuario} />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Buscar productos..."
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow w-64"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-500 hover:text-ferro-yellow">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-ferro-yellow rounded-full flex items-center justify-center">
                  <span className="text-ferro-black font-bold text-sm">{usuario.nombre.charAt(0).toUpperCase()}</span>
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium">{usuario.nombre}</p>
                  <p className="text-xs text-gray-500">{usuario.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
