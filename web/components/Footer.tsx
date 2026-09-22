"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { EstadisticasPublicas } from "@/types/estadisticasPublicas";

import {
  obtenerEstadisticasPublicas,
} from "@/services/estadisticasPublicasService";

export default function Footer() {
  const [email, setEmail] = useState("");

  const [estadisticas, setEstadisticas] =
  useState<EstadisticasPublicas | null>(null);

useEffect(() => {
  const cargarEstadisticas = async () => {
    try {
      const data = await obtenerEstadisticasPublicas();
      setEstadisticas(data);
    } catch (error) {
      console.error(
        "No se pudieron cargar las estadísticas:",
        error
      );
    }
  };

  cargarEstadisticas();
}, []);

  return (
    <footer className="bg-ferro-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-ferro-yellow font-bold text-xl mb-4">
              FerreStock <span className="text-white">360</span>
            </h3>
            <p className="text-gray-400 text-sm">
              Tu ferretería, siempre contigo. Gestión de inventario inteligente para tu negocio.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <span className="text-2xl font-bold text-ferro-yellow">{estadisticas  ? estadisticas.total_productos : "—"}+</span>
              <span className="text-sm text-gray-400">Productos</span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Enlaces</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/" className="hover:text-ferro-yellow transition-colors">Inicio</Link></li>
              <li><Link href="/login" className="hover:text-ferro-yellow transition-colors">Iniciar Sesión</Link></li>
              <li><Link href="/register" className="hover:text-ferro-yellow transition-colors">Registrarse</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contáctanos</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>📍 Calle Principal #123</li>
              <li>📞 01-123-456-7890</li>
              <li>✉️ info@ferrestock.com</li>
              <li>🕐 Lun - Sáb: 8:00 Am - 6:00 Pm</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-ferro-gray mt-8 pt-8 text-center text-sm text-gray-400">
          © 2026 FerreStock 360. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
