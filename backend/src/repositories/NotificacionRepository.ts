import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database.ts";

export type DestinatarioNotificacion =
  | "JEFE_INMEDIATO"
  | "GESTION_HUMANA"
  | "EMPLEADO";

export interface CrearNotificacionInput {
  solicitudId: number;
  tipoSolicitud?: string;
  destinatarioTipo: DestinatarioNotificacion;
  destinatarioReferencia?: string | null;
  titulo: string;
  mensaje: string;
}

export interface NotificacionRow extends RowDataPacket {
  id: number;
  solicitud_id: number;
  tipo_solicitud: string;
  destinatario_tipo: DestinatarioNotificacion;
  destinatario_referencia: string | null;
  titulo: string;
  mensaje: string;
  leida: number;
  creada_en: string;
}

export interface FiltroNotificacionesInput {
  rolTipo?: string | null;
  codigo?: string | null;
  nombre?: string | null;
  empleadoId?: number | string | null;
}

export class NotificacionRepository {
  private normalizarTexto(valor: unknown): string {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private normalizarRolTipo(rolTipo?: string | null): DestinatarioNotificacion {
    const r = this.normalizarTexto(rolTipo);
    if (
      r.includes("gestion") ||
      r.includes("humana") ||
      r === "gh" ||
      r === "rrhh"
    ) {
      return "GESTION_HUMANA";
    }
    if (
      r.includes("jefe") ||
      r.includes("gerente") ||
      r.includes("supervisor")
    ) {
      return "JEFE_INMEDIATO";
    }
    return "EMPLEADO";
  }

  async crear(input: CrearNotificacionInput): Promise<number> {
    const sql = `
      INSERT INTO notificaciones (
        solicitud_id,
        tipo_solicitud,
        destinatario_tipo,
        destinatario_referencia,
        titulo,
        mensaje,
        leida
      )
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      input.solicitudId,
      input.tipoSolicitud ?? "SOLICITUD",
      input.destinatarioTipo,
      input.destinatarioReferencia ?? null,
      input.titulo,
      input.mensaje,
    ]);

    return result.insertId;
  }

  async listarPorDestinatario(
    filtro: FiltroNotificacionesInput
  ): Promise<NotificacionRow[]> {
    const tipo = this.normalizarRolTipo(filtro.rolTipo);

    const [rows] = await pool.query<NotificacionRow[]>(
      `
        SELECT
          id,
          solicitud_id,
          tipo_solicitud,
          destinatario_tipo,
          destinatario_referencia,
          titulo,
          mensaje,
          leida,
          creada_en
        FROM notificaciones
        WHERE destinatario_tipo = ?
        ORDER BY id DESC
      `,
      [tipo]
    );

    if (tipo === "GESTION_HUMANA") {
      return rows;
    }

    const candidatosNorm = [
      this.normalizarTexto(filtro.codigo),
      this.normalizarTexto(filtro.nombre),
      this.normalizarTexto(filtro.empleadoId),
    ].filter((v) => v.length > 0);

    if (candidatosNorm.length === 0) {
      return [];
    }

    return rows.filter((row) => {
      const refNorm = this.normalizarTexto(row.destinatario_referencia);
      if (!refNorm) return false;

      return candidatosNorm.some(
        (cand) =>
          refNorm === cand ||
          refNorm.includes(cand) ||
          cand.includes(refNorm)
      );
    });
  }

  async marcarComoLeida(id: number): Promise<void> {
    await pool.query("UPDATE notificaciones SET leida = 1 WHERE id = ?", [id]);
  }

  async marcarLeidasPorSolicitudYTipo(
    solicitudId: number,
    destinatarioTipo: DestinatarioNotificacion
  ): Promise<void> {
    const sql = `
      UPDATE notificaciones
      SET leida = 1
      WHERE solicitud_id = ? AND destinatario_tipo = ?
    `;
    await pool.query(sql, [solicitudId, destinatarioTipo]);
  }
}