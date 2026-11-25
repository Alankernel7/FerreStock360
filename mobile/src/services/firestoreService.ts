import { apiConfigurada, apiBaseUrl, catalogoCompartido, administrarCatalogo, sesionOperativa } from "./operaciones";
import type { User } from "firebase/auth";
import type {
  Actividad, Categoria, PerfilUsuario, Producto, ProductoId,
  ProveedorAuth, Rol, TipoActividad,
} from "../types";

const requerirApi = () => {
  if (!apiConfigurada) throw new Error("Configura EXPO_PUBLIC_API_URL para usar los servicios compartidos.");
};

async function solicitar<T>(path: string, method = "GET", body?: object): Promise<T> {
  requerirApi();
  const token = await sesionOperativa();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const resultado = await response.json();
  if (!response.ok) throw new Error(resultado.message || "La operación no se pudo completar.");
  return resultado.data as T;
}

const mapPerfil = (p: Partial<PerfilUsuario> & { rol?: string }): PerfilUsuario => ({
  uid: String(p.uid || ""), nombre: String(p.nombre || "Usuario"), email: String(p.email || ""),
  rol: String(p.rol || "usuario") as Rol,
  estado: p.estado === "inactivo" ? "inactivo" : "activo",
  fecha_creacion: String(p.fecha_creacion || new Date().toISOString()),
  proveedor: p.proveedor === "google" ? "google" : "password", foto_url: p.foto_url || null,
});

export async function obtenerPerfilUsuario(uid: string): Promise<PerfilUsuario | null> {
  const profile = await solicitar<PerfilUsuario>("/auth/perfil");
  return profile.uid === uid ? mapPerfil(profile) : null;
}

export async function crearPerfilUsuario(user: User, opciones?: { nombre?: string; proveedor?: ProveedorAuth; rol?: Rol }): Promise<PerfilUsuario> {
  const profile = await solicitar<PerfilUsuario>("/auth/perfil", "PATCH", {
    nombre: opciones?.nombre?.trim() || user.displayName || user.email?.split("@")[0] || "Usuario",
  });
  return mapPerfil({ ...profile, uid: user.uid, proveedor: opciones?.proveedor });
}

export async function asegurarPerfilUsuario(user: User, opciones?: { proveedor?: ProveedorAuth }): Promise<PerfilUsuario> {
  const profile = await solicitar<PerfilUsuario>("/auth/perfil");
  return mapPerfil({ ...profile, uid: user.uid, proveedor: opciones?.proveedor || profile.proveedor });
}

export async function actualizarPerfilUsuario(_uid: string, datos: Partial<Pick<PerfilUsuario, "nombre" | "foto_url">>): Promise<void> {
  if (datos.nombre !== undefined) await solicitar("/auth/perfil", "PATCH", { nombre: datos.nombre });
}

export type ResultadoProductos = { productos: Producto[]; error: string | null };
export async function obtenerProductos(incluirInactivos = false): Promise<ResultadoProductos> {
  if (!apiConfigurada) return { productos: [], error: "Configura EXPO_PUBLIC_API_URL." };
  try {
    const lista = await catalogoCompartido(incluirInactivos);
    return {
      productos: lista.map((p) => ({
        id_producto: p.firestore_id || p.id_producto, imagen_2: p.imagen_2,
        nombre: p.nombre, descripcion: p.descripcion, codigo: p.codigo, precio: p.precio,
        imagen_url: p.imagen_1, stock_actual: p.stock_actual,
        stock_minimo: p.stock_minimo, disponible: p.disponible,
        id_categoria: p.id_categoria, estado: p.estado,
        fecha_creacion: p.fecha_creacion,
      })), error: null,
    };
  } catch (error) {
    return { productos: [], error: error instanceof Error ? error.message : "No se pudieron cargar los productos." };
  }
}

export type ResultadoCategorias = { categorias: Categoria[]; error: string | null };
export async function obtenerCategorias(): Promise<ResultadoCategorias> {
  if (!apiConfigurada) return { categorias: [], error: "Configura EXPO_PUBLIC_API_URL." };
  try {
    const response = await fetch(`${apiBaseUrl}/categorias`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudieron cargar las categorías.");
    return { categorias: (data as Categoria[]).sort((a, b) => a.nombre.localeCompare(b.nombre)), error: null };
  } catch (error) {
    return { categorias: [], error: error instanceof Error ? error.message : "No se pudieron cargar las categorías." };
  }
}

export type DatosProducto = {
  imagen_2?: string | null; nombre: string; descripcion: string | null; codigo: string;
  precio: number; imagen_url: string | null; stock_actual: number; stock_minimo: number;
  id_categoria: number; estado: boolean;
};
export async function crearProducto(datos: DatosProducto): Promise<void> {
  await administrarCatalogo("/productos", "POST", { ...datos, imagen_1: datos.imagen_url });
}
export async function actualizarProducto(id: ProductoId, datos: DatosProducto): Promise<void> {
  const items = await catalogoCompartido(true);
  const p = items.find((item) => item.firestore_id === String(id) || item.id_producto === Number(id));
  if (!p) throw new Error("Producto inexistente.");
  await administrarCatalogo(`/productos/${p.id_producto}`, "PUT", { ...datos, imagen_1: datos.imagen_url, imagen_2: datos.imagen_2 ?? p.imagen_2 });
}
export async function eliminarProducto(id: ProductoId): Promise<void> {
  const items = await catalogoCompartido(true);
  const p = items.find((item) => item.firestore_id === String(id) || item.id_producto === Number(id));
  if (!p) throw new Error("Producto inexistente.");
  await administrarCatalogo(`/productos/${p.id_producto}`, "DELETE");
}

export type DatosCategoria = { nombre: string; descripcion: string | null };
export async function crearCategoria(datos: DatosCategoria): Promise<void> { await administrarCatalogo("/categorias", "POST", datos); }
export async function actualizarCategoria(id: number, datos: DatosCategoria): Promise<void> { await administrarCatalogo(`/categorias/${id}`, "PUT", datos); }
export async function eliminarCategoria(id: number): Promise<void> { await administrarCatalogo(`/categorias/${id}`, "DELETE"); }
export async function contarProductosDeCategoria(idCategoria: number): Promise<number> {
  const result = await obtenerProductos(true);
  return result.productos.filter((p) => p.id_categoria === idCategoria).length;
}

export async function obtenerUsuarios(): Promise<PerfilUsuario[]> {
  const result = await solicitar<{ usuarios: Array<PerfilUsuario & { id_usuario: number }> }>("/usuarios");
  return result.usuarios.map((u) => mapPerfil({ ...u, uid: String(u.uid || u.id_usuario) }));
}
export async function contarUsuarios(): Promise<number> { return (await obtenerUsuarios()).length; }

export async function registrarActividad(_uid: string, tipo: TipoActividad, descripcion: string): Promise<void> {
  try { await solicitar("/actividad", "POST", { tipo, descripcion }); }
  catch (error) { console.warn("[api] No se pudo registrar la actividad:", error); }
}
export async function obtenerHistorial(uid: string): Promise<Actividad[]> {
  const items = await solicitar<Actividad[]>("/actividad");
  return items.filter((item) => item.uid === uid);
}
