export interface Categoria {
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
}

export interface CategoriaPayload {
  nombre: string;
  descripcion: string | null;
}

export interface CategoriaResponse {
  ok: boolean;
  message: string;
  data: Categoria;
}
