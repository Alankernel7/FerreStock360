"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { obtenerProductoPublicoPorId } from "@/services/productosService";
import { obtenerCategorias } from "@/services/categoriasService";

import { resolverUrlImagen } from "@/lib/imagenes";

import type { Producto } from "@/types/producto";
import type { Categoria } from "@/types/categoria";
import { useCart } from "@/components/CartProvider";

export default function DetalleProductoPage() {
  const params = useParams();
  const id = Number(params.id);

  const [producto, setProducto] = useState<Producto | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagenActiva, setImagenActiva] = useState(0);
  const { agregar } = useCart();
  const [mensajeCarrito, setMensajeCarrito] = useState("");
  const [agregandoCarrito, setAgregandoCarrito] = useState(false);

  useEffect(() => {
    let activo = true;

    (async () => {
      if (!Number.isInteger(id) || id <= 0) {
        setError("El producto solicitado no es válido.");
        setCargando(false);
        return;
      }

      try {
        const [datosProducto, datosCategorias] = await Promise.all([
          obtenerProductoPublicoPorId(id),
          obtenerCategorias(),
        ]);

        if (!activo) return;

        setProducto(datosProducto);
        setCategorias(datosCategorias);
        setImagenActiva(0);
        setError(null);
      } catch (err) {
        if (!activo) return;

        const mensaje =
          err instanceof Error
            ? err.message
            : "No se pudo cargar el producto.";

        setError(
          mensaje.toLowerCase().includes("no encontrado")
            ? "Este producto no está disponible."
            : mensaje
        );
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [id]);

  const imagenes = useMemo(() => {
    if (!producto) return [];

    const rutas = [producto.imagen_1, producto.imagen_2]
      .map((ruta) => resolverUrlImagen(ruta))
      .filter((ruta): ruta is string => Boolean(ruta));

    // Evita miniaturas duplicadas cuando ambas columnas apuntan al mismo archivo.
    return [...new Set(rutas)];
  }, [producto]);

  const nombreCategoria = useMemo(() => {
    if (!producto) return null;

    return (
      categorias.find(
        (categoria) => categoria.id_categoria === producto.id_categoria
      )?.nombre ?? `Categoría #${producto.id_categoria}`
    );
  }, [categorias, producto]);

  const volverAlCatalogo = (
    <Link
      href="/#catalogo"
      className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ferro-black transition-colors"
    >
      <span aria-hidden="true">←</span>
      Volver al catálogo
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {cargando ? (
            <div>
              {volverAlCatalogo}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                <div className="h-80 sm:h-96 bg-ferro-light rounded-xl animate-pulse" />

                <div className="space-y-4">
                  <div className="h-6 w-32 bg-ferro-light rounded animate-pulse" />
                  <div className="h-10 w-3/4 bg-ferro-light rounded animate-pulse" />
                  <div className="h-6 w-40 bg-ferro-light rounded animate-pulse" />
                  <div className="h-32 w-full bg-ferro-light rounded animate-pulse" />
                </div>
              </div>
            </div>
          ) : error || !producto ? (
            <div className="max-w-xl mx-auto text-center py-16">
              <div className="w-16 h-16 mx-auto bg-ferro-light rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-ferro-gray"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>

              <h1 className="text-xl font-bold text-ferro-black mb-2">
                Producto no disponible
              </h1>

              <p className="text-gray-500 mb-6">
                {error ?? "No se pudo encontrar el producto solicitado."}
              </p>

              {volverAlCatalogo}
            </div>
          ) : (
            <>
              {volverAlCatalogo}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-6">
                {/* Galería */}
                <section aria-label="Imágenes del producto">
                  <div className="bg-ferro-light rounded-xl border border-gray-100 h-80 sm:h-[420px] flex items-center justify-center p-6">
                    {imagenes.length > 0 ? (
                      <img
                        src={imagenes[imagenActiva] ?? imagenes[0]}
                        alt={`${producto.nombre} - imagen ${imagenActiva + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <svg
                          className="w-16 h-16 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                        <p className="text-sm">Sin imagen disponible</p>
                      </div>
                    )}
                  </div>

                  {imagenes.length > 1 && (
                    <div className="mt-3 flex gap-3">
                      {imagenes.map((imagen, indice) => (
                        <button
                          key={imagen}
                          type="button"
                          onClick={() => setImagenActiva(indice)}
                          aria-label={`Ver imagen ${indice + 1}`}
                          aria-current={imagenActiva === indice}
                          className={`w-20 h-20 sm:w-24 sm:h-24 bg-ferro-light rounded-lg border p-2 flex items-center justify-center transition-all ${
                            imagenActiva === indice
                              ? "border-ferro-yellow ring-1 ring-ferro-yellow"
                              : "border-gray-100 hover:border-ferro-yellow"
                          }`}
                        >
                          <img
                            src={imagen}
                            alt={`${producto.nombre} - miniatura ${indice + 1}`}
                            className="max-w-full max-h-full object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Información */}
                <section aria-label="Información del producto">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-ferro-gray bg-ferro-light px-2 py-1 rounded-full">
                      {nombreCategoria}
                    </span>

                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                      {producto.estado ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-ferro-black">
                    {producto.nombre}
                  </h1>

                  <p className="text-sm text-gray-500 mt-2">
                    Código:{" "}
                    <span className="font-medium text-ferro-gray">
                      {producto.codigo}
                    </span>
                  </p>

                  <p className="text-3xl font-bold text-ferro-black mt-4">
                    ${Number(producto.precio).toFixed(2)}
                  </p>

                  <div className="mt-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                        (producto.disponible ?? ((producto.stock_disponible ?? producto.stock_actual ?? 0) > 0))
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          (producto.disponible ?? ((producto.stock_disponible ?? producto.stock_actual ?? 0) > 0))
                            ? "bg-green-600"
                            : "bg-red-600"
                        }`}
                        aria-hidden="true"
                      />
                      {(producto.disponible ?? ((producto.stock_disponible ?? producto.stock_actual ?? 0) > 0))
                        ? "Disponible"
                        : "Agotado"}
                    </span>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h2 className="text-sm font-semibold text-ferro-black mb-2">
                      Descripción
                    </h2>

                    <p className="text-gray-600 whitespace-pre-line leading-relaxed">
                      {producto.descripcion?.trim() ||
                        "Sin descripción disponible."}
                    </p>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      disabled={agregandoCarrito || !producto.estado || !(producto.disponible ?? ((producto.stock_disponible ?? producto.stock_actual ?? 0) > 0))}
                      aria-busy={agregandoCarrito}
                      onClick={async () => {
                        if (agregandoCarrito) return;
                        setAgregandoCarrito(true);
                        setMensajeCarrito("");
                        try {
                          await agregar(producto);
                          setMensajeCarrito("Producto agregado al carrito.");
                        } catch (error) {
                          setMensajeCarrito(error instanceof Error ? error.message : "No se pudo agregar el producto.");
                        } finally {
                          setAgregandoCarrito(false);
                        }
                      }}
                      className="w-full sm:w-auto bg-ferro-yellow text-ferro-black font-semibold px-6 py-3 rounded-lg hover:bg-ferro-yellow-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {agregandoCarrito ? "Agregando…" : "Agregar al carrito"}
                    </button>

                    {mensajeCarrito && <p role="status" className={`text-sm mt-2 ${mensajeCarrito.startsWith("Producto agregado") ? "text-emerald-700" : "text-red-700"}`}>{mensajeCarrito} {mensajeCarrito.startsWith("Producto agregado") && <Link href="/carrito" className="underline">Ver carrito</Link>}</p>}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
