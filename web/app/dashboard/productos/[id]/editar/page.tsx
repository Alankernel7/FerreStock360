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

const MAX_NOMBRE = 150;
const MAX_CODIGO = 50;
const MAX_DESCRIPCION = 500;
const MAX_PRECIO = 99999999.99;

interface Errores {
  nombre?: string;
  codigo?: string;
  descripcion?: string;
  precio?: string;
  imagen_1?: string;
  imagen_2?: string;
  stock_actual?: string;
  stock_minimo?: string;
  id_categoria?: string;
}

// --- Validaciones por campo (reutilizables al escribir, salir y enviar) ---

function validarNombre(valor: string): string | undefined {
  const limpio = valor.trim();
  if (!limpio) return "El nombre es obligatorio.";
  if (limpio.length > MAX_NOMBRE)
    return `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
  return undefined;
}

function validarCodigo(valor: string): string | undefined {
  const limpio = valor.trim();
  if (!limpio) return "El código es obligatorio.";
  if (limpio.length > MAX_CODIGO)
    return `El código no puede superar los ${MAX_CODIGO} caracteres.`;
  return undefined;
}

function validarDescripcion(valor: string): string | undefined {
  if (valor.trim().length > MAX_DESCRIPCION)
    return `La descripción no puede superar los ${MAX_DESCRIPCION} caracteres.`;
  return undefined;
}

function validarPrecio(valor: string): string | undefined {
  if (valor.trim() === "") return "El precio es obligatorio.";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "El precio debe ser un número válido.";
  if (numero < 0) return "El precio no puede ser negativo.";
  if (numero > MAX_PRECIO) return `El precio no puede superar ${MAX_PRECIO}.`;
  return undefined;
}

function validarEntero(valor: string, etiqueta: string): string | undefined {
  if (valor.trim() === "") return undefined;
  const numero = Number(valor);
  if (!Number.isInteger(numero))
    return `${etiqueta} debe ser un número entero.`;
  if (numero < 0) return `${etiqueta} no puede ser negativo.`;
  return undefined;
}

function validarImagen(valor: string, etiqueta: string): string | undefined {
  const limpio = valor.trim();
  if (!limpio) return undefined;
  if (limpio.length > 500) return `La ruta de ${etiqueta} es demasiado larga.`;
  if (!/^(\/|https?:\/\/)/i.test(limpio))
    return `La ruta de ${etiqueta} debe comenzar con / o http(s)://`;
  return undefined;
}

export default function EditarProductoPage() {
  const params = useParams();
  const router = useRouter();

  const id = Number(params.id);

  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Errores>({});

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("");
  const [imagen1, setImagen1] = useState("");
  const [imagen2, setImagen2] = useState("");
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
        setImagen1(producto.imagen_1 ?? "");
        setImagen2(producto.imagen_2 ?? "");
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

  const limpiarError = (campo: keyof Errores) => {
    setErrores((prev) => {
      if (!prev[campo]) return prev;
      return { ...prev, [campo]: undefined };
    });
  };

  const validarTodo = (): Errores => ({
    nombre: validarNombre(nombre),
    codigo: validarCodigo(codigo),
    descripcion: validarDescripcion(descripcion),
    precio: validarPrecio(precio),
    imagen_1: validarImagen(imagen1, "la imagen 1"),
    imagen_2: validarImagen(imagen2, "la imagen 2"),
    stock_actual: validarEntero(stockActual, "El stock actual"),
    stock_minimo: validarEntero(stockMinimo, "El stock mínimo"),
    id_categoria: idCategoria ? undefined : "Debes seleccionar una categoría.",
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);

    const validaciones = validarTodo();
    setErrores(validaciones);

    if (Object.values(validaciones).some(Boolean)) return;

    try {
      setGuardando(true);

      await actualizarProducto(id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        codigo: codigo.trim(),
        precio: Number(precio),
        imagen_1: imagen1.trim() || null,
        imagen_2: imagen2.trim() || null,
        stock_actual: stockActual.trim() === "" ? 0 : Number(stockActual),
        stock_minimo: stockMinimo.trim() === "" ? 5 : Number(stockMinimo),
        id_categoria: Number(idCategoria),
        estado,
      });

      router.push("/dashboard/productos");
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al actualizar el producto.";

      // Si el backend detecta código duplicado, se muestra bajo ese campo.
      if (mensaje.toLowerCase().includes("código")) {
        setErrores((p) => ({ ...p, codigo: mensaje }));
      } else {
        setError(mensaje);
      }
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = (campo: keyof Errores) =>
    `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow ${
      errores[campo] ? "border-red-400" : "border-gray-200"
    }`;

  if (cargando) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ferro-black mb-4">
          Editar producto
        </h1>

        <p className="text-gray-500">Cargando producto...</p>
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
        noValidate
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6"
      >
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Nombre *</label>

            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                limpiarError("nombre");
              }}
              onBlur={() =>
                setErrores((p) => ({ ...p, nombre: validarNombre(nombre) }))
              }
              className={inputClass("nombre")}
            />

            {errores.nombre && (
              <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Código *</label>

            <input
              type="text"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                limpiarError("codigo");
              }}
              onBlur={() =>
                setErrores((p) => ({ ...p, codigo: validarCodigo(codigo) }))
              }
              className={inputClass("codigo")}
            />

            {errores.codigo && (
              <p className="text-xs text-red-600 mt-1">{errores.codigo}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Precio *</label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={precio}
              onChange={(e) => {
                setPrecio(e.target.value);
                limpiarError("precio");
              }}
              onBlur={() =>
                setErrores((p) => ({ ...p, precio: validarPrecio(precio) }))
              }
              className={inputClass("precio")}
            />

            {errores.precio && (
              <p className="text-xs text-red-600 mt-1">{errores.precio}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Categoría *
            </label>

            <select
              value={idCategoria}
              onChange={(e) => {
                setIdCategoria(e.target.value);
                limpiarError("id_categoria");
              }}
              onBlur={() =>
                setErrores((p) => ({
                  ...p,
                  id_categoria: idCategoria
                    ? undefined
                    : "Debes seleccionar una categoría.",
                }))
              }
              className={inputClass("id_categoria")}
            >
              <option value="">Selecciona una categoría</option>

              {categorias.map((categoria) => (
                <option
                  key={categoria.id_categoria}
                  value={categoria.id_categoria}
                >
                  {categoria.nombre}
                </option>
              ))}
            </select>

            {errores.id_categoria && (
              <p className="text-xs text-red-600 mt-1">
                {errores.id_categoria}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Stock actual
            </label>

            <input
              type="number"
              min="0"
              value={stockActual}
              onChange={(e) => {
                setStockActual(e.target.value);
                limpiarError("stock_actual");
              }}
              onBlur={() =>
                setErrores((p) => ({
                  ...p,
                  stock_actual: validarEntero(stockActual, "El stock actual"),
                }))
              }
              className={inputClass("stock_actual")}
            />

            {errores.stock_actual && (
              <p className="text-xs text-red-600 mt-1">
                {errores.stock_actual}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Stock mínimo
            </label>

            <input
              type="number"
              min="0"
              value={stockMinimo}
              onChange={(e) => {
                setStockMinimo(e.target.value);
                limpiarError("stock_minimo");
              }}
              onBlur={() =>
                setErrores((p) => ({
                  ...p,
                  stock_minimo: validarEntero(stockMinimo, "El stock mínimo"),
                }))
              }
              className={inputClass("stock_minimo")}
            />

            {errores.stock_minimo && (
              <p className="text-xs text-red-600 mt-1">
                {errores.stock_minimo}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">
              Ruta de imagen 1
            </label>

            <input
              type="text"
              value={imagen1}
              onChange={(e) => {
                setImagen1(e.target.value);
                limpiarError("imagen_1");
              }}
              onBlur={() =>
                setErrores((p) => ({
                  ...p,
                  imagen_1: validarImagen(imagen1, "la imagen 1"),
                }))
              }
              className={inputClass("imagen_1")}
              placeholder="/products/mi-producto.jpg"
            />

            {errores.imagen_1 && (
              <p className="text-xs text-red-600 mt-1">{errores.imagen_1}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">
              Ruta de imagen 2 (opcional)
            </label>

            <input
              type="text"
              value={imagen2}
              onChange={(e) => {
                setImagen2(e.target.value);
                limpiarError("imagen_2");
              }}
              onBlur={() =>
                setErrores((p) => ({
                  ...p,
                  imagen_2: validarImagen(imagen2, "la imagen 2"),
                }))
              }
              className={inputClass("imagen_2")}
              placeholder="/products/mi-producto-2.jpg"
            />

            {errores.imagen_2 && (
              <p className="text-xs text-red-600 mt-1">{errores.imagen_2}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">
              Descripción
            </label>

            <textarea
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                limpiarError("descripcion");
              }}
              onBlur={() =>
                setErrores((p) => ({
                  ...p,
                  descripcion: validarDescripcion(descripcion),
                }))
              }
              rows={4}
              className={`${inputClass("descripcion")} resize-none`}
            />

            {errores.descripcion && (
              <p className="text-xs text-red-600 mt-1">
                {errores.descripcion}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={estado}
                onChange={(e) => setEstado(e.target.checked)}
                className="w-4 h-4"
              />

              <span className="text-sm font-medium">Producto activo</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
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
