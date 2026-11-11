"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-ferro-black text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-ferro-yellow font-bold text-xl">
              FerreStock <span className="text-white">360</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="hover:text-ferro-yellow transition-colors">Inicio</Link>
            <Link href="/login" className="hover:text-ferro-yellow transition-colors">Iniciar Sesión</Link>
            <Link href="/register" className="hover:text-ferro-yellow transition-colors">Registrarse</Link>
          </nav>

          <button
            className="md:hidden text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4">
            <Link href="/" className="block py-2 hover:text-ferro-yellow">Inicio</Link>
            <Link href="/login" className="block py-2 hover:text-ferro-yellow">Iniciar Sesión</Link>
            <Link href="/register" className="block py-2 hover:text-ferro-yellow">Registrarse</Link>
          </div>
        )}
      </div>
    </header>
  );
}
