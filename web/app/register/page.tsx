"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
          <p className="text-gray-400 text-lg">Únete y gestiona tu inventario</p>
          <div className="flex gap-8 mt-12">
            <div className="text-center">
              <p className="text-3xl font-bold text-ferro-yellow">360+</p>
              <p className="text-sm text-gray-400">Productos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-ferro-yellow">50+</p>
              <p className="text-sm text-gray-400">Categorías</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-ferro-yellow">99%</p>
              <p className="text-sm text-gray-400">Confianza</p>
            </div>
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
          <p className="text-gray-500 mb-8">Únete y gestiona tu inventario</p>

          <form className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
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
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar contraseña</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu contraseña"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-ferro-yellow text-ferro-black font-semibold py-3 rounded-lg hover:bg-ferro-yellow-dark transition-colors"
            >
              Registrarse
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-ferro-yellow font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
