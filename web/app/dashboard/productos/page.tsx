"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  obtenerProductos,
  eliminarProducto,
} from "@/services/productosService";
import { obtenerCategorias } from "@/services/categoriasService";

import type { Producto } from "@/types/producto";
import type { Categoria } from "@/types/categoria";

type Orden =
  | "reciente"
  | "nombre-asc"
  | "nombre-desc"
  | "precio-asc"
  | "precio-desc"
  | "stock-asc"
  | "stock-desc";

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(
    null
  );
  const [eliminando, setEliminando] = useState(false);

  // Buscar / filtrar / ordenar
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [orden, setOrden] = useState<Orden>("reciente");

  // Mapa id_categoria → nombre para mostrar el nombre real en la tabla.
  const nombreCategoria = useMemo(() => {
    const mapa = new Map<number, string>();
    categorias.forEach((c) => mapa.set(c.id_categoria, c.nombre));
    return mapa;
  }, [categorias]);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const [datosProductos, datosCategorias] = await Promise.all([
          obtenerProductos(),
          obtenerCategorias(),
        ]);

        if (!activo) return;

        setProductos(datosProductos);
        setCategorias(datosCategorias);
        setError(null);
      } catch (err) {
        console.error("Error al cargar productos:", err);
        if (activo) setError("No se pudieron cargar los productos.");
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = productos.filter((producto) => {
      const coincideTexto =
        !texto ||
        producto.nombre.toLowerCase().includes(texto) ||
        producto.codigo.toLowerCase().includes(texto);

      const coincideCategoria =
        !filtroCategoria ||
        producto.id_categoria === Number(filtroCategoria);

      return coincideTexto && coincideCategoria;
    });

    const ordenados = [...filtrados];

    ordenados.sort((a, b) => {
      switch (orden) {
        case "nombre-asc":
          return a.nombre.localeCompare(b.nombre);
        case "nombre-desc":
          return b.nombre.localeCompare(a.nombre);
        case "precio-asc":
          return Number(a.precio) - Number(b.precio);
        case "precio-desc":
          return Number(b.precio) - Number(a.precio);
        case "stock-asc":
          return a.stock_actual - b.stock_actual;
        case "stock-desc":
          return b.stock_actual - a.stock_actual;
        case "reciente":
        default:
          return b.id_producto - a.id_producto;
      }
    });

    return ordenados;
  }, [productos, busqueda, filtroCategoria, orden]);

  const handleEliminar = async () => {
    if (!productoAEliminar) return;

    try {
      setEliminando(true);
      setError(null);
      setMensaje(null);

      const mensajeRespuesta = await eliminarProducto(
        productoAEliminar.id_producto
      );

      setProductos((productosActuales) =>
        productosActuales.filter(
          (producto) => producto.id_producto !== productoAEliminar.id_producto
        )
      );

      setMensaje(mensajeRespuesta);
      setProductoAEliminar(null);
    } catch (err) {
      const mensajeError =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al eliminar el producto.";

      setError(mensajeError);
      setProductoAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  const hayFiltros = busqueda.trim() !== "" || filtroCategoria !== "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ferro-black">Productos</h1>

          <p className="text-gray-500 mt-1">
            Administración del catálogo de productos
          </p>
        </div>

        <Link
          href="/dashboard/productos/nuevo"
          className="bg-ferro-yellow text-ferro-black font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition text-center sm:text-left self-start sm:self-auto"
        >
          + Nuevo producto
        </Link>
      </div>

      {mensaje && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-gray-500">Cargando productos...</p>
        </div>
      ) : (
        <>
          {/* Barra de búsqueda, filtro y orden */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Buscar
                </label>

                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o código..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Categoría
                </label>

                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
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
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Ordenar por
                </label>

                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as Orden)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
                >
                  <option value="reciente">Más recientes</option>
                  <option value="nombre-asc">Nombre (A-Z)</option>
                  <option value="nombre-desc">Nombre (Z-A)</option>
                  <option value="precio-asc">Precio (menor a mayor)</option>
                  <option value="precio-desc">Precio (mayor a menor)</option>
                  <option value="stock-asc">Stock (menor a mayor)</option>
                  <option value="stock-desc">Stock (mayor a menor)</option>
                </select>
              </div>
            </div>

            {hayFiltros && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {productosFiltrados.length} de {productos.length} producto(s)
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("");
                    setFiltroCategoria("");
                  }}
                  className="text-xs text-gray-500 hover:text-ferro-black underline"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {productos.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <p className="text-gray-500">No hay productos registrados.</p>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <p className="text-gray-500">
                No hay productos que coincidan con los filtros.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                        Producto
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                        Código
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                        Precio
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                        Stock
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                        Categoría
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                        Estado
                      </th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {productosFiltrados.map((producto) => (
                      <tr
                        key={producto.id_producto}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-ferro-light rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                              {producto.imagen_1 || producto.imagen_2 ? (
                                <img
                                  src={
                                    (producto.imagen_1 ||
                                      producto.imagen_2) as string
                                  }
                                  alt={producto.nombre}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <span className="text-xs text-gray-400">
                                  Sin imagen
                                </span>
                              )}
                            </div>

                            <div>
                              <p className="font-medium text-ferro-black">
                                {producto.nombre}
                              </p>

                              {producto.descripcion && (
                                <p className="text-xs text-gray-500 max-w-xs truncate">
                                  {producto.descripcion}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {producto.codigo}
                        </td>

                        <td className="px-6 py-4 text-sm font-medium">
                          ${Number(producto.precio).toFixed(2)}
                        </td>

                        <td className="px-6 py-4">
                          <div>
                            <span
                              className={
                                producto.stock_actual <= producto.stock_minimo
                                  ? "text-red-600 font-semibold"
                                  : "text-gray-700"
                              }
                            >
                              {producto.stock_actual}
                            </span>

                            <p className="text-xs text-gray-400">
                              Mínimo: {producto.stock_minimo}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {nombreCategoria.get(producto.id_categoria) ??
                            `#${producto.id_categoria}`}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              producto.estado
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {producto.estado ? "Activo" : "Inactivo"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/dashboard/productos/${producto.id_producto}/editar`}
                              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-ferro-yellow transition"
                            >
                              Editar
                            </Link>

                            <button
                              type="button"
                              onClick={() => setProductoAEliminar(producto)}
                              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {productoAEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-ferro-black mb-3">
              Eliminar producto
            </h2>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar{" "}
              <span className="font-semibold">{productoAEliminar.nombre}</span>?
            </p>

            <p className="text-sm text-gray-500 mb-6">
              Esta acción no se puede deshacer.
            </p>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={eliminando}
                onClick={() => setProductoAEliminar(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={eliminando}
                onClick={handleEliminar}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {eliminando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
