import type {
  EstadisticasPublicas,
  EstadisticasPublicasResponse,
} from "@/types/estadisticasPublicas";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
).replace(/\/+$/, "");
const URL_ESTADISTICAS = `${API_URL}/estadisticas-publicas`;
const CACHE_MS = 30_000;

let cache: { data: EstadisticasPublicas; guardadoEn: number } | null = null;
let solicitudEnCurso: Promise<EstadisticasPublicas | null> | null = null;

function esEstadisticaValida(value: unknown): value is EstadisticasPublicas {
  if (!value || typeof value !== "object") return false;
  const stats = value as Record<string, unknown>;
  return ["total_productos", "total_categorias"].every((key) =>
    typeof stats[key] === "number" &&
    Number.isFinite(stats[key]) &&
    (stats[key] as number) >= 0
  );
}

async function consultar(): Promise<EstadisticasPublicas | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(URL_ESTADISTICAS, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const detalle = (await response.text()).slice(0, 300);
      console.error(
        `[estadisticas-publicas] GET ${URL_ESTADISTICAS} respondió HTTP ${response.status}`,
        detalle || response.statusText
      );
      return null;
    }

    let resultado: EstadisticasPublicasResponse;
    try {
      resultado = await response.json() as EstadisticasPublicasResponse;
    } catch (error) {
      console.error("[estadisticas-publicas] La API devolvió JSON inválido.", error);
      return null;
    }

    if (resultado?.ok !== true || !esEstadisticaValida(resultado.data)) {
      console.error("[estadisticas-publicas] La respuesta de la API no tiene el formato esperado.", resultado);
      return null;
    }

    cache = { data: resultado.data, guardadoEn: Date.now() };
    return resultado.data;
  } catch (error) {
    const causa = error instanceof Error ? error.message : error;
    console.error(`[estadisticas-publicas] No se pudo conectar con ${URL_ESTADISTICAS}.`, causa);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Las estadísticas son complementarias: si la API falla, devuelve null y no bloquea la página. */
export async function obtenerEstadisticasPublicas(): Promise<EstadisticasPublicas | null> {
  if (cache && Date.now() - cache.guardadoEn < CACHE_MS) return cache.data;
  if (solicitudEnCurso) return solicitudEnCurso;

  solicitudEnCurso = consultar();
  try {
    return await solicitudEnCurso;
  } finally {
    solicitudEnCurso = null;
  }
}
