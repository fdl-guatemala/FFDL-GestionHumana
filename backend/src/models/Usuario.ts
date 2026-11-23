export interface Usuario {
  id: number;
  empleado_id: number;
  codigo_empleado: string;
  password_hash: string;
  rol_id: number | null;
  activo: boolean | number;
  ultimo_acceso: string | Date | null;
  created_at: string | Date;
  // Campos opcionales obtenidos por JOIN con empleados y usuario_roles
  nombre_completo?: string;
  puesto?: string;
  lugar?: string;
  roles?: number[];
}

export interface UsuarioPublico {
  id: number;
  empleado_id: number;
  codigo_empleado: string;
  rol_id: number | null;
  activo: boolean | number;
  ultimo_acceso: string | Date | null;
  created_at: string | Date;
  nombre_completo?: string;
  puesto?: string;
  lugar?: string;
  roles: number[];
}

export interface CrearUsuarioDTO {
  empleado_id: number;
  codigo_empleado: string;
  password_hash: string;
  rol_id?: number | null;
  roles?: number[];
  activo?: boolean;
}

export interface ActualizarUsuarioDTO {
  codigo_empleado?: string;
  password_hash?: string;
  rol_id?: number | null;
  roles?: number[];
  activo?: boolean;
}

export interface LoginDTO {
  codigo_empleado: string;
  password: string;
}