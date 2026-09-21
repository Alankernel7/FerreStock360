"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  obtenerProductoPorId,
  actualizarProducto,
} from "@/services/productosService";

import { obtenerCategorias } from "@/services/categoriasService";

import type { Categoria } from "@/types/categoria";

export default function EditarProductoPage() {
  const params = useParams();
  const router = useRouter();

  const id = Number(params.id);

  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [stockActual, setStockActual] = useState("0");
  const [stockMinimo, setStockMinimo] = useState("5");
  const [idCategoria, setIdCategoria] = useState("");
  const [estado, setEstado] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      if (isNaN(id) || id <= 0) {
        setError("ID de producto inválido.");
        setCargando(false);
        return;
      }

      try {
        const [producto, categoriasData] = await Promise.all([
          obtenerProductoPorId(id),
          obtenerCategorias(),
        ]);

        setCategorias(categoriasData);

        setNombre(producto.nombre);
        setDescripcion(producto.descripcion ?? "");
        setCodigo(producto.codigo);
        setPrecio(String(producto.precio));
        setImagenUrl(producto.imagen_url ?? "");
        setStockActual(String(producto.stock_actual));
        setStockMinimo(String(producto.stock_minimo));
        setIdCategoria(String(producto.id_categoria));
        setEstado(Boolean(producto.estado));
      } catch (err) {
        const mensaje =
          err instanceof Error
            ? err.message
            : "No se pudo cargar el producto.";

        setError(mensaje);
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, [id]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!codigo.trim()) {
      setError("El código es obligatorio.");
      return;
    }

    if (!precio || Number(precio) < 0) {
      setError("El precio debe ser mayor o igual a 0.");
      return;
    }

    if (!idCategoria) {
      setError("Debes seleccionar una categoría.");
      return;
    }

    if (Number(stockActual) < 0 || Number(stockMinimo) < 0) {
      setError("Los valores de stock no pueden ser negativos.");
      return;
    }

    try {
      setGuardando(true);

      await actualizarProducto(id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        codigo: codigo.trim(),
        precio: Number(precio),
        imagen_url: imagenUrl.trim() || null,
        stock_actual: Number(stockActual),
        stock_minimo: Number(stockMinimo),
        id_categoria: Number(idCategoria),
        estado,
      });

      router.push("/dashboard/productos");
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al actualizar el producto.";

      setError(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ferro-black mb-4">
          Editar producto
        </h1>

        <p className="text-gray-500">
          Cargando producto...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/productos"
          className="text-sm text-gray-500 hover:text-ferro-black"
        >
          ← Volver a productos
        </Link>

        <h1 className="text-2xl font-bold text-ferro-black mt-3">
          Editar producto
        </h1>

        <p className="text-gray-500 mt-1">
          Modifica la información del producto seleccionado.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
      >
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre *
            </label>

            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Código *
            </label>

            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Precio *
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Categoría *
            </label>

            <select
              value={idCategoria}
              onChange={(e) => setIdCategoria(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
            >
              <option value="">
                Selecciona una categoría
              </option>

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
            <label className="block text-sm font-medium mb-2">
              Stock actual
            </label>

            <input
              type="number"
              min="0"
              value={stockActual}
              onChange={(e) => setStockActual(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Stock mínimo
            </label>

            <input
              type="number"
              min="0"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">
              Ruta de imagen
            </label>

            <input
              type="text"
              value={imagenUrl}
              onChange={(e) => setImagenUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
              placeholder="/products/mi-producto.jpg"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">
              Descripción
            </label>

            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow resize-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={estado}
                onChange={(e) => setEstado(e.target.checked)}
                className="w-4 h-4"
              />

              <span className="text-sm font-medium">
                Producto activo
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
          <Link
            href="/dashboard/productos"
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={guardando}
            className="bg-ferro-yellow text-ferro-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}