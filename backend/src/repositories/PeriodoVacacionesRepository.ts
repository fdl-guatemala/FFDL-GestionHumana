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
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return null;
    }

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
    const [rows] = await pool.query<PeriodoVacaciones[]>(sql, [numId]);
    return rows[0] ?? null;
  }

  async obtenerPorEmpleadoId(empleadoId: number): Promise<PeriodoVacaciones[]> {
    const numEmpId = Number(empleadoId);
    if (!Number.isInteger(numEmpId) || numEmpId <= 0) {
      return [];
    }

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
    const [rows] = await pool.query<PeriodoVacaciones[]>(sql, [numEmpId]);
    return rows;
  }

  async crear(data: CrearPeriodoVacacionesInput): Promise<number> {
    const empId = Number(data.empleado_id);
    if (!Number.isInteger(empId) || empId <= 0) {
      throw new Error("empleado_id inválido para crear el periodo de vacaciones");
    }

    const sql = `
      INSERT INTO periodos_vacaciones (
        empleado_id,
        fecha_inicio_periodo,
        fecha_fin_periodo,
        dias_disponibles
      )
      VALUES (?, ?, ?, ?)
    `;

    const diasIniciales = Number.isFinite(Number(data.dias_disponibles))
      ? Number(data.dias_disponibles)
      : 0;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      empId,
      String(data.fecha_inicio_periodo).trim(),
      String(data.fecha_fin_periodo).trim(),
      diasIniciales,
    ]);

    return Number(result.insertId ?? 0);
  }

  async actualizar(
    id: number,
    data: ActualizarPeriodoVacacionesInput
  ): Promise<boolean> {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return false;
    }

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
      data.empleado_id !== undefined ? Number(data.empleado_id) : null,
      data.fecha_inicio_periodo?.trim() ?? null,
      data.fecha_fin_periodo?.trim() ?? null,
      data.dias_disponibles !== undefined ? Number(data.dias_disponibles) : null,
      numId,
    ]);

    return result.affectedRows > 0;
  }

  async ajustarDiasDisponibles(id: number, deltaDias: number): Promise<boolean> {
    const numId = Number(id);
    const delta = Number(deltaDias);
    if (!Number.isInteger(numId) || numId <= 0 || !Number.isFinite(delta)) {
      return false;
    }

    const sql = `
      UPDATE periodos_vacaciones
      SET dias_disponibles = GREATEST(0, dias_disponibles + ?)
      WHERE id = ?
    `;
    const [result] = await pool.query<ResultSetHeader>(sql, [delta, numId]);
    return result.affectedRows > 0;
  }

  async eliminar(id: number): Promise<boolean> {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return false;
    }

    const sql = `DELETE FROM periodos_vacaciones WHERE id = ?`;
    const [result] = await pool.query<ResultSetHeader>(sql, [numId]);
    return result.affectedRows > 0;
  }
}