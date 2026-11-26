import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database.ts";
import fs from "node:fs";
import path from "node:path";

export interface RegistroVacaciones extends RowDataPacket {
  id: number;
  empleado_id: number;
  periodo_id: number;
  fecha_disfrute: string;
  dias_tomados: number;
  estado_constancia: string | null;
  estado?: string | null;
  observaciones: string | null;
  evidencia_nombre?: string | null;
  evidencia_url?: string | null;
  evidencia_base64?: string | null;
  codigo_empleado?: string;
  nombre_completo?: string;
  puesto?: string;
  lugar?: string;
  jefe_inmediato?: string | null;
  fecha_inicio_periodo?: string;
  fecha_fin_periodo?: string;
}

export interface CrearRegistroVacacionesInput {
  empleado_id: number;
  periodo_id: number;
  fecha_disfrute: string;
  dias_tomados: number;
  estado_constancia?: string | null;
  estado?: string | null;
  observaciones?: string | null;
}

export interface ActualizarRegistroVacacionesInput {
  empleado_id?: number;
  periodo_id?: number;
  fecha_disfrute?: string;
  dias_tomados?: number;
  estado_constancia?: string | null;
  estado?: string | null;
  observaciones?: string | null;
  evidencia_nombre?: string | null;
  evidencia_url?: string | null;
  evidencia_base64?: string | null;
}

export interface ActualizarEstadoRegistroInput {
  estado?: string;
  estado_constancia?: string;
  motivo_rechazo?: string;
  rechazado_por?: string;
}

interface EvidenciaAdjuntaGuardada {
  evidencia_nombre: string | null;
  evidencia_url: string | null;
  evidencia_base64: string | null;
}

const EVIDENCIAS_DIR = path.resolve(process.cwd(), "uploads", "evidencias");

function asegurarDirectorioEvidencias(): void {
  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }
}

function rutaArchivoEvidencia(id: number): string {
  return path.join(EVIDENCIAS_DIR, `solicitud_${Number(id)}.json`);
}

function guardarEvidenciaEnDisco(
  id: number,
  data: {
    evidencia_nombre?: string | null;
    evidencia_url?: string | null;
    evidencia_base64?: string | null;
  }
): void {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return;

  const tieneAlgo = Boolean(
    (data.evidencia_base64 && String(data.evidencia_base64).trim()) ||
      (data.evidencia_url && String(data.evidencia_url).trim()) ||
      (data.evidencia_nombre && String(data.evidencia_nombre).trim())
  );
  if (!tieneAlgo) return;

  asegurarDirectorioEvidencias();
  const actual = leerEvidenciaDesdeDisco(numId);
  const payload: EvidenciaAdjuntaGuardada = {
    evidencia_nombre:
      data.evidencia_nombre !== undefined
        ? data.evidencia_nombre
        : actual?.evidencia_nombre ?? null,
    evidencia_url:
      data.evidencia_url !== undefined
        ? data.evidencia_url
        : actual?.evidencia_url ?? null,
    evidencia_base64:
      data.evidencia_base64 !== undefined
        ? data.evidencia_base64
        : actual?.evidencia_base64 ?? null,
  };

  fs.writeFileSync(rutaArchivoEvidencia(numId), JSON.stringify(payload), "utf8");
}

function leerEvidenciaDesdeDisco(id: number): EvidenciaAdjuntaGuardada | null {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;

  const archivo = rutaArchivoEvidencia(numId);
  if (!fs.existsSync(archivo)) return null;

  try {
    const raw = fs.readFileSync(archivo, "utf8");
    const parsed = JSON.parse(raw);
    return {
      evidencia_nombre: parsed?.evidencia_nombre ?? null,
      evidencia_url: parsed?.evidencia_url ?? null,
      evidencia_base64: parsed?.evidencia_base64 ?? null,
    };
  } catch {
    return null;
  }
}

export class RegistroVacacionesRepository {
  private enriquecerConEvidencia(row: RegistroVacaciones): RegistroVacaciones {
    const adjunto = leerEvidenciaDesdeDisco(row.id);
    if (!adjunto) {
      return {
        ...row,
        evidencia_nombre: row.evidencia_nombre ?? null,
        evidencia_url: row.evidencia_url ?? null,
        evidencia_base64: row.evidencia_base64 ?? null,
      };
    }

    return {
      ...row,
      evidencia_nombre: row.evidencia_nombre ?? adjunto.evidencia_nombre,
      evidencia_url: row.evidencia_url ?? adjunto.evidencia_url,
      evidencia_base64: row.evidencia_base64 ?? adjunto.evidencia_base64,
    };
  }

  async guardarEvidenciaAdjunta(
    id: number,
    data: {
      evidencia_nombre?: string | null;
      evidencia_url?: string | null;
      evidencia_base64?: string | null;
    }
  ): Promise<void> {
    guardarEvidenciaEnDisco(id, data);
  }

  async obtenerTodos(): Promise<RegistroVacaciones[]> {
    const sql = `
      SELECT
        rv.id,
        rv.empleado_id,
        rv.periodo_id,
        rv.fecha_disfrute,
        rv.dias_tomados,
        rv.estado_constancia,
        COALESCE(rv.estado_constancia, 'Pendiente') AS estado,
        rv.observaciones,
        e.codigo_empleado,
        e.nombre_completo,
        e.puesto,
        e.lugar,
        e.jefe_inmediato,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo
      FROM registro_vacaciones rv
      INNER JOIN empleados e ON e.id = rv.empleado_id
      INNER JOIN periodos_vacaciones pv ON pv.id = rv.periodo_id
      ORDER BY rv.id DESC
    `;
    const [rows] = await pool.query<RegistroVacaciones[]>(sql);
    return rows.map((r) => this.enriquecerConEvidencia(r));
  }

  async obtenerPorId(id: number): Promise<RegistroVacaciones | null> {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return null;
    }

    const sql = `
      SELECT
        rv.id,
        rv.empleado_id,
        rv.periodo_id,
        rv.fecha_disfrute,
        rv.dias_tomados,
        rv.estado_constancia,
        COALESCE(rv.estado_constancia, 'Pendiente') AS estado,
        rv.observaciones,
        e.codigo_empleado,
        e.nombre_completo,
        e.puesto,
        e.lugar,
        e.jefe_inmediato,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo
      FROM registro_vacaciones rv
      INNER JOIN empleados e ON e.id = rv.empleado_id
      INNER JOIN periodos_vacaciones pv ON pv.id = rv.periodo_id
      WHERE rv.id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query<RegistroVacaciones[]>(sql, [numId]);
    const row = rows[0] ?? null;
    return row ? this.enriquecerConEvidencia(row) : null;
  }

  async obtenerPorEmpleadoId(empleadoId: number): Promise<RegistroVacaciones[]> {
    const numEmpId = Number(empleadoId);
    if (!Number.isInteger(numEmpId) || numEmpId <= 0) {
      return [];
    }

    const sql = `
      SELECT
        rv.id,
        rv.empleado_id,
        rv.periodo_id,
        rv.fecha_disfrute,
        rv.dias_tomados,
        rv.estado_constancia,
        COALESCE(rv.estado_constancia, 'Pendiente') AS estado,
        rv.observaciones,
        e.codigo_empleado,
        e.nombre_completo,
        e.puesto,
        e.lugar,
        e.jefe_inmediato,
        pv.fecha_inicio_periodo,
        pv.fecha_fin_periodo
      FROM registro_vacaciones rv
      INNER JOIN empleados e ON e.id = rv.empleado_id
      INNER JOIN periodos_vacaciones pv ON pv.id = rv.periodo_id
      WHERE rv.empleado_id = ?
      ORDER BY rv.id DESC
    `;
    const [rows] = await pool.query<RegistroVacaciones[]>(sql, [numEmpId]);
    return rows.map((r) => this.enriquecerConEvidencia(r));
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

    const estadoInicial =
      String(data.estado_constancia ?? data.estado ?? "Pendiente").trim() ||
      "Pendiente";

    const [result] = await pool.query<ResultSetHeader>(sql, [
      Number(data.empleado_id),
      Number(data.periodo_id),
      String(data.fecha_disfrute).trim(),
      Number(data.dias_tomados),
      estadoInicial,
      data.observaciones ?? null,
    ]);

    return result.insertId;
  }

  async actualizar(
    id: number,
    data: ActualizarRegistroVacacionesInput
  ): Promise<boolean> {
    const estadoParam =
      data.estado_constancia !== undefined
        ? data.estado_constancia
        : data.estado !== undefined
          ? data.estado
          : null;

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
      data.empleado_id !== undefined ? Number(data.empleado_id) : null,
      data.periodo_id !== undefined ? Number(data.periodo_id) : null,
      data.fecha_disfrute?.trim() ?? null,
      data.dias_tomados !== undefined ? Number(data.dias_tomados) : null,
      estadoParam,
      data.observaciones !== undefined ? data.observaciones : null,
      Number(id),
    ]);

    if (
      data.evidencia_base64 !== undefined ||
      data.evidencia_url !== undefined ||
      data.evidencia_nombre !== undefined
    ) {
      guardarEvidenciaEnDisco(id, {
        evidencia_nombre: data.evidencia_nombre,
        evidencia_url: data.evidencia_url,
        evidencia_base64: data.evidencia_base64,
      });
    }

    return result.affectedRows > 0;
  }

  async actualizarEstado(
    id: number,
    data: ActualizarEstadoRegistroInput
  ): Promise<boolean> {
    const nuevoEstado = String(
      data.estado_constancia ?? data.estado ?? ""
    ).trim();
    if (!nuevoEstado) {
      return false;
    }

    const sql = `
      UPDATE registro_vacaciones
      SET estado_constancia = ?
      WHERE id = ?
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      nuevoEstado,
      Number(id),
    ]);

    return result.affectedRows > 0;
  }

  async eliminar(id: number): Promise<boolean> {
    const numId = Number(id);
    const sql = `DELETE FROM registro_vacaciones WHERE id = ?`;
    const [result] = await pool.query<ResultSetHeader>(sql, [numId]);

    const archivo = rutaArchivoEvidencia(numId);
    if (fs.existsSync(archivo)) {
      try {
        fs.unlinkSync(archivo);
      } catch {
        // Ignorar error de limpieza de archivo
      }
    }

    return result.affectedRows > 0;
  }
}