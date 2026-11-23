export interface UsuarioAutenticado {
  id_usuario: number;
  uid?: string;
  nombre: string;
  email: string;
  rol: "admin" | "cliente";
}

export interface LoginResponse {
  ok: boolean;
  message: string;
  data: {
    usuario: UsuarioAutenticado;
    token: string;
  };
}
