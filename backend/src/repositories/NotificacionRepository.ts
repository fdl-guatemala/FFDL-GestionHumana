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

export class NotificacionRepository {
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