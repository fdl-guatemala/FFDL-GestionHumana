export type EstadoEmpleado = "Activo" | "Inactivo" | "Suspendido" | string;

export interface Empleado {
  id: number;
  codigo_empleado: string;
  nombre_completo: string;
  puesto: string;
  jefe_inmediato: string | null;
  lugar: string;
  fecha_ingreso: string | Date;
  fecha_ingreso_prueba: string | Date | null;
  fecha_egreso: string | Date | null;
  estado: EstadoEmpleado;
}

export interface CrearEmpleadoDTO {
  codigo_empleado: string;
  nombre_completo: string;
  puesto: string;
  jefe_inmediato?: string | null;
  lugar: string;
  fecha_ingreso: string;
  fecha_ingreso_prueba?: string | null;
  fecha_egreso?: string | null;
  estado?: EstadoEmpleado;
}

export interface ActualizarEmpleadoDTO {
  codigo_empleado?: string;
  nombre_completo?: string;
  puesto?: string;
  jefe_inmediato?: string | null;
  lugar?: string;
  fecha_ingreso?: string;
  fecha_ingreso_prueba?: string | null;
  fecha_egreso?: string | null;
  estado?: EstadoEmpleado;
}