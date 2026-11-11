export interface UsuarioAutenticado {
  id_usuario: number;
  nombre: string;
  email: string;
  rol: "admin" | "empleado";
}

export interface LoginResponse {
  ok: boolean;
  message: string;
  data: {
    usuario: UsuarioAutenticado;
    token: string;
  };
}