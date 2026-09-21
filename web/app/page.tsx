"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { obtenerProductos } from "@/services/ProductosService";
import type { Producto } from "@/types/producto";

const categories = [
  "Herramientas",
  "Pintura",
  "Plomería",
  "Electricidad",
  "Construcción",
  "Jardín",
];


export default function HomePage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarProductos = async () => {
      try {
        setCargando(true);

        const datos = await obtenerProductos();

        setProductos(datos);
        setError(null);
      } catch (err) {
        console.error("Error al cargar productos:", err);
        setError("No se pudieron cargar los productos.");
      } finally {
        setCargando(false);
      }
    };

    cargarProductos();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="bg-ferro-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                STORE
              </h1>
              <p className="text-gray-400 text-lg">
                Tu ferretería, siempre contigo. Encuentra las mejores herramientas y materiales.
              </p>
              <div className="flex items-center gap-2 mt-4 text-sm text-gray-400">
                <span>You are here:</span>
                <span className="text-ferro-yellow">Home</span>
                <span>/</span>
                <span>Products</span>
              </div>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="w-64 h-64 bg-ferro-yellow/20 rounded-full flex items-center justify-center">
                <svg className="w-32 h-32 text-ferro-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 flex-shrink-0">
              <div className="mb-8">
                <input
                  type="text"
                  placeholder="Search Products..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
                />
              </div>

              <div className="mb-8">
                <h3 className="font-bold text-lg mb-4">CATEGORIES</h3>
                <ul className="space-y-2">
                  {categories.map((cat) => (
                    <li key={cat}>
                      <a href="#" className="text-gray-600 hover:text-ferro-yellow transition-colors">
                        {cat}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-4">FEATURED PRODUCTS</h3>
                <div className="space-y-4">
                  {productos.slice(0, 3).map((producto) => (
                    <div
                      key={producto.id_producto}
                      className="flex items-center gap-3"
                    >
                      <div className="w-12 h-12 bg-ferro-light rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {producto.imagen_url ? (
                          <img
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <svg
                            className="w-6 h-6 text-ferro-gray"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          {producto.nombre}
                        </p>

                        <p className="text-sm text-ferro-yellow font-bold">
                          ${Number(producto.precio).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <p className="text-gray-500">{productos.length} productos encontrados</p>                
                <select className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow">
                  <option>Default sorting</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {cargando ? (
                  <p className="text-gray-500">
                    Cargando productos...
                  </p>
                ) : error ? (
                  <p className="text-red-500">
                    {error}
                  </p>
                ) : productos.length === 0 ? (
                  <p className="text-gray-500">
                    No hay productos disponibles.
                  </p>
                ) : (
                  productos.map((producto) => (
                    <ProductCard
                      key={producto.id_producto}
                      name={producto.nombre}
                      price={Number(producto.precio)}
                      image={producto.imagen_url ?? undefined}
                    />
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 mt-8 justify-center">
                <button className="w-10 h-10 bg-ferro-yellow text-ferro-black font-bold rounded-lg">1</button>
                <button className="w-10 h-10 border border-gray-200 rounded-lg hover:border-ferro-yellow transition-colors">2</button>
                <button className="w-10 h-10 border border-gray-200 rounded-lg hover:border-ferro-yellow transition-colors">→</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
