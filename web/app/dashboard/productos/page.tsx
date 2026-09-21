"use client";

import { useEffect, useState } from "react";
import { obtenerProductos } from "@/services/ProductosService";
import type { Producto } from "@/types/producto";
import Link from "next/link";

export default function ProductosPage() {
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ferro-black">
            Productos
          </h1>

          <p className="text-gray-500 mt-1">
            Administración del catálogo de productos
          </p>
        </div>

        <Link
          href="/dashboard/productos/nuevo"
          className="bg-ferro-yellow text-ferro-black font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          + Nuevo producto
        </Link>
      </div>

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-gray-500">
            Cargando productos...
          </p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-red-500">
            {error}
          </p>
        </div>
      ) : productos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-gray-500">
            No hay productos registrados.
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
                {productos.map((producto) => (
                  <tr
                    key={producto.id_producto}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-ferro-light rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {producto.imagen_url ? (
                            <img
                              src={producto.imagen_url}
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
                      #{producto.id_categoria}
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
                        <button
                          type="button"
                          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-ferro-yellow transition"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
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
    </div>
  );
}