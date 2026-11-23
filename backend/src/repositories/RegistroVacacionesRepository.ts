import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database.ts";

export interface RegistroVacaciones extends RowDataPacket {
  id: number;
  empleado_id: number;
  periodo_id: number;
  fecha_disfrute: string;
  dias_tomados: number;
  estado_constancia: string | null;
  observaciones: string | null;
  codigo_empleado?: string;
  nombre_completo?: string;
  fecha_inicio_periodo?: string;
  fecha_fin_periodo?: string;
}

export interface CrearRegistroVacacionesInput {
  empleado_id: number;
  periodo_id: number;
  fecha_disfrute: string;
  dias_tomados: number;
  estado_constancia?: string | null;
  observaciones?: string | null;
}

export interface ActualizarRegistroVacacionesInput {
  empleado_id?: number;
  periodo_id?: number;
  fecha_disfrute?: string;
  dias_tomados?: number;
  estado_constancia?: string | null;
  observaciones?: string | null;
}

export class RegistroVacacionesRepository {
  async obtenerTodos(): Promise<RegistroVacaciones[]> {
    const sql = `
      SELECT
        rv.id,
        rv.empleado_id,
        rv.periodo_id,
        rv.fecha_disfrute,
        rv.dias_tomados,
        rv.estado_constancia,
        rv.observaciones,
        e.codigo_empleado,
        e.nombre_completo,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo
      FROM registro_vacaciones rv
      INNER JOIN empleados e ON e.id = rv.empleado_id
      INNER JOIN periodos_vacaciones pv ON pv.id = rv.periodo_id
      ORDER BY rv.id DESC
    `;
    const [rows] = await pool.query<RegistroVacaciones[]>(sql);
    return rows;
  }

  async obtenerPorId(id: number): Promise<RegistroVacaciones | null> {
    const sql = `
      SELECT
        rv.id,
        rv.empleado_id,
        rv.periodo_id,
        rv.fecha_disfrute,
        rv.dias_tomados,
        rv.estado_constancia,
        rv.observaciones,
        e.codigo_empleado,
        e.nombre_completo,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo
      FROM registro_vacaciones rv
      INNER JOIN empleados e ON e.id = rv.empleado_id
      INNER JOIN periodos_vacaciones pv ON pv.id = rv.periodo_id
      WHERE rv.id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query<RegistroVacaciones[]>(sql, [id]);
    return rows[0] ?? null;
  }

  async obtenerPorEmpleadoId(empleadoId: number): Promise<RegistroVacaciones[]> {
    const sql = `
      SELECT
        rv.id,
        rv.empleado_id,
        rv.periodo_id,
        rv.fecha_disfrute,
        rv.dias_tomados,
        rv.estado_constancia,
        rv.observaciones,
        e.codigo_empleado,
        e.nombre_completo,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo
      FROM registro_vacaciones rv
      INNER JOIN empleados e ON e.id = rv.empleado_id
      INNER JOIN periodos_vacaciones pv ON pv.id = rv.periodo_id
      WHERE rv.empleado_id = ?
      ORDER BY rv.id DESC
    `;
    const [rows] = await pool.query<RegistroVacaciones[]>(sql, [empleadoId]);
    return rows;
  }

  async crear(data: CrearRegistroVacacionesInput): Promise<number> {
    const sql = `
      INSERT INTO registro_vacaciones (
        empleado_id,
        periodo_id,
        fecha_disfrute,
        dias_tomados,
        estado_constancia,
        observaciones
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      data.empleado_id,
      data.periodo_id,
      data.fecha_disfrute.trim(),
      data.dias_tomados,
      data.estado_constancia ?? "Pendiente",
      data.observaciones ?? null,
    ]);

    return result.insertId;
  }

  async actualizar(
    id: number,
    data: ActualizarRegistroVacacionesInput
  ): Promise<boolean> {
    const sql = `
      UPDATE registro_vacaciones
      SET
        empleado_id = COALESCE(?, empleado_id),
        periodo_id = COALESCE(?, periodo_id),
        fecha_disfrute = COALESCE(?, fecha_disfrute),
        dias_tomados = COALESCE(?, dias_tomados),
        estado_constancia = COALESCE(?, estado_constancia),
        observaciones = COALESCE(?, observaciones)
      WHERE id = ?
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      data.empleado_id ?? null,
      data.periodo_id ?? null,
      data.fecha_disfrute?.trim() ?? null,
      data.dias_tomados ?? null,
      data.estado_constancia !== undefined ? data.estado_constancia : null,
      data.observaciones !== undefined ? data.observaciones : null,
      id,
    ]);

    return result.affectedRows > 0;
  }

  async eliminar(id: number): Promise<boolean> {
    const sql = `DELETE FROM registro_vacaciones WHERE id = ?`;
    const [result] = await pool.query<ResultSetHeader>(sql, [id]);
    return result.affectedRows > 0;
  }
}