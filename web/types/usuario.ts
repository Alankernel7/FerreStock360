export interface RolUsuario {
  id_rol: number;
  nombre: string;
  descripcion?: string | null;
}

export interface UsuarioAdministrable {
  id_usuario: number;
  nombre: string;
  email: string;
  id_rol: number;
  rol: string;
  estado: boolean;
  fecha_creacion: string;
}

export interface UsuariosData {
  usuarios: UsuarioAdministrable[];
  roles: RolUsuario[];
}
