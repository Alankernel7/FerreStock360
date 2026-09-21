"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { crearProducto } from "@/services/ProductosService";
import { obtenerCategorias } from "@/services/categoriasService";

import type { Categoria } from "@/types/categoria";

export default function NuevoProductoPage() {
  const router = useRouter();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
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
    const cargarCategorias = async () => {
      try {
        const datos = await obtenerCategorias();
        setCategorias(datos);
      } catch (err) {
        console.error("Error al cargar categorías:", err);
        setError("No se pudieron cargar las categorías.");
      } finally {
        setCargandoCategorias(false);
      }
    };

    cargarCategorias();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

      await crearProducto({
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
          : "Ocurrió un error al registrar el producto.";

      setError(mensaje);
    } finally {
      setGuardando(false);
    }
  };

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
          Nuevo producto
        </h1>

        <p className="text-gray-500 mt-1">
          Registra un nuevo producto en el inventario.
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
              placeholder="Ej. Taladro inalámbrico"
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
              placeholder="Ej. HER-010"
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
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Categoría *
            </label>

            <select
              value={idCategoria}
              onChange={(e) => setIdCategoria(e.target.value)}
              disabled={cargandoCategorias}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow"
            >
              <option value="">
                {cargandoCategorias
                  ? "Cargando categorías..."
                  : "Selecciona una categoría"}
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

            <p className="text-xs text-gray-400 mt-1">
              La imagen debe existir dentro de web/public/products.
            </p>
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
              placeholder="Descripción del producto..."
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
            {guardando ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      </form>
    </div>
  );
}