export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface UsuarioRol {
  usuario_id: number;
  rol_id: number;
}