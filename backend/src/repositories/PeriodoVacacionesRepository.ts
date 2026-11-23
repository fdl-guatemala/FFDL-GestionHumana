import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database.ts";

export interface PeriodoVacaciones extends RowDataPacket {
  id: number;
  empleado_id: number;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  dias_disponibles: number;
  codigo_empleado?: string;
  nombre_completo?: string;
  lugar?: string;
}

export interface CrearPeriodoVacacionesInput {
  empleado_id: number;
  fecha_inicio_periodo: string;
  fecha_fin_periodo: string;
  dias_disponibles?: number;
}

export interface ActualizarPeriodoVacacionesInput {
  empleado_id?: number;
  fecha_inicio_periodo?: string;
  fecha_fin_periodo?: string;
  dias_disponibles?: number;
}

export class PeriodoVacacionesRepository {
  async obtenerTodos(): Promise<PeriodoVacaciones[]> {
    const sql = `
      SELECT
        pv.id,
        pv.empleado_id,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo,
        pv.dias_disponibles,
        e.codigo_empleado,
        e.nombre_completo,
        e.lugar
      FROM periodos_vacaciones pv
      INNER JOIN empleados e ON e.id = pv.empleado_id
      ORDER BY pv.id DESC
    `;
    const [rows] = await pool.query<PeriodoVacaciones[]>(sql);
    return rows;
  }

  async obtenerPorId(id: number): Promise<PeriodoVacaciones | null> {
    const sql = `
      SELECT
        pv.id,
        pv.empleado_id,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo,
        pv.dias_disponibles,
        e.codigo_empleado,
        e.nombre_completo,
        e.lugar
      FROM periodos_vacaciones pv
      INNER JOIN empleados e ON e.id = pv.empleado_id
      WHERE pv.id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query<PeriodoVacaciones[]>(sql, [id]);
    return rows[0] ?? null;
  }

  async obtenerPorEmpleadoId(empleadoId: number): Promise<PeriodoVacaciones[]> {
    const sql = `
      SELECT
        pv.id,
        pv.empleado_id,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo,
        pv.dias_disponibles,
        e.codigo_empleado,
        e.nombre_completo,
        e.lugar
      FROM periodos_vacaciones pv
      INNER JOIN empleados e ON e.id = pv.empleado_id
      WHERE pv.empleado_id = ?
      ORDER BY pv.fecha_inicio_periodo DESC
    `;
    const [rows] = await pool.query<PeriodoVacaciones[]>(sql, [empleadoId]);
    return rows;
  }

  async crear(data: CrearPeriodoVacacionesInput): Promise<number> {
    const sql = `
      INSERT INTO periodos_vacaciones (
        empleado_id,
        fecha_inicio_periodo,
        fecha_fin_periodo,
        dias_disponibles
      )
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      data.empleado_id,
      data.fecha_inicio_periodo,
      data.fecha_fin_periodo,
      data.dias_disponibles ?? 0,
    ]);

    return result.insertId;
  }

  async actualizar(
    id: number,
    data: ActualizarPeriodoVacacionesInput
  ): Promise<boolean> {
    const sql = `
      UPDATE periodos_vacaciones
      SET
        empleado_id = COALESCE(?, empleado_id),
        fecha_inicio_periodo = COALESCE(?, fecha_inicio_periodo),
        fecha_fin_periodo = COALESCE(?, fecha_fin_periodo),
        dias_disponibles = COALESCE(?, dias_disponibles)
      WHERE id = ?
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      data.empleado_id ?? null,
      data.fecha_inicio_periodo ?? null,
      data.fecha_fin_periodo ?? null,
      data.dias_disponibles ?? null,
      id,
    ]);

    return result.affectedRows > 0;
  }

  async ajustarDiasDisponibles(id: number, deltaDias: number): Promise<boolean> {
    const sql = `
      UPDATE periodos_vacaciones
      SET dias_disponibles = dias_disponibles + ?
      WHERE id = ?
    `;
    const [result] = await pool.query<ResultSetHeader>(sql, [deltaDias, id]);
    return result.affectedRows > 0;
  }

  async eliminar(id: number): Promise<boolean> {
    const sql = `DELETE FROM periodos_vacaciones WHERE id = ?`;
    const [result] = await pool.query<ResultSetHeader>(sql, [id]);
    return result.affectedRows > 0;
  }
}