export interface PeriodoVacaciones {
  id: number;
  empleado_id: number;
  fecha_inicio_periodo: string | Date;
  fecha_fin_periodo: string | Date;
  dias_disponibles: number;
  // Campos opcionales obtenidos por JOIN con empleados
  codigo_empleado?: string;
  nombre_completo?: string;
  lugar?: string;
}

export interface CrearPeriodoVacacionesDTO {
  empleado_id: number;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  dias_disponibles?: number;
}

export interface ActualizarPeriodoVacacionesDTO {
  empleado_id?: number;
  fecha_inicio_periodo?: string;
  fecha_fin_periodo?: string;
  dias_disponibles?: number;
}