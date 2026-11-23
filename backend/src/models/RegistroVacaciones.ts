export interface RegistroVacaciones {
  id: number;
  empleado_id: number;
  periodo_id: number;
  fecha_disfrute: string;
  dias_tomados: number;
  estado_constancia: string | null;
  observaciones: string | null;
  // Campos opcionales obtenidos por JOIN con empleados y periodos_vacaciones
  codigo_empleado?: string;
  nombre_completo?: string;
  fecha_inicio_periodo?: string | Date;
  fecha_fin_periodo?: string | Date;
}

export interface CrearRegistroVacacionesDTO {
  empleado_id: number;
  periodo_id: number;
  fecha_disfrute: string;
  dias_tomados: number;
  estado_constancia?: string | null;
  observaciones?: string | null;
}

export interface ActualizarRegistroVacacionesDTO {
  empleado_id?: number;
  periodo_id?: number;
  fecha_disfrute?: string;
  dias_tomados?: number;
  estado_constancia?: string | null;
  observaciones?: string | null;
}