"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  obtenerCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "@/services/categoriasService";

import type { Categoria } from "@/types/categoria";

const MAX_NOMBRE = 100;
const MAX_DESCRIPCION = 200;

type Modo = "crear" | "editar";

interface ErroresFormulario {
  nombre?: string;
  descripcion?: string;
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Estado del formulario (modal)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modo, setModo] = useState<Modo>("crear");
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(
    null
  );
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errores, setErrores] = useState<ErroresFormulario>({});
  const [guardando, setGuardando] = useState(false);

  // Estado de la confirmación de borrado
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<Categoria | null>(
    null
  );
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const datos = await obtenerCategorias();
        if (!activo) return;
        setCategorias(datos);
        setError(null);
      } catch (err) {
        console.error("Error al cargar categorías:", err);
        if (activo) setError("No se pudieron cargar las categorías.");
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  // Nombres ya usados (en minúsculas) para detectar duplicados de inmediato.
  const nombresExistentes = useMemo(() => {
    return new Set(
      categorias
        .filter((c) => c.id_categoria !== categoriaEditando?.id_categoria)
        .map((c) => c.nombre.trim().toLowerCase())
    );
  }, [categorias, categoriaEditando]);

  const validarFormulario = (): ErroresFormulario => {
    const nuevos: ErroresFormulario = {};

    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      nuevos.nombre = "El nombre es obligatorio.";
    } else if (nombreLimpio.length > MAX_NOMBRE) {
      nuevos.nombre = `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
    } else if (nombresExistentes.has(nombreLimpio.toLowerCase())) {
      nuevos.nombre = "Ya existe una categoría con ese nombre.";
    }

    if (descripcion.trim().length > MAX_DESCRIPCION) {
      nuevos.descripcion = `La descripción no puede superar los ${MAX_DESCRIPCION} caracteres.`;
    }

    return nuevos;
  };

  const abrirCrear = () => {
    setModo("crear");
    setCategoriaEditando(null);
    setNombre("");
    setDescripcion("");
    setErrores({});
    setMensaje(null);
    setModalAbierto(true);
  };

  const abrirEditar = (categoria: Categoria) => {
    setModo("editar");
    setCategoriaEditando(categoria);
    setNombre(categoria.nombre);
    setDescripcion(categoria.descripcion ?? "");
    setErrores({});
    setMensaje(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
    setCategoriaEditando(null);
    setErrores({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);
    setMensaje(null);

    const validaciones = validarFormulario();
    setErrores(validaciones);

    if (Object.keys(validaciones).length > 0) {
      return;
    }

    try {
      setGuardando(true);

      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
      };

      if (modo === "crear") {
        const nueva = await crearCategoria(payload);
        setCategorias((prev) =>
          [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
        setMensaje("Categoría registrada correctamente.");
      } else if (categoriaEditando) {
        const actualizada = await actualizarCategoria(
          categoriaEditando.id_categoria,
          payload
        );
        setCategorias((prev) =>
          prev
            .map((c) =>
              c.id_categoria === actualizada.id_categoria ? actualizada : c
            )
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
        setMensaje("Categoría actualizada correctamente.");
      }

      setModalAbierto(false);
      setCategoriaEditando(null);
    } catch (err) {
      const mensajeError =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar la categoría.";

      // El backend también valida duplicados: se refleja en el campo nombre.
      if (mensajeError.toLowerCase().includes("nombre")) {
        setErrores({ nombre: mensajeError });
      } else {
        setError(mensajeError);
        setModalAbierto(false);
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!categoriaAEliminar) return;

    try {
      setEliminando(true);
      setError(null);
      setMensaje(null);

      const mensajeRespuesta = await eliminarCategoria(
        categoriaAEliminar.id_categoria
      );

      setCategorias((actuales) =>
        actuales.filter(
          (c) => c.id_categoria !== categoriaAEliminar.id_categoria
        )
      );

      setMensaje(mensajeRespuesta);
      setCategoriaAEliminar(null);
    } catch (err) {
      const mensajeError =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al eliminar la categoría.";

      setError(mensajeError);
      setCategoriaAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ferro-black">Categorías</h1>
          <p className="text-gray-500 mt-1">
            Administración de las categorías del catálogo
          </p>
        </div>

        <button
          type="button"
          onClick={abrirCrear}
          className="bg-ferro-yellow text-ferro-black font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition text-center sm:text-left self-start sm:self-auto"
        >
          + Nueva categoría
        </button>
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
          <p className="text-gray-500">Cargando categorías...</p>
        </div>
      ) : categorias.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-gray-500">No hay categorías registradas.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Categoría
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Descripción
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {categorias.map((categoria) => (
                  <tr
                    key={categoria.id_categoria}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4 font-medium text-ferro-black">
                      {categoria.nombre}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {categoria.descripcion || (
                        <span className="text-gray-400">Sin descripción</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEditar(categoria)}
                          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-ferro-yellow transition"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => setCategoriaAEliminar(categoria)}
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

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-ferro-black mb-4">
              {modo === "crear" ? "Nueva categoría" : "Editar categoría"}
            </h2>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Nombre *
                </label>

                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (errores.nombre) {
                      setErrores((prev) => ({ ...prev, nombre: undefined }));
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow ${
                    errores.nombre ? "border-red-400" : "border-gray-200"
                  }`}
                  placeholder="Ej. Herramientas"
                />

                {errores.nombre && (
                  <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Descripción
                </label>

                <textarea
                  value={descripcion}
                  onChange={(e) => {
                    setDescripcion(e.target.value);
                    if (errores.descripcion) {
                      setErrores((prev) => ({
                        ...prev,
                        descripcion: undefined,
                      }));
                    }
                  }}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ferro-yellow resize-none ${
                    errores.descripcion ? "border-red-400" : "border-gray-200"
                  }`}
                  placeholder="Descripción de la categoría (opcional)"
                />

                {errores.descripcion && (
                  <p className="text-xs text-red-600 mt-1">
                    {errores.descripcion}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={cerrarModal}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-2 bg-ferro-yellow text-ferro-black font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : modo === "crear"
                    ? "Registrar"
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {categoriaAEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-ferro-black mb-3">
              Eliminar categoría
            </h2>

            <p className="text-gray-600 mb-3">
              ¿Estás seguro de que deseas eliminar{" "}
              <span className="font-semibold">
                {categoriaAEliminar.nombre}
              </span>
              ?
            </p>

            <p className="text-sm text-gray-500 mb-6">
              Esta acción no se puede deshacer. Si la categoría tiene productos
              asociados, no podrá eliminarse.
            </p>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={eliminando}
                onClick={() => setCategoriaAEliminar(null)}
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
