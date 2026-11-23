import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database.ts";

export interface Empleado extends RowDataPacket {
  id: number;
  codigo_empleado: string;
  nombre_completo: string;
  puesto: string;
  jefe_inmediato: string | null;
  lugar: string;
  fecha_ingreso: string;
  fecha_ingreso_prueba: string | null;
  fecha_egreso: string | null;
  estado: string;
}

export interface CrearEmpleadoInput {
  codigo_empleado: string;
  nombre_completo: string;
  puesto: string;
  jefe_inmediato?: string | null;
  lugar: string;
  fecha_ingreso: string;
  fecha_ingreso_prueba?: string | null;
  fecha_egreso?: string | null;
  estado?: string;
}

export interface ActualizarEmpleadoInput {
  codigo_empleado?: string;
  nombre_completo?: string;
  puesto?: string;
  jefe_inmediato?: string | null;
  lugar?: string;
  fecha_ingreso?: string;
  fecha_ingreso_prueba?: string | null;
  fecha_egreso?: string | null;
  estado?: string;
}

export interface ResumenDiasVacaciones extends RowDataPacket {
  total_dias_disponibles: number;
}

export class EmpleadoRepository {
  async obtenerTodos(): Promise<Empleado[]> {
    const sql = `
      SELECT
        id,
        codigo_empleado,
        nombre_completo,
        puesto,
        jefe_inmediato,
        lugar,
        fecha_ingreso,
        fecha_ingreso_prueba,
        fecha_egreso,
        estado
      FROM empleados
      ORDER BY id ASC
    `;
    const [rows] = await pool.query<Empleado[]>(sql);
    return rows;
  }

  async obtenerPorId(id: number): Promise<Empleado | null> {
    const sql = `
      SELECT
        id,
        codigo_empleado,
        nombre_completo,
        puesto,
        jefe_inmediato,
        lugar,
        fecha_ingreso,
        fecha_ingreso_prueba,
        fecha_egreso,
        estado
      FROM empleados
      WHERE id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query<Empleado[]>(sql, [id]);
    return rows[0] ?? null;
  }

  async obtenerPorCodigo(codigoEmpleado: string): Promise<Empleado | null> {
    const sql = `
      SELECT
        id,
        codigo_empleado,
        nombre_completo,
        puesto,
        jefe_inmediato,
        lugar,
        fecha_ingreso,
        fecha_ingreso_prueba,
        fecha_egreso,
        estado
      FROM empleados
      WHERE codigo_empleado = ?
      LIMIT 1
    `;
    const [rows] = await pool.query<Empleado[]>(sql, [codigoEmpleado]);
    return rows[0] ?? null;
  }

  async obtenerDiasVacacionesDisponibles(empleadoId: number): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(dias_disponibles), 0) AS total_dias_disponibles
      FROM periodos_vacaciones
      WHERE empleado_id = ?
    `;
    const [rows] = await pool.query<ResumenDiasVacaciones[]>(sql, [empleadoId]);
    return Number(rows[0]?.total_dias_disponibles ?? 0);
  }

  async crear(data: CrearEmpleadoInput): Promise<number> {
    const sql = `
      INSERT INTO empleados (
        codigo_empleado,
        nombre_completo,
        puesto,
        jefe_inmediato,
        lugar,
        fecha_ingreso,
        fecha_ingreso_prueba,
        fecha_egreso,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      data.codigo_empleado.trim(),
      data.nombre_completo.trim(),
      data.puesto.trim(),
      data.jefe_inmediato ?? null,
      data.lugar.trim(),
      data.fecha_ingreso,
      data.fecha_ingreso_prueba ?? null,
      data.fecha_egreso ?? null,
      data.estado ?? "Activo",
    ]);

    return result.insertId;
  }

  async actualizar(id: number, data: ActualizarEmpleadoInput): Promise<boolean> {
    const sql = `
      UPDATE empleados
      SET
        codigo_empleado = COALESCE(?, codigo_empleado),
        nombre_completo = COALESCE(?, nombre_completo),
        puesto = COALESCE(?, puesto),
        jefe_inmediato = COALESCE(?, jefe_inmediato),
        lugar = COALESCE(?, lugar),
        fecha_ingreso = COALESCE(?, fecha_ingreso),
        fecha_ingreso_prueba = COALESCE(?, fecha_ingreso_prueba),
        fecha_egreso = COALESCE(?, fecha_egreso),
        estado = COALESCE(?, estado)
      WHERE id = ?
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      data.codigo_empleado?.trim() ?? null,
      data.nombre_completo?.trim() ?? null,
      data.puesto?.trim() ?? null,
      data.jefe_inmediato !== undefined ? data.jefe_inmediato : null,
      data.lugar?.trim() ?? null,
      data.fecha_ingreso ?? null,
      data.fecha_ingreso_prueba !== undefined ? data.fecha_ingreso_prueba : null,
      data.fecha_egreso !== undefined ? data.fecha_egreso : null,
      data.estado ?? null,
      id,
    ]);

    return result.affectedRows > 0;
  }

  async eliminar(id: number): Promise<boolean> {
    const sql = `DELETE FROM empleados WHERE id = ?`;
    const [result] = await pool.query<ResultSetHeader>(sql, [id]);
    return result.affectedRows > 0;
  }
}