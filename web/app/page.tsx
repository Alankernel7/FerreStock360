"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";

import { obtenerProductosPublicos } from "@/services/productosService";
import { obtenerCategorias } from "@/services/categoriasService";

import type { Producto } from "@/types/producto";
import type { Categoria } from "@/types/categoria";

type Orden =
  | "recientes"
  | "precio-asc"
  | "precio-desc"
  | "nombre-asc"
  | "nombre-desc";

const NUEVOS_LIMITE = 4;

export default function HomePage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controles del catálogo
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<
    number | null
  >(null);
  const [orden, setOrden] = useState<Orden>("recientes");

  // Carga única del catálogo público (solo activos) y las categorías reales.
  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const [datosProductos, datosCategorias] = await Promise.all([
          obtenerProductosPublicos(),
          obtenerCategorias(),
        ]);

        if (!activo) return;

        setProductos(datosProductos);
        setCategorias(datosCategorias);
        setError(null);
      } catch (err) {
        console.error("Error al cargar el catálogo:", err);
        if (activo) setError("No se pudieron cargar los productos.");
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  // id_categoria → nombre real (para mostrar la categoría en las tarjetas).
  const nombreCategoria = useMemo(() => {
    const mapa = new Map<number, string>();
    categorias.forEach((categoria) =>
      mapa.set(categoria.id_categoria, categoria.nombre)
    );
    return mapa;
  }, [categorias]);

  // Cantidad de productos activos por categoría.
  const conteoPorCategoria = useMemo(() => {
    const mapa = new Map<number, number>();
    productos.forEach((producto) =>
      mapa.set(
        producto.id_categoria,
        (mapa.get(producto.id_categoria) ?? 0) + 1
      )
    );
    return mapa;
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = productos.filter((producto) => {
      const coincideTexto =
        !texto ||
        producto.nombre.toLowerCase().includes(texto) ||
        producto.codigo.toLowerCase().includes(texto);

      const coincideCategoria =
        categoriaSeleccionada === null ||
        producto.id_categoria === categoriaSeleccionada;

      return coincideTexto && coincideCategoria;
    });

    const ordenados = [...filtrados];

    ordenados.sort((a, b) => {
      switch (orden) {
        case "precio-asc":
          return Number(a.precio) - Number(b.precio);
        case "precio-desc":
          return Number(b.precio) - Number(a.precio);
        case "nombre-asc":
          return a.nombre.localeCompare(b.nombre);
        case "nombre-desc":
          return b.nombre.localeCompare(a.nombre);
        case "recientes":
        default:
          return (
            new Date(b.fecha_creacion).getTime() -
            new Date(a.fecha_creacion).getTime()
          );
      }
    });

    return ordenados;
  }, [productos, busqueda, categoriaSeleccionada, orden]);

  // Productos agregados recientemente (por fecha real de creación).
  const nuevosProductos = useMemo(() => {
    return [...productos]
      .sort(
        (a, b) =>
          new Date(b.fecha_creacion).getTime() -
          new Date(a.fecha_creacion).getTime()
      )
      .slice(0, NUEVOS_LIMITE);
  }, [productos]);

  const seleccionarCategoria = (id: number | null) => {
    setCategoriaSeleccionada(id);
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  };

  const hayFiltros = busqueda.trim() !== "" || categoriaSeleccionada !== null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Banner oficial FerreStock360 (identidad, herramientas y mensaje comercial) */}
      <section className="w-full bg-ferro-yellow">
        <Image
          src="/imagenes/banner_ferrestock360.png"
          alt="Banner FerreStock360 - Tu ferretería, siempre contigo"
          width={1983}
          height={793}
          sizes="100vw"
          className="w-full h-auto block"
          priority
        />
      </section>

      <main className="flex-1 bg-white">
        {/* D. Categorías */}
        <section
          id="categorias"
          className="scroll-mt-20 bg-ferro-light border-b border-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-ferro-black">
                  Categorías
                </h2>
                <p className="text-gray-500 mt-1">
                  Filtra el catálogo por categoría
                </p>
              </div>

              {categoriaSeleccionada !== null && (
                <button
                  type="button"
                  onClick={() => setCategoriaSeleccionada(null)}
                  className="text-sm text-ferro-gray hover:text-ferro-black underline"
                >
                  Limpiar filtro
                </button>
              )}
            </div>

            {cargando ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-white rounded-xl border border-gray-100 animate-pulse"
                  />
                ))}
              </div>
            ) : categorias.length === 0 ? (
              <p className="text-gray-500">No hay categorías registradas.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => seleccionarCategoria(null)}
                  className={`text-left bg-white rounded-xl border p-4 hover:border-ferro-yellow hover:shadow-sm transition-all ${
                    categoriaSeleccionada === null
                      ? "border-ferro-yellow ring-1 ring-ferro-yellow"
                      : "border-gray-100"
                  }`}
                >
                  <p className="font-semibold text-ferro-black">
                    Todas las categorías
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {productos.length} producto(s)
                  </p>
                </button>

                {categorias.map((categoria) => {
                  const activa =
                    categoriaSeleccionada === categoria.id_categoria;

                  return (
                    <button
                      key={categoria.id_categoria}
                      type="button"
                      onClick={() =>
                        seleccionarCategoria(categoria.id_categoria)
                      }
                      className={`text-left bg-white rounded-xl border p-4 hover:border-ferro-yellow hover:shadow-sm transition-all ${
                        activa
                          ? "border-ferro-yellow ring-1 ring-ferro-yellow"
                          : "border-gray-100"
                      }`}
                    >
                      <p className="font-semibold text-ferro-black truncate">
                        {categoria.nombre}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {conteoPorCategoria.get(categoria.id_categoria) ?? 0}{" "}
                        producto(s)
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* C. Catálogo */}
        <section id="catalogo" className="scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-ferro-black">
                Catálogo de productos
              </h2>
              <p className="text-gray-500 mt-1">
                Busca, filtra y ordena los productos disponibles
              </p>
            </div>

            {/* Controles */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="busqueda"
                    className="block text-xs font-medium text-gray-500 mb-1"
                  >
                    Buscar
                  </label>

                  <input
                    id="busqueda"
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre o código..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
                  />
                </div>

                <div>
                  <label
                    htmlFor="filtro-categoria"
                    className="block text-xs font-medium text-gray-500 mb-1"
                  >
                    Categoría
                  </label>

                  <select
                    id="filtro-categoria"
                    value={categoriaSeleccionada ?? ""}
                    onChange={(e) =>
                      setCategoriaSeleccionada(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
                  >
                    <option value="">Todas las categorías</option>
                    {categorias.map((categoria) => (
                      <option
                        key={categoria.id_categoria}
                        value={categoria.id_categoria}
                      >
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="orden"
                    className="block text-xs font-medium text-gray-500 mb-1"
                  >
                    Ordenar por
                  </label>

                  <select
                    id="orden"
                    value={orden}
                    onChange={(e) => setOrden(e.target.value as Orden)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
                  >
                    <option value="recientes">Más recientes</option>
                    <option value="precio-asc">Precio: menor a mayor</option>
                    <option value="precio-desc">Precio: mayor a menor</option>
                    <option value="nombre-asc">Nombre: A - Z</option>
                    <option value="nombre-desc">Nombre: Z - A</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  {cargando
                    ? "Cargando productos..."
                    : `${productosFiltrados.length} de ${productos.length} producto(s)`}
                </p>

                {hayFiltros && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusqueda("");
                      setCategoriaSeleccionada(null);
                      setOrden("recientes");
                    }}
                    className="text-xs text-gray-500 hover:text-ferro-black underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            ) : cargando ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-80 bg-ferro-light rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : productos.length === 0 ? (
              <div className="bg-ferro-light rounded-xl p-10 text-center">
                <p className="text-gray-500">
                  No hay productos disponibles por el momento.
                </p>
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="bg-ferro-light rounded-xl p-10 text-center">
                <p className="text-gray-500">
                  No hay productos que coincidan con los filtros.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {productosFiltrados.map((producto) => (
                  <ProductCard
                    key={producto.id_producto}
                    name={producto.nombre}
                    price={Number(producto.precio)}
                    image={producto.imagen_1 || producto.imagen_2 || undefined}
                    description={producto.descripcion ?? undefined}
                    category={nombreCategoria.get(producto.id_categoria)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* E. Nuevos productos */}
        <section
          id="nuevos"
          className="scroll-mt-20 bg-ferro-light border-t border-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-ferro-black">
                Nuevos productos
              </h2>
              <p className="text-gray-500 mt-1">
                Lo último que se agregó al inventario
              </p>
            </div>

            {!cargando && nuevosProductos.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
                <p className="text-gray-500">
                  Aún no hay productos nuevos para mostrar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {cargando
                  ? [...Array(NUEVOS_LIMITE)].map((_, i) => (
                      <div
                        key={i}
                        className="h-80 bg-white rounded-xl animate-pulse"
                      />
                    ))
                  : nuevosProductos.map((producto) => (
                      <ProductCard
                        key={producto.id_producto}
                        name={producto.nombre}
                        price={Number(producto.precio)}
                        image={
                          producto.imagen_1 || producto.imagen_2 || undefined
                        }
                        description={producto.descripcion ?? undefined}
                        category={nombreCategoria.get(producto.id_categoria)}
                        badge="Nuevo"
                      />
                    ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
