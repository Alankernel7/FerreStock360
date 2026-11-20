"use client";

import { useEffect, useId, useRef, useState } from "react";

import { resolverUrlImagen } from "@/lib/imagenes";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, igual que el backend

const TIPOS_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSIONES_PERMITIDAS = /\.(jpe?g|png|webp)$/i;

const validarArchivo = (archivo: File): string | null => {
  if (
    !TIPOS_PERMITIDOS.has(archivo.type) ||
    !EXTENSIONES_PERMITIDAS.test(archivo.name)
  ) {
    return "Formato no permitido. Usa JPG, JPEG, PNG o WEBP.";
  }

  if (archivo.size === 0) {
    return "El archivo está vacío.";
  }

  if (archivo.size > MAX_BYTES) {
    return "La imagen no puede superar los 5 MB.";
  }

  return null;
};

interface ProductImageUploaderProps {
  etiqueta: string;
  ayuda?: string;
  archivo: File | null;
  imagenActual: string | null;
  onArchivoSeleccionado: (archivo: File | null) => void;
  onEliminarActual: () => void;
  deshabilitado?: boolean;
}

export default function ProductImageUploader({
  etiqueta,
  ayuda,
  archivo,
  imagenActual,
  onArchivoSeleccionado,
  onEliminarActual,
  deshabilitado = false,
}: ProductImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const [error, setError] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const urlPreviaRef = useRef<string | null>(null);

  // Libera la última URL temporal al desmontar el componente.
  useEffect(() => {
    return () => {
      if (urlPreviaRef.current) {
        URL.revokeObjectURL(urlPreviaRef.current);
      }
    };
  }, []);

  const actualizarVistaPrevia = (seleccionado: File | null) => {
    if (urlPreviaRef.current) {
      URL.revokeObjectURL(urlPreviaRef.current);
      urlPreviaRef.current = null;
    }

    if (!seleccionado) {
      setVistaPrevia(null);
      return;
    }

    const url = URL.createObjectURL(seleccionado);
    urlPreviaRef.current = url;
    setVistaPrevia(url);
  };

  const abrirSelector = () => {
    if (deshabilitado) return;
    inputRef.current?.click();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const seleccionado = event.target.files?.[0] ?? null;

    // Permite volver a seleccionar el mismo archivo después de quitarlo.
    event.target.value = "";

    if (!seleccionado) return;

    const mensaje = validarArchivo(seleccionado);

    if (mensaje) {
      setError(mensaje);
      actualizarVistaPrevia(null);
      onArchivoSeleccionado(null);
      return;
    }

    setError(null);
    actualizarVistaPrevia(seleccionado);
    onArchivoSeleccionado(seleccionado);
  };

  const urlActual = resolverUrlImagen(imagenActual);
  const urlMostrada = vistaPrevia ?? urlActual;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium mb-2"
      >
        {etiqueta}
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={deshabilitado}
        className="sr-only"
      />

      {urlMostrada ? (
        <div className="border border-gray-200 rounded-xl p-3 bg-white">
          <div className="relative bg-ferro-light rounded-lg h-48 flex items-center justify-center overflow-hidden">
            <img
              src={urlMostrada}
              alt={etiqueta}
              className="max-w-full max-h-full object-contain"
            />

            <span className="absolute top-2 left-2 bg-white/90 text-ferro-black text-xs font-medium px-2 py-1 rounded">
              {archivo ? "Nueva imagen" : "Imagen actual"}
            </span>
          </div>

          {archivo && (
            <p className="text-xs text-gray-500 mt-2 truncate">
              {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={abrirSelector}
              disabled={deshabilitado}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-ferro-yellow transition disabled:opacity-50"
            >
              Cambiar
            </button>

            {archivo ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  actualizarVistaPrevia(null);
                  onArchivoSeleccionado(null);
                }}
                disabled={deshabilitado}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
              >
                Quitar selección
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onEliminarActual();
                }}
                disabled={deshabilitado}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
              >
                Eliminar imagen
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirSelector}
          disabled={deshabilitado}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl h-48 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-ferro-yellow hover:bg-ferro-light/50 transition disabled:opacity-50"
        >
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>

          <span className="text-sm font-medium">Seleccionar imagen</span>
          <span className="text-xs">
            Desde tu computadora o la galería del dispositivo
          </span>
        </button>
      )}

      {error ? (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      ) : (
        ayuda && <p className="text-xs text-gray-400 mt-2">{ayuda}</p>
      )}
    </div>
  );
}
